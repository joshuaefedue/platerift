import type {
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

export function evaluateRestaurantAvailability(
  restaurant: RestaurantTenant,
  orders: Order[],
  overrideDay?: string,
  overrideTime?: string,
  overrideDateISO?: string
): OrderingAvailabilityCheck {
  const now = new Date();
  const checkedDay =
    overrideDay || DAYS_OF_WEEK[now.getDay()];
  const checkedTime =
    overrideTime ||
    `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  const checkedDateISO =
    overrideDateISO || now.toISOString().slice(0, 10);

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
  const ordersToday = orders.filter(
    (o) =>
      o.status !== "cancelled" &&
      (o.createdAt.startsWith(todayPrefix) ||
        new Date(o.createdAt).toDateString() === now.toDateString())
  ).length;

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
  for (const bw of restaurant.blackoutWindows) {
    if (!bw.active) continue;
    const matchesDate = bw.date && bw.date === checkedDateISO;
    const matchesDay =
      bw.dayOfWeek &&
      (bw.dayOfWeek === "All" ||
        bw.dayOfWeek.toLowerCase() === checkedDay.toLowerCase());

    if (matchesDate || matchesDay || (!bw.date && !bw.dayOfWeek)) {
      if (bw.fullDay) {
        return {
          allowed: false,
          reasonCode: "BLACKOUT_WINDOW",
          title: bw.title || "Scheduled Closure",
          message:
            bw.reasonMessage ||
            `Ordering is turned off all day (${bw.title}).`,
          activeOrdersThisHour,
          maxOrdersPerHour: restaurant.maxOrdersPerHour,
          ordersToday,
          maxOrdersPerDay: restaurant.maxOrdersPerDay,
          checkedDay,
          checkedTime,
        };
      }
      const startMins = timeToMinutes(bw.startTime);
      const endMins = timeToMinutes(bw.endTime);
      if (currentMins >= startMins && currentMins <= endMins) {
        return {
          allowed: false,
          reasonCode: "BLACKOUT_WINDOW",
          title: bw.title || "Ordering Paused for Scheduled Window",
          message:
            bw.reasonMessage ||
            `Online ordering is turned off between ${bw.startTime} and ${bw.endTime} (${bw.title}).`,
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
