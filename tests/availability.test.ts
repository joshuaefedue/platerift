import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateRestaurantAvailability,
  findMatchingBlackoutWindow,
  getNowInTimezone,
} from "@/lib/availability";
import type {
  BlackoutWindow,
  DaySchedule,
  Order,
  RestaurantTenant,
} from "@/lib/types";

const ALL_DAYS: DaySchedule["day"][] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function buildWeeklySchedule(
  overrides: Partial<Record<DaySchedule["day"], Partial<DaySchedule>>> = {}
): DaySchedule[] {
  return ALL_DAYS.map((day) => ({
    day,
    enabled: true,
    openTime: "10:00",
    closeTime: "22:00",
    breakEnabled: false,
    breakStart: "15:00",
    breakEnd: "16:30",
    pickupEnabled: true,
    ...(overrides[day] || {}),
  }));
}

function buildTestRestaurant(
  overrides: Partial<RestaurantTenant> = {}
): RestaurantTenant {
  return {
    id: "rest_test_1",
    name: "Test Bistro",
    slug: "test-bistro",
    tagline: "Fresh daily",
    cuisine: "Italian",
    description: "Test restaurant",
    ownerName: "Test Owner",
    ownerEmail: "owner@testbistro.local",
    phone: "+15551112222",
    address: "100 Main St, Chicago, IL",
    timezone: "America/Chicago",
    plan: "growth",
    status: "active",
    customDomain: "",
    subdomain: "test-bistro.platerift.com",
    domainVerified: true,
    sslStatus: "active",
    dnsTxtToken: "txt_test",
    logoEmoji: "🍕",
    primaryColor: "#111111",
    accentColor: "#f59e0b",
    layoutStyle: "modern-grid",
    heroBannerUrl: "",
    customRequirementNotes: "",
    features: {
      pickup: true,
      delivery: true,
      dineInQr: true,
      tableReservations: false,
      loyaltyProgram: true,
      tipping: true,
      promoCodes: true,
      scheduledOrders: true,
      dietaryFilters: true,
      allergyNotes: true,
    },
    orderingEnabled: true,
    pauseReason: "",
    maxOrdersPerHour: 10,
    maxOrdersPerDay: 50,
    minOrderAmount: 10,
    maxOrderAmount: 300,
    prepTimeMinutes: 20,
    advanceNoticeDays: 0,
    advanceNoticeHours: 0,
    advanceNoticeNote: "",
    autoPauseOnLimit: true,
    weeklySchedule: buildWeeklySchedule(),
    blackoutWindows: [],
    paymentConfig: {
      mode: "simulated",
      currency: "usd",
      taxRatePercent: 8.5,
      deliveryFee: 4.99,
      freeDeliveryMin: 50,
      serviceFeePercent: 0,
      stripe: {
        enabled: true,
        accountId: "",
        publishableKey: "",
        secretKey: "",
        webhookSecret: "",
      },
      paypal: {
        enabled: false,
        merchantEmail: "",
        clientId: "",
        clientSecret: "",
      },
    },
    commsConfig: {
      sms: {
        enabled: false,
        mode: "simulated",
        provider: "twilio",
        twilioAccountSid: "",
        twilioAuthToken: "",
        senderPhone: "",
        autoNotifyConfirmed: false,
        autoNotifyPreparing: false,
        autoNotifyReady: false,
        autoNotifyCancelled: false,
        templates: {
          confirmed: "",
          preparing: "",
          ready: "",
          cancelled: "",
        },
      },
      email: {
        enabled: false,
        mode: "simulated",
        provider: "resend",
        fromName: "Test Bistro",
        fromEmail: "hello@testbistro.local",
        apiKeyOrSmtpHost: "",
      },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: `ord_${Math.random().toString(36).slice(2, 8)}`,
    orderNumber: "TB-1001",
    restaurantId: "rest_test_1",
    customerId: null,
    customerName: "Guest",
    customerEmail: "guest@example.com",
    customerPhone: "+15550000001",
    orderType: "pickup",
    items: [],
    subtotal: 25,
    tax: 2,
    deliveryFee: 0,
    tip: 3,
    discount: 0,
    total: 30,
    paymentMethod: "stripe",
    paymentStatus: "paid",
    paymentReference: "ref_1",
    status: "completed",
    specialInstructions: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("getNowInTimezone", () => {
  it("converts UTC instant into target restaurant IANA timezone", () => {
    // 2026-11-20T05:30:00Z is Nov 20 00:30 EST in NY and Nov 19 23:30 CST in Chicago
    const instant = new Date("2026-11-20T05:30:00.000Z");

    const ny = getNowInTimezone("America/New_York", instant);
    assert.deepEqual(ny, {
      day: "Friday",
      time: "00:30",
      dateISO: "2026-11-20",
    });

    const chi = getNowInTimezone("America/Chicago", instant);
    assert.deepEqual(chi, {
      day: "Thursday",
      time: "23:30",
      dateISO: "2026-11-19",
    });
  });

  it('normalizes midnight hour "24" to "00"', () => {
    const midnightNy = new Date("2026-11-20T05:00:00.000Z");
    const ny = getNowInTimezone("America/New_York", midnightNy);
    assert.equal(ny.time, "00:00");

    const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function () {
      return [
        { type: "weekday", value: "Friday" },
        { type: "month", value: "11" },
        { type: "day", value: "20" },
        { type: "year", value: "2026" },
        { type: "hour", value: "24" },
        { type: "minute", value: "15" },
      ];
    };
    try {
      const normalized = getNowInTimezone("America/New_York", midnightNy);
      assert.deepEqual(normalized, {
        day: "Friday",
        time: "00:15",
        dateISO: "2026-11-20",
      });
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
    }
  });

  it("falls back to America/Chicago for invalid or empty timezones and to UTC if Intl fails", () => {
    const instant = new Date("2026-11-20T18:45:00.000Z");
    const expectedChicago = getNowInTimezone("America/Chicago", instant);

    assert.deepEqual(getNowInTimezone("Mars/Olympus_Mons", instant), expectedChicago);
    assert.deepEqual(getNowInTimezone("   ", instant), expectedChicago);

    const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function () {
      throw new RangeError("Simulated Intl failure");
    };
    try {
      const utcFallback = getNowInTimezone("America/New_York", instant);
      assert.deepEqual(utcFallback, {
        day: "Friday",
        time: "18:45",
        dateISO: "2026-11-20",
      });
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
    }
  });
});

describe("findMatchingBlackoutWindow", () => {
  const windows: BlackoutWindow[] = [
    {
      id: "bw_inactive",
      title: "Disabled Window",
      dayOfWeek: "All",
      startTime: "00:00",
      endTime: "23:59",
      fullDay: true,
      active: false,
      reasonMessage: "Should not trigger",
    },
    {
      id: "bw_xmas",
      title: "Christmas Closure",
      date: "2026-12-25",
      dayOfWeek: "Monday", // Deliberately mismatched; date takes precedence
      startTime: "00:00",
      endTime: "23:59",
      fullDay: true,
      active: true,
      reasonMessage: "Closed for Christmas",
    },
    {
      id: "bw_catering",
      title: "Private Buyout",
      dayOfWeek: "Friday",
      startTime: "17:00",
      endTime: "19:30",
      fullDay: false,
      active: true,
      reasonMessage: "Private catering event",
    },
  ];

  it("ignores inactive blackout windows", () => {
    const match = findMatchingBlackoutWindow(windows, "2026-11-18", "Wednesday", "12:00");
    assert.equal(match, null);
  });

  it("matches specific date full-day blackout and prioritizes date over dayOfWeek", () => {
    const match = findMatchingBlackoutWindow(windows, "2026-12-25", "Friday", "11:00");
    assert.ok(match);
    assert.equal(match.id, "bw_xmas");
  });

  it("matches time-bounded recurring dayOfWeek window inclusively and returns null outside", () => {
    assert.equal(
      findMatchingBlackoutWindow(windows, "2026-11-20", "Friday", "16:59"),
      null
    );
    const startMatch = findMatchingBlackoutWindow(
      windows,
      "2026-11-20",
      "Friday",
      "17:00"
    );
    assert.equal(startMatch?.id, "bw_catering");
    const endMatch = findMatchingBlackoutWindow(
      windows,
      "2026-11-20",
      "Friday",
      "19:30"
    );
    assert.equal(endMatch?.id, "bw_catering");
    assert.equal(
      findMatchingBlackoutWindow(windows, "2026-11-20", "Friday", "19:31"),
      null
    );
  });
});

describe("evaluateRestaurantAvailability", () => {
  it("allows orders when open within schedule and under capacity limits", () => {
    const restaurant = buildTestRestaurant();
    const res = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Wednesday",
      "12:30",
      "2026-11-18"
    );
    assert.equal(res.allowed, true);
    assert.equal(res.reasonCode, "OPEN");
    assert.equal(res.checkedDay, "Wednesday");
    assert.equal(res.checkedTime, "12:30");
  });

  it("blocks orders when manually paused", () => {
    const restaurant = buildTestRestaurant({
      orderingEnabled: false,
      pauseReason: "Oven maintenance",
    });
    const res = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Wednesday",
      "12:30",
      "2026-11-18"
    );
    assert.equal(res.allowed, false);
    assert.equal(res.reasonCode, "MANUAL_PAUSED");
    assert.equal(res.message, "Oven maintenance");
  });

  it("blocks orders during full-day and timed blackout windows", () => {
    const restaurant = buildTestRestaurant({
      blackoutWindows: [
        {
          id: "bw_1",
          title: "Thanksgiving",
          date: "2026-11-26",
          startTime: "00:00",
          endTime: "23:59",
          fullDay: true,
          active: true,
          reasonMessage: "Happy Thanksgiving!",
        },
        {
          id: "bw_2",
          title: "Staff Meeting",
          dayOfWeek: "Tuesday",
          startTime: "14:00",
          endTime: "15:00",
          fullDay: false,
          active: true,
          reasonMessage: "Back at 3 PM",
        },
      ],
    });

    const fullDayRes = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Thursday",
      "13:00",
      "2026-11-26"
    );
    assert.equal(fullDayRes.allowed, false);
    assert.equal(fullDayRes.reasonCode, "BLACKOUT_WINDOW");
    assert.equal(fullDayRes.title, "Thanksgiving");

    const timedRes = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Tuesday",
      "14:30",
      "2026-11-17"
    );
    assert.equal(timedRes.allowed, false);
    assert.equal(timedRes.reasonCode, "BLACKOUT_WINDOW");
    assert.equal(timedRes.title, "Staff Meeting");
  });

  it("enforces closed days, outside hours, overnight schedules, and prep breaks", () => {
    const restaurant = buildTestRestaurant({
      weeklySchedule: buildWeeklySchedule({
        Sunday: { enabled: false },
        Monday: {
          enabled: true,
          openTime: "11:00",
          closeTime: "21:00",
          breakEnabled: true,
          breakStart: "15:00",
          breakEnd: "17:00",
        },
        Saturday: {
          enabled: true,
          openTime: "18:00",
          closeTime: "02:00",
        },
      }),
    });

    const closedDay = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Sunday",
      "13:00",
      "2026-11-22"
    );
    assert.equal(closedDay.allowed, false);
    assert.equal(closedDay.reasonCode, "DAY_CLOSED");

    const tooEarly = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Monday",
      "10:30",
      "2026-11-16"
    );
    assert.equal(tooEarly.allowed, false);
    assert.equal(tooEarly.reasonCode, "OUTSIDE_HOURS");

    const onBreak = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Monday",
      "15:30",
      "2026-11-16"
    );
    assert.equal(onBreak.allowed, false);
    assert.equal(onBreak.reasonCode, "BREAK_WINDOW");

    const afterBreak = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Monday",
      "17:00",
      "2026-11-16"
    );
    assert.equal(afterBreak.allowed, true);
    assert.equal(afterBreak.reasonCode, "OPEN");

    const overnightLate = evaluateRestaurantAvailability(
      restaurant,
      [],
      "Saturday",
      "01:15",
      "2026-11-21"
    );
    assert.equal(overnightLate.allowed, true);
    assert.equal(overnightLate.reasonCode, "OPEN");
  });

  it("enforces hourly and daily order limits using timezone-aware ordersToday", () => {
    const restaurant = buildTestRestaurant({
      timezone: "America/Chicago",
      maxOrdersPerHour: 2,
      maxOrdersPerDay: 3,
      autoPauseOnLimit: true,
    });

    const nowIso = new Date().toISOString();
    const hourlyRes = evaluateRestaurantAvailability(
      restaurant,
      [
        buildTestOrder({ status: "confirmed", createdAt: nowIso }),
        buildTestOrder({ status: "preparing", createdAt: nowIso }),
        buildTestOrder({ status: "cancelled", createdAt: nowIso }),
      ],
      "Wednesday",
      "12:30",
      "2026-11-18"
    );
    assert.equal(hourlyRes.allowed, false);
    assert.equal(hourlyRes.reasonCode, "HOURLY_ORDER_LIMIT_REACHED");
    assert.equal(hourlyRes.activeOrdersThisHour, 2);

    // 3 completed orders earlier on 2026-11-18 in Chicago timezone (11:00 CST = 17:00 UTC)
    const dailyRes = evaluateRestaurantAvailability(
      buildTestRestaurant({
        timezone: "America/Chicago",
        maxOrdersPerHour: 10,
        maxOrdersPerDay: 3,
        autoPauseOnLimit: true,
      }),
      [
        buildTestOrder({ status: "completed", createdAt: "2026-11-18T17:00:00.000Z" }),
        buildTestOrder({ status: "completed", createdAt: "2026-11-18T18:00:00.000Z" }),
        buildTestOrder({ status: "completed", createdAt: "2026-11-19T05:30:00.000Z" }), // 23:30 CST on Nov 18!
        buildTestOrder({ status: "cancelled", createdAt: "2026-11-18T19:00:00.000Z" }),
      ],
      "Wednesday",
      "12:30",
      "2026-11-18"
    );
    assert.equal(dailyRes.allowed, false);
    assert.equal(dailyRes.reasonCode, "DAILY_ORDER_LIMIT_REACHED");
    assert.equal(dailyRes.ordersToday, 3);
  });

  it("uses restaurant.timezone directly when no override is supplied", () => {
    const restaurant = buildTestRestaurant({
      timezone: "Pacific/Honolulu",
      weeklySchedule: buildWeeklySchedule(),
    });
    const expected = getNowInTimezone("Pacific/Honolulu");
    const res = evaluateRestaurantAvailability(restaurant, []);
    assert.equal(res.checkedDay, expected.day);
    assert.equal(res.checkedTime, expected.time);
  });
});
