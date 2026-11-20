import type {
  BlackoutWindow,
  OrderingAvailabilityCheck,
  Order,
  RestaurantTenant,
} from "./types";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

function formatPartsInTimezone(
  date: Date,
  timeZone: string
): { day: string; time: string; dateISO: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const rawHour = (map.hour || "00").padStart(2, "0");
  const hour = rawHour === "24" ? "00" : rawHour;
  const minute = (map.minute || "00").padStart(2, "0");
  const year = map.year || String(date.getUTCFullYear());
  const month = (map.month || String(date.getUTCMonth() + 1).padStart(2, "0")).padStart(2, "0");
  const dayNum = (map.day || String(date.getUTCDate()).padStart(2, "0")).padStart(2, "0");
  const weekday = map.weekday || DAYS_OF_WEEK[date.getUTCDay()];

  return {
    day: weekday,
    time: `${hour}:${minute}`,
    dateISO: `${year}-${month}-${dayNum}`,
  };
}

/**
 * Resolves the current day of week, HH:MM time, and YYYY-MM-DD date in the
 * given IANA timezone, falling back to America/Chicago and then UTC if invalid.
 */
export function getNowInTimezone(
  tz: string,
  now: Date = new Date()
): { day: string; time: string; dateISO: string } {
  const candidateTz = tz?.trim() || "America/Chicago";
  try {
    return formatPartsInTimezone(now, candidateTz);
  } catch {
    try {
      return formatPartsInTimezone(now, "America/Chicago");
    } catch {
      const hour = String(now.getUTCHours()).padStart(2, "0");
      const minute = String(now.getUTCMinutes()).padStart(2, "0");
      return {
        day: DAYS_OF_WEEK[now.getUTCDay()],
        time: `${hour}:${minute}`,
        dateISO: now.toISOString().slice(0, 10),
      };
    }
  }
}

/**
 * Returns the first active blackout window matching the given date/day/time, or null.
 */
export function findMatchingBlackoutWindow(
  blackoutWindows: BlackoutWindow[],
  checkedDateISO: string,
  checkedDay: string,
  checkedTime: string
): BlackoutWindow | null {
  const currentMins = timeToMinutes(checkedTime);
  for (const bw of blackoutWindows) {
    if (!bw.active) continue;
    const hasDate = Boolean(bw.date && bw.date.trim());
    const hasDay = Boolean(bw.dayOfWeek && bw.dayOfWeek.trim());
    const matchesWindow = hasDate
      ? bw.date!.trim() === checkedDateISO
      : hasDay
      ? bw.dayOfWeek === "All" ||
        bw.dayOfWeek!.toLowerCase() === checkedDay.toLowerCase()
      : true;

    if (matchesWindow) {
      if (bw.fullDay) return bw;
      const startMins = timeToMinutes(bw.startTime);
      const endMins = timeToMinutes(bw.endTime);
      if (currentMins >= startMins && currentMins <= endMins) {
        return bw;
      }
    }
  }
  return null;
}

export function evaluateRestaurantAvailability(
  restaurant: RestaurantTenant,
  orders: Order[],
  overrideDay?: string,
  overrideTime?: string,
  overrideDateISO?: string
): OrderingAvailabilityCheck {
  const now = new Date();
  const tzNow = getNowInTimezone(restaurant.timezone, now);
  const checkedDay = overrideDay || tzNow.day;
  const checkedTime = overrideTime || tzNow.time;
  const checkedDateISO = overrideDateISO || tzNow.dateISO;

  // Count active orders in the last 60 minutes (or non-cancelled/non-completed active queue) and today's total orders
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const activeOrdersThisHour = orders.filter((o) => {
    if (o.status === "cancelled") return false;
    const t = new Date(o.createdAt).getTime();
    return (
      t >= oneHourAgo ||
      o.status === "confirmed" ||
      o.status === "preparing"
    );
  }).length;

  const todayPrefix = checkedDateISO;
  const ordersToday = orders.filter((o) => {
    if (o.status === "cancelled" || !o.createdAt) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(o.createdAt.trim())) {
      return o.createdAt.trim() === todayPrefix;
    }
    const parsed = new Date(o.createdAt);
    if (!isNaN(parsed.getTime())) {
      return getNowInTimezone(restaurant.timezone, parsed).dateISO === todayPrefix;
    }
    return o.createdAt.startsWith(todayPrefix);
  }).length;

  // 1. Manual emergency ordering off
  if (!restaurant.orderingEnabled) {
    return {
      allowed: false,
      reasonCode: "MANUAL_PAUSED",
      title: "Online Ordering Temporarily Paused",
      message:
        restaurant.pauseReason ||
        `${restaurant.name} has temporarily paused incoming online orders. Please check back shortly!`,
      activeOrdersThisHour,
      maxOrdersPerHour: restaurant.maxOrdersPerHour,
      ordersToday,
      maxOrdersPerDay: restaurant.maxOrdersPerDay,
      checkedDay,
      checkedTime,
    };
  }

  const currentMins = timeToMinutes(checkedTime);

  // 2. Check specific Blackout Windows (date-specific or day-of-week specific)
  const matchedBlackout = findMatchingBlackoutWindow(
    restaurant.blackoutWindows,
    checkedDateISO,
    checkedDay,
    checkedTime
  );
  if (matchedBlackout) {
    if (matchedBlackout.fullDay) {
      return {
        allowed: false,
        reasonCode: "BLACKOUT_WINDOW",
        title: matchedBlackout.title || "Scheduled Closure",
        message:
          matchedBlackout.reasonMessage ||
          `Ordering is turned off all day (${matchedBlackout.title}).`,
        activeOrdersThisHour,
        maxOrdersPerHour: restaurant.maxOrdersPerHour,
        ordersToday,
        maxOrdersPerDay: restaurant.maxOrdersPerDay,
        checkedDay,
        checkedTime,
      };
    }
    return {
      allowed: false,
      reasonCode: "BLACKOUT_WINDOW",
      title: matchedBlackout.title || "Ordering Paused for Scheduled Window",
      message:
        matchedBlackout.reasonMessage ||
        `Online ordering is turned off between ${matchedBlackout.startTime} and ${matchedBlackout.endTime} (${matchedBlackout.title}).`,
      activeOrdersThisHour,
      maxOrdersPerHour: restaurant.maxOrdersPerHour,
      ordersToday,
      maxOrdersPerDay: restaurant.maxOrdersPerDay,
      checkedDay,
      checkedTime,
    };
  }

  // 3. Check Weekly Day Schedule
  const daySchedule = restaurant.weeklySchedule.find(
    (d) => d.day.toLowerCase() === checkedDay.toLowerCase()
  );

  if (daySchedule) {
    if (!daySchedule.enabled) {
      return {
        allowed: false,
        reasonCode: "DAY_CLOSED",
        title: `Closed on ${daySchedule.day}s`,
        message: `${restaurant.name} does not accept online orders on ${daySchedule.day}s.`,
        activeOrdersThisHour,
        maxOrdersPerHour: restaurant.maxOrdersPerHour,
        ordersToday,
        maxOrdersPerDay: restaurant.maxOrdersPerDay,
        checkedDay,
        checkedTime,
      };
    }

    const openMins = timeToMinutes(daySchedule.openTime);
    const closeMins = timeToMinutes(daySchedule.closeTime);
    const inHours =
      closeMins >= openMins
        ? currentMins >= openMins && currentMins <= closeMins
        : currentMins >= openMins || currentMins <= closeMins;

    if (!inHours) {
      return {
        allowed: false,
        reasonCode: "OUTSIDE_HOURS",
        title: "Currently Outside Ordering Hours",
        message: `${restaurant.name} accepts orders on ${daySchedule.day} from ${daySchedule.openTime} to ${daySchedule.closeTime}. (Checked time: ${checkedTime})`,
        activeOrdersThisHour,
        maxOrdersPerHour: restaurant.maxOrdersPerHour,
        ordersToday,
        maxOrdersPerDay: restaurant.maxOrdersPerDay,
        checkedDay,
        checkedTime,
      };
    }

    if (
      daySchedule.breakEnabled &&
      daySchedule.breakStart &&
      daySchedule.breakEnd
    ) {
      const bStart = timeToMinutes(daySchedule.breakStart);
      const bEnd = timeToMinutes(daySchedule.breakEnd);
      if (currentMins >= bStart && currentMins < bEnd) {
        return {
          allowed: false,
          reasonCode: "BREAK_WINDOW",
          title: "Kitchen Prep Break",
          message: `Online ordering is paused for mid-day kitchen prep from ${daySchedule.breakStart} to ${daySchedule.breakEnd}.`,
          activeOrdersThisHour,
          maxOrdersPerHour: restaurant.maxOrdersPerHour,
          ordersToday,
          maxOrdersPerDay: restaurant.maxOrdersPerDay,
          checkedDay,
          checkedTime,
        };
      }
    }
  }

  // 4. Check Hourly & Daily Order Limits
  if (restaurant.autoPauseOnLimit) {
    if (activeOrdersThisHour >= restaurant.maxOrdersPerHour) {
      return {
        allowed: false,
        reasonCode: "HOURLY_ORDER_LIMIT_REACHED",
        title: "Hourly Kitchen Capacity Reached",
        message: `${restaurant.name} has reached its maximum limit of ${restaurant.maxOrdersPerHour} orders for this hour to ensure food quality. Ordering will resume automatically as orders complete.`,
        activeOrdersThisHour,
        maxOrdersPerHour: restaurant.maxOrdersPerHour,
        ordersToday,
        maxOrdersPerDay: restaurant.maxOrdersPerDay,
        checkedDay,
        checkedTime,
      };
    }

    if (ordersToday >= restaurant.maxOrdersPerDay) {
      return {
        allowed: false,
        reasonCode: "DAILY_ORDER_LIMIT_REACHED",
        title: "Daily Order Limit Reached",
        message: `${restaurant.name} has reached its maximum daily capacity of ${restaurant.maxOrdersPerDay} orders for today.`,
        activeOrdersThisHour,
        maxOrdersPerHour: restaurant.maxOrdersPerHour,
        ordersToday,
        maxOrdersPerDay: restaurant.maxOrdersPerDay,
        checkedDay,
        checkedTime,
      };
    }
  }

  return {
    allowed: true,
    reasonCode: "OPEN",
    title: "Open for Online Ordering",
    message: `Accepting orders now • Est. prep time ${restaurant.prepTimeMinutes} mins`,
    activeOrdersThisHour,
    maxOrdersPerHour: restaurant.maxOrdersPerHour,
    ordersToday,
    maxOrdersPerDay: restaurant.maxOrdersPerDay,
    checkedDay,
    checkedTime,
  };
}
