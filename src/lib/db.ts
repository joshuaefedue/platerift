import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ROLE_DEFINITIONS,
  type Customer,
  type DaySchedule,
  type EmailCampaign,
  type MenuItem,
  type Order,
  type PlatformIntegrationsConfig,
  type PlatformTwilioConfig,
  type ReorderFrequency,
  type RestaurantInventoryConfig,
  type RestaurantTenant,
  type ScheduledReorder,
  type ScheduledReorderStatus,
  type SmsLog,
  type StorefrontPagesConfig,
  type TenantIntegrationsConfig,
  type UserAccount,
  type UserRole,
  type UserScope,
  type UserStatus,
} from "./types";
import { buildDefaultStorefrontPages } from "./storefrontPagesDefaults";
import { ensureMenuItemVariantsAndSides } from "./menuVariantsAndSides";
import { buildDefaultInventoryConfig } from "./inventoryDefaults";
import {
  buildDefaultIntegrationsConfig,
  buildDefaultPlatformIntegrationsConfig,
  buildSimulatedDoorDashTracking,
} from "./integrationsDefaults";

// On Vercel Serverless Functions, /var/task is read-only; use /tmp (os.tmpdir()) automatically
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR =
  process.env.SQLITE_DATA_DIR ||
  (IS_VERCEL
    ? path.join(os.tmpdir(), "platerift-data")
    : path.join(process.cwd(), "data"));
const DB_PATH = path.join(DATA_DIR, "saas.db");

declare global {
  // eslint-disable-next-line no-var
  var __plateriftDb: DatabaseSync | undefined;
}

function getDb(): DatabaseSync {
  if (!global.__plateriftDb) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Load node:sqlite lazily at runtime so Next.js build workers don't evaluate it at module import time
    const sqliteModule = eval("require")("node:sqlite") as typeof import("node:sqlite");
    const db = new sqliteModule.DatabaseSync(DB_PATH);
    try {
      db.exec("PRAGMA busy_timeout = 10000;");
      db.exec("PRAGMA journal_mode = WAL;");
    } catch {
      // Ignore WAL lock contention across concurrent workers
    }
    db.exec("PRAGMA foreign_keys = ON;");
    initTables(db);
    seedIfEmpty(db);
    seedUsersIfEmpty(db);
    seedCustomerHistoryAndReordersIfEmpty(db);
    global.__plateriftDb = db;
  } else {
    initTables(global.__plateriftDb);
    seedUsersIfEmpty(global.__plateriftDb);
    seedCustomerHistoryAndReordersIfEmpty(global.__plateriftDb);
  }
  return global.__plateriftDb;
}

function initTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      tagline TEXT NOT NULL,
      cuisine TEXT NOT NULL,
      description TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      ownerEmail TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      timezone TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      customDomain TEXT NOT NULL,
      subdomain TEXT NOT NULL,
      domainVerified INTEGER NOT NULL DEFAULT 1,
      sslStatus TEXT NOT NULL DEFAULT 'active',
      dnsTxtToken TEXT NOT NULL,
      logoEmoji TEXT NOT NULL,
      primaryColor TEXT NOT NULL,
      accentColor TEXT NOT NULL,
      layoutStyle TEXT NOT NULL,
      heroBannerUrl TEXT NOT NULL,
      customRequirementNotes TEXT NOT NULL DEFAULT '',
      featuresJson TEXT NOT NULL,
      orderingEnabled INTEGER NOT NULL DEFAULT 1,
      pauseReason TEXT NOT NULL DEFAULT '',
      maxOrdersPerHour INTEGER NOT NULL DEFAULT 25,
      maxOrdersPerDay INTEGER NOT NULL DEFAULT 200,
      minOrderAmount REAL NOT NULL DEFAULT 12,
      maxOrderAmount REAL NOT NULL DEFAULT 500,
      prepTimeMinutes INTEGER NOT NULL DEFAULT 25,
      advanceNoticeDays INTEGER NOT NULL DEFAULT 0,
      advanceNoticeHours INTEGER NOT NULL DEFAULT 0,
      advanceNoticeNote TEXT NOT NULL DEFAULT '',
      autoPauseOnLimit INTEGER NOT NULL DEFAULT 1,
      weeklyScheduleJson TEXT NOT NULL,
      blackoutWindowsJson TEXT NOT NULL,
      paymentConfigJson TEXT NOT NULL,
      commsConfigJson TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      restaurantId TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      imageUrl TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      unavailableReason TEXT NOT NULL DEFAULT '',
      dailyStockLimit INTEGER,
      currentStockCount INTEGER,
      popular INTEGER NOT NULL DEFAULT 0,
      prepTimeMinutes INTEGER NOT NULL DEFAULT 15,
      dietaryTagsJson TEXT NOT NULL,
      modifiersJson TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      restaurantId TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      defaultAddress TEXT NOT NULL DEFAULT '',
      totalOrders INTEGER NOT NULL DEFAULT 0,
      totalSpent REAL NOT NULL DEFAULT 0,
      loyaltyPoints INTEGER NOT NULL DEFAULT 0,
      vipStatus INTEGER NOT NULL DEFAULT 0,
      smsOptIn INTEGER NOT NULL DEFAULT 1,
      emailOptIn INTEGER NOT NULL DEFAULT 1,
      tagsJson TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      lastOrderAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT NOT NULL,
      restaurantId TEXT NOT NULL,
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      orderType TEXT NOT NULL,
      tableNumber TEXT,
      deliveryAddress TEXT,
      itemsJson TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      deliveryFee REAL NOT NULL,
      tip REAL NOT NULL,
      discount REAL NOT NULL,
      total REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      paymentReference TEXT NOT NULL,
      status TEXT NOT NULL,
      specialInstructions TEXT NOT NULL DEFAULT '',
      scheduledFor TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      restaurantId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      triggerType TEXT NOT NULL,
      message TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_campaigns (
      id TEXT PRIMARY KEY,
      restaurantId TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      segment TEXT NOT NULL,
      promoCode TEXT,
      discountPercent INTEGER,
      bodyHtml TEXT NOT NULL,
      status TEXT NOT NULL,
      recipientCount INTEGER NOT NULL,
      openRate REAL NOT NULL,
      clickRate REAL NOT NULL,
      revenueGenerated REAL NOT NULL,
      sentAt TEXT NOT NULL,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      restaurantId TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      title TEXT NOT NULL DEFAULT '',
      pinCode TEXT NOT NULL DEFAULT '',
      permissionsJson TEXT NOT NULL DEFAULT '[]',
      lastActiveAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scheduled_reorders (
      id TEXT PRIMARY KEY,
      restaurantId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      sourceOrderNumber TEXT NOT NULL,
      title TEXT NOT NULL,
      orderType TEXT NOT NULL,
      deliveryAddress TEXT,
      tableNumber TEXT,
      itemsJson TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      deliveryFee REAL NOT NULL,
      tip REAL NOT NULL,
      total REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      frequency TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      scheduledTime TEXT NOT NULL,
      specialInstructions TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      lastTriggeredAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      valueJson TEXT NOT NULL
    );
  `);

  try {
    db.exec(
      "ALTER TABLE customers ADD COLUMN defaultAddress TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE restaurants ADD COLUMN advanceNoticeDays INTEGER NOT NULL DEFAULT 0;"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE restaurants ADD COLUMN advanceNoticeHours INTEGER NOT NULL DEFAULT 0;"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE restaurants ADD COLUMN advanceNoticeNote TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE restaurants ADD COLUMN storefrontPagesJson TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE restaurants ADD COLUMN inventoryConfigJson TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE restaurants ADD COLUMN integrationsConfigJson TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE orders ADD COLUMN deliveryTrackingJson TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  try {
    db.exec(
      "ALTER TABLE orders ADD COLUMN posSyncJson TEXT NOT NULL DEFAULT '';"
    );
  } catch {
    // Column already exists
  }

  // Migrate any legacy RestoSaaS branding in existing database rows to Platerift
  try {
    db.exec(`
      UPDATE restaurants
      SET subdomain = REPLACE(subdomain, '.restosaas.app', '.platerift.app'),
          dnsTxtToken = REPLACE(dnsTxtToken, 'restosaas-verify=', 'platerift-verify='),
          storefrontPagesJson = REPLACE(storefrontPagesJson, 'RestoSaaS', 'Platerift'),
          integrationsConfigJson = REPLACE(REPLACE(integrationsConfigJson, 'restosaas', 'platerift'), 'RESTOSAAS', 'PLATERIFT')
      WHERE subdomain LIKE '%restosaas%'
         OR dnsTxtToken LIKE '%restosaas%'
         OR storefrontPagesJson LIKE '%RestoSaaS%'
         OR integrationsConfigJson LIKE '%restosaas%'
         OR integrationsConfigJson LIKE '%RESTOSAAS%';

      UPDATE users
      SET email = REPLACE(email, '@restosaas.app', '@platerift.app')
      WHERE email LIKE '%@restosaas.app%';

      UPDATE platform_settings
      SET valueJson = REPLACE(REPLACE(REPLACE(valueJson, 'RestoSaaS', 'Platerift'), 'restosaas', 'platerift'), 'RESTOSAAS', 'PLATERIFT')
      WHERE valueJson LIKE '%restosaas%' OR valueJson LIKE '%RestoSaaS%' OR valueJson LIKE '%RESTOSAAS%';
    `);
  } catch {
    // Ignore if tables are being initialized
  }
}

function defaultWeeklySchedule(): DaySchedule[] {
  return [
    {
      day: "Monday",
      enabled: true,
      openTime: "08:00",
      closeTime: "23:00",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "11:00",
      pickupEndTime: "21:30",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
    {
      day: "Tuesday",
      enabled: true,
      openTime: "08:00",
      closeTime: "23:00",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "11:00",
      pickupEndTime: "21:30",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
    {
      day: "Wednesday",
      enabled: true,
      openTime: "08:00",
      closeTime: "23:00",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "11:00",
      pickupEndTime: "21:30",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
    {
      day: "Thursday",
      enabled: true,
      openTime: "08:00",
      closeTime: "23:00",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "11:00",
      pickupEndTime: "22:00",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
    {
      day: "Friday",
      enabled: true,
      openTime: "08:00",
      closeTime: "23:59",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "11:30",
      pickupEndTime: "22:30",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
    {
      day: "Saturday",
      enabled: true,
      openTime: "09:00",
      closeTime: "23:59",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "12:00",
      pickupEndTime: "22:30",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
    {
      day: "Sunday",
      enabled: true,
      openTime: "09:00",
      closeTime: "22:00",
      breakEnabled: false,
      breakStart: "15:00",
      breakEnd: "16:30",
      pickupEnabled: true,
      pickupStartTime: "12:00",
      pickupEndTime: "20:30",
      pickupSlotIntervalMinutes: 30,
      customPickupSlots: [],
    },
  ];
}

function seedIfEmpty(db: DatabaseSync) {
  const countRow = db
    .prepare("SELECT COUNT(*) as cnt FROM restaurants")
    .get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const nowIso = new Date().toISOString();

  const initialRestaurants: RestaurantTenant[] = [
    {
      id: "rest_bella_napoli",
      name: "Bella Napoli Trattoria",
      slug: "bella-napoli",
      tagline: "Wood-Fired Neapolitan Pizza & Handmade Pasta",
      cuisine: "Italian & Wood-Fired Pizza",
      description:
        "Authentic family-owned Neapolitan pizzeria crafting 72-hour fermented sourdough crusts, San Marzano DOP sauces, and artisanal handmade pasta.",
      ownerName: "Marco Rossi",
      ownerEmail: "marco@bellanapoli.com",
      phone: "+1 (312) 555-0194",
      address: "742 W Fulton Market, Chicago, IL 60661",
      timezone: "America/Chicago",
      plan: "enterprise",
      status: "active",
      customDomain: "orders.bellanapoli.com",
      subdomain: "bella-napoli.platerift.app",
      domainVerified: true,
      sslStatus: "active",
      dnsTxtToken: "platerift-verify=bn9812fa772c",
      logoEmoji: "🍕",
      primaryColor: "#dc2626",
      accentColor: "#fef2f2",
      layoutStyle: "modern-grid",
      heroBannerUrl:
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1400&q=80",
      customRequirementNotes:
        "Requires Gluten-Free dough modifier on all pizzas, wood-fired oven hourly cap of 20 orders/hr, and VIP wine pairing email alerts.",
      features: {
        pickup: true,
        delivery: true,
        dineInQr: true,
        tableReservations: true,
        loyaltyProgram: true,
        tipping: true,
        promoCodes: true,
        scheduledOrders: true,
        dietaryFilters: true,
        allergyNotes: true,
      },
      orderingEnabled: true,
      pauseReason: "",
      maxOrdersPerHour: 20,
      maxOrdersPerDay: 180,
      minOrderAmount: 15,
      maxOrderAmount: 450,
      prepTimeMinutes: 25,
      advanceNoticeDays: 0,
      advanceNoticeHours: 2,
      advanceNoticeNote:
        "Please allow at least 2 hours advance notice for our 72-hour fermented sourdough dough & wood-fired preparation.",
      autoPauseOnLimit: true,
      weeklySchedule: defaultWeeklySchedule(),
      blackoutWindows: [
        {
          id: "bw_1",
          title: "Private Wine Tasting Buyout",
          dayOfWeek: "Sunday",
          startTime: "15:00",
          endTime: "17:00",
          fullDay: false,
          active: false,
          reasonMessage:
            "Online ordering is paused from 3:00 PM – 5:00 PM for our private wine cellar event.",
        },
      ],
      paymentConfig: {
        mode: "simulated",
        currency: "USD",
        taxRatePercent: 8.75,
        deliveryFee: 4.99,
        freeDeliveryMin: 45,
        serviceFeePercent: 2.5,
        stripe: {
          enabled: true,
          accountId: "acct_1BellaNapoliLive99",
          publishableKey: "pk_test_51BellaNapoliStripeKey8821",
          secretKey: "sk_test_51BellaNapoliSecretKey9912",
          webhookSecret: "whsec_bella_napoli_99812",
        },
        paypal: {
          enabled: true,
          merchantEmail: "payments@bellanapoli.com",
          clientId: "AYBellaNapoliPayPalClientID9912",
          clientSecret: "EJBellaNapoliPayPalSecret7721",
        },
      },
      commsConfig: {
        sms: {
          enabled: true,
          mode: "simulated",
          provider: "twilio",
          twilioAccountSid: "AC9821be11a00912837465bella",
          twilioAuthToken: "auth_bella_token_88123",
          senderPhone: "+13125550199",
          autoNotifyConfirmed: true,
          autoNotifyPreparing: true,
          autoNotifyReady: true,
          autoNotifyCancelled: true,
          templates: {
            confirmed:
              "🍕 Ciao {{customer_name}}! Bella Napoli received your order #{{order_number}} ({{total}}). Est. prep time: {{prep_time}} mins.",
            preparing:
              "🔥 {{customer_name}}, Chef Marco just put your Bella Napoli order #{{order_number}} into the wood-fired oven!",
            ready:
              "✅ Bellissimo! Order #{{order_number}} from Bella Napoli is hot and ready for pickup/delivery!",
            cancelled:
              "⚠️ Hi {{customer_name}}, your Bella Napoli order #{{order_number}} was cancelled and refunded. Call us if you need help.",
          },
        },
        email: {
          enabled: true,
          mode: "simulated",
          provider: "resend",
          fromName: "Bella Napoli Trattoria",
          fromEmail: "ciao@orders.bellanapoli.com",
          apiKeyOrSmtpHost: "re_bella_napoli_live_881293",
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "rest_sakura_omakase",
      name: "Sakura Izakaya & Sushi",
      slug: "sakura-sushi",
      tagline: "Artisanal Tokyo Sushi, Ramen & Robata Grill",
      cuisine: "Japanese Sushi & Ramen",
      description:
        "Modern Japanese Izakaya flying fresh Tsukiji market fish daily alongside 18-hour slow-simmered Tonkotsu ramen and craft matcha desserts.",
      ownerName: "Kenji Takahashi",
      ownerEmail: "kenji@sakurasushi.io",
      phone: "+1 (206) 555-0148",
      address: "2104 Pine St, Seattle, WA 98122",
      timezone: "America/Los_Angeles",
      plan: "growth",
      status: "active",
      customDomain: "eat.sakurasushi.io",
      subdomain: "sakura-sushi.platerift.app",
      domainVerified: true,
      sslStatus: "active",
      dnsTxtToken: "platerift-verify=sk4491bc109a",
      logoEmoji: "🍣",
      primaryColor: "#0f766e",
      accentColor: "#f0fdfa",
      layoutStyle: "editorial-list",
      heroBannerUrl:
        "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1400&q=80",
      customRequirementNotes:
        "Daily Sashimi stock counts required; Omakase boxes capped at 12 per night; raw fish allergy advisory enabled.",
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
      maxOrdersPerHour: 15,
      maxOrdersPerDay: 140,
      minOrderAmount: 20,
      maxOrderAmount: 600,
      prepTimeMinutes: 30,
      advanceNoticeDays: 1,
      advanceNoticeHours: 0,
      advanceNoticeNote:
        "Omakase & fresh Tsukiji sashimi orders require 1 day (24 hours) advance notice.",
      autoPauseOnLimit: true,
      weeklySchedule: defaultWeeklySchedule(),
      blackoutWindows: [
        {
          id: "bw_sakura_1",
          title: "Afternoon Fish Market Delivery & Prep",
          dayOfWeek: "All",
          startTime: "15:00",
          endTime: "16:30",
          fullDay: false,
          active: false,
          reasonMessage:
            "Our sushi chefs are filleting fresh daily fish between 3:00 PM and 4:30 PM.",
        },
      ],
      paymentConfig: {
        mode: "simulated",
        currency: "USD",
        taxRatePercent: 10.1,
        deliveryFee: 5.5,
        freeDeliveryMin: 60,
        serviceFeePercent: 2.0,
        stripe: {
          enabled: true,
          accountId: "acct_1SakuraSushi881",
          publishableKey: "pk_test_51SakuraStripeKey",
          secretKey: "sk_test_51SakuraSecretKey",
          webhookSecret: "whsec_sakura_9911",
        },
        paypal: {
          enabled: true,
          merchantEmail: "billing@sakurasushi.io",
          clientId: "AYSakuraPayPalClientID",
          clientSecret: "EJSakuraPayPalSecret",
        },
      },
      commsConfig: {
        sms: {
          enabled: true,
          mode: "simulated",
          provider: "twilio",
          twilioAccountSid: "AC7712sakura0019283",
          twilioAuthToken: "auth_sakura_token_771",
          senderPhone: "+12065550188",
          autoNotifyConfirmed: true,
          autoNotifyPreparing: true,
          autoNotifyReady: true,
          autoNotifyCancelled: true,
          templates: {
            confirmed:
              "🍣 Arigato {{customer_name}}! Sakura Izakaya confirmed order #{{order_number}} ({{total}}). Prep time: ~{{prep_time}}m.",
            preparing:
              "🔪 Our master sushi chefs are now crafting your Sakura order #{{order_number}}.",
            ready:
              "🥢 Order #{{order_number}} from Sakura Izakaya & Sushi is packed fresh and ready!",
            cancelled:
              "⚠️ Order #{{order_number}} at Sakura Sushi has been cancelled and refunded.",
          },
        },
        email: {
          enabled: true,
          mode: "simulated",
          provider: "resend",
          fromName: "Sakura Izakaya & Sushi",
          fromEmail: "hello@eat.sakurasushi.io",
          apiKeyOrSmtpHost: "re_sakura_sushi_live_112",
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "rest_fuego_taqueria",
      name: "Fuego Craft Taqueria",
      slug: "fuego-taqueria",
      tagline: "Birria Tacos, Mezcal Margaritas & Street Corn",
      cuisine: "Modern Mexican Street Food",
      description:
        "High-energy Mexico City street taco kitchen serving heirloom blue-corn tortillas, 12-hour Jalisco beef birria, and house-made habanero salsas.",
      ownerName: "Elena Morales",
      ownerEmail: "elena@fuegotaqueria.mx",
      phone: "+1 (512) 555-0172",
      address: "1408 S Congress Ave, Austin, TX 78704",
      timezone: "America/Chicago",
      plan: "starter",
      status: "active",
      customDomain: "tacos.fuegotaqueria.com",
      subdomain: "fuego-taqueria.platerift.app",
      domainVerified: false,
      sslStatus: "pending",
      dnsTxtToken: "platerift-verify=fg5519tx883b",
      logoEmoji: "🌮",
      primaryColor: "#d97706",
      accentColor: "#fffbeb",
      layoutStyle: "compact-bistro",
      heroBannerUrl:
        "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1400&q=80",
      customRequirementNotes:
        "Fast-casual high volume pickup counter; Taco Tuesday SMS blast automation; custom spice level selector on every taco order.",
      features: {
        pickup: true,
        delivery: true,
        dineInQr: true,
        tableReservations: false,
        loyaltyProgram: true,
        tipping: true,
        promoCodes: true,
        scheduledOrders: false,
        dietaryFilters: true,
        allergyNotes: true,
      },
      orderingEnabled: true,
      pauseReason: "",
      maxOrdersPerHour: 35,
      maxOrdersPerDay: 300,
      minOrderAmount: 10,
      maxOrderAmount: 350,
      prepTimeMinutes: 15,
      advanceNoticeDays: 0,
      advanceNoticeHours: 0,
      advanceNoticeNote: "",
      autoPauseOnLimit: true,
      weeklySchedule: defaultWeeklySchedule(),
      blackoutWindows: [],
      paymentConfig: {
        mode: "simulated",
        currency: "USD",
        taxRatePercent: 8.25,
        deliveryFee: 3.99,
        freeDeliveryMin: 35,
        serviceFeePercent: 2.0,
        stripe: {
          enabled: true,
          accountId: "acct_1FuegoTacosAustin",
          publishableKey: "pk_test_51FuegoStripeKey",
          secretKey: "sk_test_51FuegoSecretKey",
          webhookSecret: "whsec_fuego_512",
        },
        paypal: {
          enabled: true,
          merchantEmail: "hola@fuegotaqueria.com",
          clientId: "AYFuegoPayPalClientID",
          clientSecret: "EJFuegoPayPalSecret",
        },
      },
      commsConfig: {
        sms: {
          enabled: true,
          mode: "simulated",
          provider: "twilio",
          twilioAccountSid: "AC512fuego009182",
          twilioAuthToken: "auth_fuego_token_512",
          senderPhone: "+15125550199",
          autoNotifyConfirmed: true,
          autoNotifyPreparing: true,
          autoNotifyReady: true,
          autoNotifyCancelled: true,
          templates: {
            confirmed:
              "🌮 ¡Hola {{customer_name}}! Fuego Taqueria got your order #{{order_number}} ({{total}}). Ready in ~{{prep_time}} mins!",
            preparing:
              "🔥 Your tortillas are hitting the plancha! Fuego order #{{order_number}} is being prepared.",
            ready:
              "🎉 Order #{{order_number}} is hot & ready at the Fuego Pickup Counter!",
            cancelled:
              "⚠️ Your Fuego Taqueria order #{{order_number}} was cancelled and refunded.",
          },
        },
        email: {
          enabled: true,
          mode: "simulated",
          provider: "resend",
          fromName: "Fuego Craft Taqueria",
          fromEmail: "hola@tacos.fuegotaqueria.com",
          apiKeyOrSmtpHost: "re_fuego_tacos_live_512",
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const insertRestaurant = db.prepare(`
    INSERT INTO restaurants (
      id, name, slug, tagline, cuisine, description, ownerName, ownerEmail, phone, address,
      timezone, plan, status, customDomain, subdomain, domainVerified, sslStatus, dnsTxtToken,
      logoEmoji, primaryColor, accentColor, layoutStyle, heroBannerUrl, customRequirementNotes,
      featuresJson, orderingEnabled, pauseReason, maxOrdersPerHour, maxOrdersPerDay,
      minOrderAmount, maxOrderAmount, prepTimeMinutes, advanceNoticeDays, advanceNoticeHours, advanceNoticeNote, autoPauseOnLimit,
      weeklyScheduleJson, blackoutWindowsJson, paymentConfigJson, commsConfigJson,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  for (const r of initialRestaurants) {
    insertRestaurant.run(
      r.id,
      r.name,
      r.slug,
      r.tagline,
      r.cuisine,
      r.description,
      r.ownerName,
      r.ownerEmail,
      r.phone,
      r.address,
      r.timezone,
      r.plan,
      r.status,
      r.customDomain,
      r.subdomain,
      r.domainVerified ? 1 : 0,
      r.sslStatus,
      r.dnsTxtToken,
      r.logoEmoji,
      r.primaryColor,
      r.accentColor,
      r.layoutStyle,
      r.heroBannerUrl,
      r.customRequirementNotes,
      JSON.stringify(r.features),
      r.orderingEnabled ? 1 : 0,
      r.pauseReason,
      r.maxOrdersPerHour,
      r.maxOrdersPerDay,
      r.minOrderAmount,
      r.maxOrderAmount,
      r.prepTimeMinutes,
      r.advanceNoticeDays,
      r.advanceNoticeHours,
      r.advanceNoticeNote,
      r.autoPauseOnLimit ? 1 : 0,
      JSON.stringify(r.weeklySchedule),
      JSON.stringify(r.blackoutWindows),
      JSON.stringify(r.paymentConfig),
      JSON.stringify(r.commsConfig),
      r.createdAt,
      r.updatedAt
    );
  }

  // Seed Menu Items across all 3 restaurants (including an unavailable item to demonstrate the feature immediately)
  const initialMenuItems: MenuItem[] = [
    // Bella Napoli
    {
      id: "item_bn_1",
      restaurantId: "rest_bella_napoli",
      category: "Wood-Fired Pizzas",
      name: "Margherita Verace DOP",
      description:
        "San Marzano DOP crushed tomatoes, fresh Fior di Latte mozzarella, organic basil, cold-pressed EVOO, 72-hr sourdough crust.",
      price: 19.5,
      imageUrl:
        "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 60,
      currentStockCount: 44,
      popular: true,
      prepTimeMinutes: 15,
      dietaryTags: ["Vegetarian", "Popular"],
      modifiers: [
        {
          name: "Crust Option",
          required: true,
          options: [
            { label: "Traditional Sourdough (12\")", priceDelta: 0 },
            { label: "Gluten-Free Cauliflower Crust", priceDelta: 4.0 },
          ],
        },
        {
          name: "Artisanal Add-Ons",
          required: false,
          options: [
            { label: "Fresh Burrata Center", priceDelta: 5.5 },
            { label: "Prosciutto di Parma", priceDelta: 4.5 },
            { label: "Calabrian Chili Honey Drizzle", priceDelta: 2.0 },
          ],
        },
      ],
      sortOrder: 1,
    },
    {
      id: "item_bn_2",
      restaurantId: "rest_bella_napoli",
      category: "Wood-Fired Pizzas",
      name: "Diavola & Hot Soppressata",
      description:
        "Spicy Calabrian soppressata, aged provolone, fior di latte, caramelized shallots, wildflower chili honey.",
      price: 23.0,
      imageUrl:
        "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 45,
      currentStockCount: 31,
      popular: true,
      prepTimeMinutes: 18,
      dietaryTags: ["Spicy", "Chef Special"],
      modifiers: [
        {
          name: "Crust Option",
          required: true,
          options: [
            { label: "Traditional Sourdough (12\")", priceDelta: 0 },
            { label: "Gluten-Free Crust", priceDelta: 4.0 },
          ],
        },
      ],
      sortOrder: 2,
    },
    {
      id: "item_bn_3",
      restaurantId: "rest_bella_napoli",
      category: "Handmade Pasta",
      name: "Truffle Tagliolini al Tartufo",
      description:
        "Hand-cut 40-yolk egg tagliolini ribbon pasta, Parmigiano Reggiano 36-month fonduta, shaved Umbrian black truffle.",
      price: 28.0,
      imageUrl:
        "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=800&q=80",
      available: false,
      unavailableReason: "Sold out for tonight — Fresh black truffle shipment arrives tomorrow",
      dailyStockLimit: 20,
      currentStockCount: 0,
      popular: true,
      prepTimeMinutes: 20,
      dietaryTags: ["Vegetarian", "Signature"],
      modifiers: [],
      sortOrder: 3,
    },
    {
      id: "item_bn_4",
      restaurantId: "rest_bella_napoli",
      category: "Handmade Pasta",
      name: "Rigatoni alla Vodka & Burrata",
      description:
        "Bronze-die extruded rigatoni, spicy Calabrian vodka crema, crispy pancetta, topped with creamy Pugliese burrata.",
      price: 24.5,
      imageUrl:
        "https://images.unsplash.com/photo-1621996346565-e3d5d6281298?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 50,
      currentStockCount: 39,
      popular: true,
      prepTimeMinutes: 18,
      dietaryTags: ["Popular"],
      modifiers: [
        {
          name: "Protein Addition",
          required: false,
          options: [
            { label: "Grilled Herb Chicken", priceDelta: 6.0 },
            { label: "Garlic Prawns (4 pcs)", priceDelta: 8.5 },
          ],
        },
      ],
      sortOrder: 4,
    },
    {
      id: "item_bn_5",
      restaurantId: "rest_bella_napoli",
      category: "Antipasti & Dolci",
      name: "Burrata & Heirloom Prosciutto Board",
      description:
        "Creamy Pugliese burrata, 24-month aged Prosciutto di Parma, roasted figs, balsamic glaze, wood-fired rosemary focaccia.",
      price: 18.0,
      imageUrl:
        "https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: null,
      currentStockCount: null,
      popular: false,
      prepTimeMinutes: 10,
      dietaryTags: ["Shareable"],
      modifiers: [],
      sortOrder: 5,
    },
    {
      id: "item_bn_6",
      restaurantId: "rest_bella_napoli",
      category: "Antipasti & Dolci",
      name: "Nonno's Espresso Tiramisu",
      description:
        "Savoiardi ladyfingers soaked in Napoli espresso & Marsala, whipped mascarpone zabaglione, Valrhona cocoa.",
      price: 12.5,
      imageUrl:
        "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 30,
      currentStockCount: 18,
      popular: true,
      prepTimeMinutes: 5,
      dietaryTags: ["Vegetarian"],
      modifiers: [],
      sortOrder: 6,
    },

    // Sakura Izakaya & Sushi
    {
      id: "item_sk_1",
      restaurantId: "rest_sakura_omakase",
      category: "Omakase & Nigiri",
      name: "Chef's 12-Piece Omakase Box",
      description:
        "Bluefin Otoro, Hokkaido Uni, King Salmon belly, Yellowtail truffle, Botan Ebi, and seasonal Tokyo catch with freshly grated wasabi.",
      price: 68.0,
      imageUrl:
        "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 12,
      currentStockCount: 7,
      popular: true,
      prepTimeMinutes: 25,
      dietaryTags: ["Gluten-Free Option", "Chef Special"],
      modifiers: [
        {
          name: "Soy Sauce Preference",
          required: true,
          options: [
            { label: "House Aged Shoyu", priceDelta: 0 },
            { label: "Gluten-Free Tamari", priceDelta: 1.0 },
          ],
        },
      ],
      sortOrder: 1,
    },
    {
      id: "item_sk_2",
      restaurantId: "rest_sakura_omakase",
      category: "Signature Rolls",
      name: "Black Dragon Torched Roll",
      description:
        "Tempura shrimp, cucumber, topped with blow-torched unagi freshwater eel, avocado, kabayaki glaze & crispy shallots.",
      price: 22.0,
      imageUrl:
        "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 40,
      currentStockCount: 28,
      popular: true,
      prepTimeMinutes: 15,
      dietaryTags: ["Popular"],
      modifiers: [],
      sortOrder: 2,
    },
    {
      id: "item_sk_3",
      restaurantId: "rest_sakura_omakase",
      category: "Artisanal Ramen",
      name: "Black Garlic Truffle Tonkotsu Ramen",
      description:
        "18-hour pork bone broth, charred mayu black garlic oil, chashu pork belly, ajitsuke soft egg, bamboo shoots, fresh wavy noodles.",
      price: 21.5,
      imageUrl:
        "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 50,
      currentStockCount: 35,
      popular: true,
      prepTimeMinutes: 15,
      dietaryTags: ["Rich Broth"],
      modifiers: [
        {
          name: "Spice Level",
          required: true,
          options: [
            { label: "Original Savory", priceDelta: 0 },
            { label: "Spicy Aka Miso Bomb (+1)", priceDelta: 1.5 },
          ],
        },
      ],
      sortOrder: 3,
    },
    {
      id: "item_sk_4",
      restaurantId: "rest_sakura_omakase",
      category: "Omakase & Nigiri",
      name: "Hokkaido Sea Urchin (Uni) Flight",
      description:
        "Three-piece tasting of grade-A Bafun Uni from Hokkaido over warm Akazu red-vinegar sushi rice and crisp nori.",
      price: 34.0,
      imageUrl:
        "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
      available: false,
      unavailableReason: "86'd — All Hokkaido Uni reserved for tonight",
      dailyStockLimit: 10,
      currentStockCount: 0,
      popular: false,
      prepTimeMinutes: 12,
      dietaryTags: ["Rare Catch", "Gluten-Free"],
      modifiers: [],
      sortOrder: 4,
    },

    // Fuego Craft Taqueria
    {
      id: "item_fg_1",
      restaurantId: "rest_fuego_taqueria",
      category: "Street Tacos",
      name: "Quesabirria Tacos Trio + Consomé",
      description:
        "Three crispy Jalisco-style braised beef birria tacos on heirloom corn tortillas with Oaxaca cheese, onions, cilantro & rich dipping broth.",
      price: 16.5,
      imageUrl:
        "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 100,
      currentStockCount: 72,
      popular: true,
      prepTimeMinutes: 10,
      dietaryTags: ["Gluten-Free", "Popular"],
      modifiers: [
        {
          name: "House Salsa Choice",
          required: true,
          options: [
            { label: "Roasted Tomatillo Verde (Mild)", priceDelta: 0 },
            { label: "Smoky Chipotle Arbol (Medium)", priceDelta: 0 },
            { label: "Mango Habanero Fuego (Hot 🔥)", priceDelta: 0.75 },
          ],
        },
      ],
      sortOrder: 1,
    },
    {
      id: "item_fg_2",
      restaurantId: "rest_fuego_taqueria",
      category: "Street Tacos",
      name: "Al Pastor Spit-Roasted Pork Tacos (3)",
      description:
        "Achiote-marinated pork shaved off the vertical trompo, charred pineapple, pickled red onion, cilantro.",
      price: 14.5,
      imageUrl:
        "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 80,
      currentStockCount: 55,
      popular: true,
      prepTimeMinutes: 10,
      dietaryTags: ["Gluten-Free"],
      modifiers: [],
      sortOrder: 2,
    },
    {
      id: "item_fg_3",
      restaurantId: "rest_fuego_taqueria",
      category: "Sides & Antojitos",
      name: "Tableside Guacamole & Totopos",
      description:
        "Hand-smashed Michoacán Hass avocados, serrano chile, lime, cotija cheese, warm sea-salt corn tortilla chips.",
      price: 11.0,
      imageUrl:
        "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 60,
      currentStockCount: 40,
      popular: true,
      prepTimeMinutes: 5,
      dietaryTags: ["Vegan Option", "Gluten-Free"],
      modifiers: [],
      sortOrder: 3,
    },
  ];

  const insertMenuItem = db.prepare(`
    INSERT INTO menu_items (
      id, restaurantId, category, name, description, price, imageUrl,
      available, unavailableReason, dailyStockLimit, currentStockCount,
      popular, prepTimeMinutes, dietaryTagsJson, modifiersJson, sortOrder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of initialMenuItems) {
    insertMenuItem.run(
      item.id,
      item.restaurantId,
      item.category,
      item.name,
      item.description,
      item.price,
      item.imageUrl,
      item.available ? 1 : 0,
      item.unavailableReason,
      item.dailyStockLimit,
      item.currentStockCount,
      item.popular ? 1 : 0,
      item.prepTimeMinutes,
      JSON.stringify(item.dietaryTags),
      JSON.stringify(item.modifiers),
      item.sortOrder
    );
  }

  // Seed Customers
  const initialCustomers: Customer[] = [
    {
      id: "cust_1",
      restaurantId: "rest_bella_napoli",
      name: "Sophia Vance",
      email: "sophia.vance@example.com",
      phone: "+1 (312) 555-0821",
      totalOrders: 14,
      totalSpent: 642.5,
      loyaltyPoints: 640,
      vipStatus: true,
      smsOptIn: true,
      emailOptIn: true,
      tags: ["VIP", "Wine Lover", "Friday Regular"],
      notes: "Prefers extra crispy crust and Calabrian chili oil on the side.",
      lastOrderAt: nowIso,
      createdAt: "2026-06-14T18:30:00.000Z",
    },
    {
      id: "cust_2",
      restaurantId: "rest_bella_napoli",
      name: "David Chen",
      email: "dchen@chicagotech.io",
      phone: "+1 (312) 555-0432",
      totalOrders: 6,
      totalSpent: 248.0,
      loyaltyPoints: 248,
      vipStatus: false,
      smsOptIn: true,
      emailOptIn: true,
      tags: ["Delivery", "Gluten-Free"],
      notes: "Gluten-free crust for Margherita.",
      lastOrderAt: nowIso,
      createdAt: "2026-08-02T19:15:00.000Z",
    },
    {
      id: "cust_3",
      restaurantId: "rest_bella_napoli",
      name: "Olivia Martinez",
      email: "olivia.m@designstudio.co",
      phone: "+1 (312) 555-0911",
      totalOrders: 9,
      totalSpent: 415.75,
      loyaltyPoints: 415,
      vipStatus: true,
      smsOptIn: true,
      emailOptIn: true,
      tags: ["VIP", "Pickup", "Pasta Fan"],
      notes: "Always orders Rigatoni alla Vodka & Tiramisu.",
      lastOrderAt: nowIso,
      createdAt: "2026-07-19T12:00:00.000Z",
    },
    {
      id: "cust_4",
      restaurantId: "rest_sakura_omakase",
      name: "Liam O'Connor",
      email: "liam@seattleventures.com",
      phone: "+1 (206) 555-0334",
      totalOrders: 11,
      totalSpent: 890.0,
      loyaltyPoints: 890,
      vipStatus: true,
      smsOptIn: true,
      emailOptIn: true,
      tags: ["VIP", "Omakase Regular"],
      notes: "Loves Omakase box with extra ginger.",
      lastOrderAt: nowIso,
      createdAt: "2026-05-10T20:00:00.000Z",
    },
    {
      id: "cust_5",
      restaurantId: "rest_fuego_taqueria",
      name: "Carlos Mendez",
      email: "carlos@austincreative.org",
      phone: "+1 (512) 555-0623",
      totalOrders: 18,
      totalSpent: 432.0,
      loyaltyPoints: 432,
      vipStatus: true,
      smsOptIn: true,
      emailOptIn: true,
      tags: ["VIP", "Taco Tuesday"],
      notes: "Extra Mango Habanero salsa every time.",
      lastOrderAt: nowIso,
      createdAt: "2026-04-22T17:45:00.000Z",
    },
  ];

  const insertCustomer = db.prepare(`
    INSERT INTO customers (
      id, restaurantId, name, email, phone, totalOrders, totalSpent,
      loyaltyPoints, vipStatus, smsOptIn, emailOptIn, tagsJson, notes, lastOrderAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of initialCustomers) {
    insertCustomer.run(
      c.id,
      c.restaurantId,
      c.name,
      c.email,
      c.phone,
      c.totalOrders,
      c.totalSpent,
      c.loyaltyPoints,
      c.vipStatus ? 1 : 0,
      c.smsOptIn ? 1 : 0,
      c.emailOptIn ? 1 : 0,
      JSON.stringify(c.tags),
      c.notes,
      c.lastOrderAt,
      c.createdAt
    );
  }

  // Seed Orders
  const initialOrders: Order[] = [
    {
      id: "ord_101",
      orderNumber: "BN-1042",
      restaurantId: "rest_bella_napoli",
      customerId: "cust_1",
      customerName: "Sophia Vance",
      customerEmail: "sophia.vance@example.com",
      customerPhone: "+1 (312) 555-0821",
      orderType: "delivery",
      deliveryAddress: "900 N Michigan Ave Apt 14B, Chicago, IL",
      items: [
        {
          menuItemId: "item_bn_1",
          name: "Margherita Verace DOP",
          quantity: 1,
          unitPrice: 19.5,
          selectedModifiers: [
            {
              groupName: "Crust Option",
              optionLabel: "Traditional Sourdough (12\")",
              priceDelta: 0,
            },
            {
              groupName: "Artisanal Add-Ons",
              optionLabel: "Fresh Burrata Center",
              priceDelta: 5.5,
            },
          ],
          itemTotal: 25.0,
        },
        {
          menuItemId: "item_bn_6",
          name: "Nonno's Espresso Tiramisu",
          quantity: 2,
          unitPrice: 12.5,
          selectedModifiers: [],
          itemTotal: 25.0,
        },
      ],
      subtotal: 50.0,
      tax: 4.38,
      deliveryFee: 0,
      tip: 9.0,
      discount: 0,
      total: 63.38,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      paymentReference: "pi_3Q9BellaStripe8821",
      status: "preparing",
      specialInstructions: "Please ring buzzer #14B, extra basil if possible!",
      createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    },
    {
      id: "ord_102",
      orderNumber: "BN-1043",
      restaurantId: "rest_bella_napoli",
      customerId: "cust_2",
      customerName: "David Chen",
      customerEmail: "dchen@chicagotech.io",
      customerPhone: "+1 (312) 555-0432",
      orderType: "pickup",
      items: [
        {
          menuItemId: "item_bn_2",
          name: "Diavola & Hot Soppressata",
          quantity: 1,
          unitPrice: 23.0,
          selectedModifiers: [
            {
              groupName: "Crust Option",
              optionLabel: "Gluten-Free Crust",
              priceDelta: 4.0,
            },
          ],
          itemTotal: 27.0,
        },
        {
          menuItemId: "item_bn_4",
          name: "Rigatoni alla Vodka & Burrata",
          quantity: 1,
          unitPrice: 24.5,
          selectedModifiers: [],
          itemTotal: 24.5,
        },
      ],
      subtotal: 51.5,
      tax: 4.51,
      deliveryFee: 0,
      tip: 7.5,
      discount: 0,
      total: 63.51,
      paymentMethod: "paypal",
      paymentStatus: "paid",
      paymentReference: "PAYID-BELLANAPOLI-9921",
      status: "confirmed",
      specialInstructions: "Picking up in 20 mins.",
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "ord_103",
      orderNumber: "SK-2088",
      restaurantId: "rest_sakura_omakase",
      customerId: "cust_4",
      customerName: "Liam O'Connor",
      customerEmail: "liam@seattleventures.com",
      customerPhone: "+1 (206) 555-0334",
      orderType: "pickup",
      items: [
        {
          menuItemId: "item_sk_1",
          name: "Chef's 12-Piece Omakase Box",
          quantity: 1,
          unitPrice: 68.0,
          selectedModifiers: [
            {
              groupName: "Soy Sauce Preference",
              optionLabel: "House Aged Shoyu",
              priceDelta: 0,
            },
          ],
          itemTotal: 68.0,
        },
      ],
      subtotal: 68.0,
      tax: 6.87,
      deliveryFee: 0,
      tip: 12.0,
      discount: 0,
      total: 86.87,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      paymentReference: "pi_3Q9SakuraStripe119",
      status: "ready",
      specialInstructions: "Include wooden chopsticks for 2.",
      createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, orderNumber, restaurantId, customerId, customerName, customerEmail,
      customerPhone, orderType, tableNumber, deliveryAddress, itemsJson,
      subtotal, tax, deliveryFee, tip, discount, total, paymentMethod,
      paymentStatus, paymentReference, status, specialInstructions, scheduledFor, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const o of initialOrders) {
    insertOrder.run(
      o.id,
      o.orderNumber,
      o.restaurantId,
      o.customerId,
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      o.orderType,
      o.tableNumber || null,
      o.deliveryAddress || null,
      JSON.stringify(o.items),
      o.subtotal,
      o.tax,
      o.deliveryFee,
      o.tip,
      o.discount,
      o.total,
      o.paymentMethod,
      o.paymentStatus,
      o.paymentReference,
      o.status,
      o.specialInstructions,
      o.scheduledFor || null,
      o.createdAt
    );
  }

  // Seed SMS Logs
  const initialSmsLogs: SmsLog[] = [
    {
      id: "sms_1",
      restaurantId: "rest_bella_napoli",
      customerName: "Sophia Vance",
      customerPhone: "+1 (312) 555-0821",
      triggerType: "order_preparing",
      message:
        "🔥 Sophia Vance, Chef Marco just put your Bella Napoli order #BN-1042 into the wood-fired oven!",
      provider: "twilio_simulated",
      status: "delivered",
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: "sms_2",
      restaurantId: "rest_bella_napoli",
      customerName: "David Chen",
      customerPhone: "+1 (312) 555-0432",
      triggerType: "order_confirmed",
      message:
        "🍕 Ciao David Chen! Bella Napoli received your order #BN-1043 ($63.51). Est. prep time: 25 mins.",
      provider: "twilio_simulated",
      status: "delivered",
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "sms_3",
      restaurantId: "rest_sakura_omakase",
      customerName: "Liam O'Connor",
      customerPhone: "+1 (206) 555-0334",
      triggerType: "order_ready",
      message:
        "🥢 Order #SK-2088 from Sakura Izakaya & Sushi is packed fresh and ready!",
      provider: "twilio_simulated",
      status: "delivered",
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    },
  ];

  const insertSms = db.prepare(`
    INSERT INTO sms_logs (
      id, restaurantId, customerName, customerPhone, triggerType, message, provider, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of initialSmsLogs) {
    insertSms.run(
      s.id,
      s.restaurantId,
      s.customerName,
      s.customerPhone,
      s.triggerType,
      s.message,
      s.provider,
      s.status,
      s.createdAt
    );
  }

  // Seed Email Campaigns
  const initialCampaigns: EmailCampaign[] = [
    {
      id: "camp_1",
      restaurantId: "rest_bella_napoli",
      name: "Weekend Wood-Fired VIP Wine & Pizza Night",
      subject: "🍷 Complimentary Tiramisu + 15% Off Your Weekend Order at Bella Napoli",
      segment: "vip",
      promoCode: "NAPOLIVIP15",
      discountPercent: 15,
      bodyHtml:
        "<p>Ciao Famiglia! Enjoy 15% off your wood-fired pizza order this weekend using code <strong>NAPOLIVIP15</strong> at orders.bellanapoli.com.</p>",
      status: "sent",
      recipientCount: 148,
      openRate: 64.2,
      clickRate: 21.8,
      revenueGenerated: 2840.0,
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "camp_2",
      restaurantId: "rest_bella_napoli",
      name: "Autumn Truffle Pasta Launch Announcement",
      subject: "✨ Fresh Umbrian Black Truffle Season is Here at Bella Napoli",
      segment: "all",
      promoCode: "TRUFFLE10",
      discountPercent: 10,
      bodyHtml:
        "<p>Our hand-cut 40-yolk Tagliolini al Tartufo has arrived for a limited run. Order online before daily stock sells out!</p>",
      status: "sent",
      recipientCount: 412,
      openRate: 52.4,
      clickRate: 16.5,
      revenueGenerated: 4190.5,
      sentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "camp_3",
      restaurantId: "rest_sakura_omakase",
      name: "Bluefin Otoro Flight Weekend Drop",
      subject: "🍣 Fresh Toyosu Market Bluefin Otoro Has Landed",
      segment: "vip",
      promoCode: "OMAKASE10",
      discountPercent: 10,
      bodyHtml:
        "<p>Reserve your 12-Piece Chef's Omakase Box online tonight at eat.sakurasushi.io.</p>",
      status: "sent",
      recipientCount: 95,
      openRate: 71.0,
      clickRate: 29.4,
      revenueGenerated: 3120.0,
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const insertCampaign = db.prepare(`
    INSERT INTO email_campaigns (
      id, restaurantId, name, subject, segment, promoCode, discountPercent,
      bodyHtml, status, recipientCount, openRate, clickRate, revenueGenerated, sentAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of initialCampaigns) {
    insertCampaign.run(
      c.id,
      c.restaurantId,
      c.name,
      c.subject,
      c.segment,
      c.promoCode || null,
      c.discountPercent || null,
      c.bodyHtml,
      c.status,
      c.recipientCount,
      c.openRate,
      c.clickRate,
      c.revenueGenerated,
      c.sentAt
    );
  }
}

// Row mappers
function mapRestaurantRow(row: Record<string, unknown>): RestaurantTenant {
  const baseMeta = {
    name: String(row.name),
    slug: String(row.slug),
    tagline: String(row.tagline),
    cuisine: String(row.cuisine),
    description: String(row.description),
    ownerName: String(row.ownerName),
    ownerEmail: String(row.ownerEmail),
    phone: String(row.phone),
    address: String(row.address),
    customDomain: String(row.customDomain),
    heroBannerUrl: String(row.heroBannerUrl),
    prepTimeMinutes: Number(row.prepTimeMinutes),
    advanceNoticeDays: Number(row.advanceNoticeDays || 0),
    advanceNoticeHours: Number(row.advanceNoticeHours || 0),
  };

  const defaults = buildDefaultStorefrontPages(baseMeta);
  let storefrontPages: StorefrontPagesConfig = defaults;
  if (row.storefrontPagesJson && String(row.storefrontPagesJson).trim()) {
    try {
      const parsed = JSON.parse(
        String(row.storefrontPagesJson)
      ) as Partial<StorefrontPagesConfig>;
      storefrontPages = {
        ...defaults,
        ...parsed,
        about: { ...defaults.about, ...(parsed.about || {}) },
        privacyPolicy: {
          ...defaults.privacyPolicy,
          ...(parsed.privacyPolicy || {}),
        },
        termsAndConditions: {
          ...defaults.termsAndConditions,
          ...(parsed.termsAndConditions || {}),
        },
        orderingPolicy: {
          ...defaults.orderingPolicy,
          ...(parsed.orderingPolicy || {}),
        },
        footer: { ...defaults.footer, ...(parsed.footer || {}) },
      };
    } catch {
      storefrontPages = defaults;
    }
  }

  const invDefaults = buildDefaultInventoryConfig({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    cuisine: String(row.cuisine),
  });
  let inventoryConfig: RestaurantInventoryConfig = invDefaults;
  if (row.inventoryConfigJson && String(row.inventoryConfigJson).trim()) {
    try {
      const parsedInv = JSON.parse(
        String(row.inventoryConfigJson)
      ) as Partial<RestaurantInventoryConfig>;
      inventoryConfig = {
        ...invDefaults,
        ...parsedInv,
        items: Array.isArray(parsedInv.items)
          ? parsedInv.items
          : invDefaults.items,
        wasteLogs: Array.isArray(parsedInv.wasteLogs)
          ? parsedInv.wasteLogs
          : invDefaults.wasteLogs,
        shiftChecklist: Array.isArray(parsedInv.shiftChecklist)
          ? parsedInv.shiftChecklist
          : invDefaults.shiftChecklist,
      };
    } catch {
      inventoryConfig = invDefaults;
    }
  }

  const intDefaults = buildDefaultIntegrationsConfig({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    cuisine: String(row.cuisine),
    phone: String(row.phone),
  });
  let integrationsConfig: TenantIntegrationsConfig = intDefaults;
  if (
    row.integrationsConfigJson &&
    String(row.integrationsConfigJson).trim()
  ) {
    try {
      const parsedInt = JSON.parse(
        String(row.integrationsConfigJson)
      ) as Partial<TenantIntegrationsConfig>;
      integrationsConfig = {
        ...intDefaults,
        ...parsedInt,
        doordashDrive: {
          ...intDefaults.doordashDrive,
          ...(parsedInt.doordashDrive || {}),
        },
        square: {
          ...intDefaults.square,
          ...(parsedInt.square || {}),
        },
        clover: {
          ...intDefaults.clover,
          ...(parsedInt.clover || {}),
        },
        vapi: {
          ...intDefaults.vapi,
          ...(parsedInt.vapi || {}),
        },
        activityLogs: Array.isArray(parsedInt.activityLogs)
          ? parsedInt.activityLogs
          : intDefaults.activityLogs,
      };
    } catch {
      integrationsConfig = intDefaults;
    }
  }

  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    tagline: String(row.tagline),
    cuisine: String(row.cuisine),
    description: String(row.description),
    ownerName: String(row.ownerName),
    ownerEmail: String(row.ownerEmail),
    phone: String(row.phone),
    address: String(row.address),
    timezone: String(row.timezone),
    plan: row.plan as RestaurantTenant["plan"],
    status: row.status as RestaurantTenant["status"],
    customDomain: String(row.customDomain),
    subdomain: String(row.subdomain),
    domainVerified: Boolean(row.domainVerified),
    sslStatus: row.sslStatus as RestaurantTenant["sslStatus"],
    dnsTxtToken: String(row.dnsTxtToken),
    logoEmoji: String(row.logoEmoji),
    primaryColor: String(row.primaryColor),
    accentColor: String(row.accentColor),
    layoutStyle: row.layoutStyle as RestaurantTenant["layoutStyle"],
    heroBannerUrl: String(row.heroBannerUrl),
    customRequirementNotes: String(row.customRequirementNotes || ""),
    features: {
      doordashDrive: true,
      squarePos: true,
      cloverPos: true,
      vapiVoiceAi: true,
      ...JSON.parse(String(row.featuresJson)),
    },
    storefrontPages,
    inventoryConfig,
    integrationsConfig,
    orderingEnabled: Boolean(row.orderingEnabled),
    pauseReason: String(row.pauseReason || ""),
    maxOrdersPerHour: Number(row.maxOrdersPerHour),
    maxOrdersPerDay: Number(row.maxOrdersPerDay),
    minOrderAmount: Number(row.minOrderAmount),
    maxOrderAmount: Number(row.maxOrderAmount),
    prepTimeMinutes: Number(row.prepTimeMinutes),
    advanceNoticeDays: Number(row.advanceNoticeDays || 0),
    advanceNoticeHours: Number(row.advanceNoticeHours || 0),
    advanceNoticeNote: String(row.advanceNoticeNote || ""),
    autoPauseOnLimit: Boolean(row.autoPauseOnLimit),
    weeklySchedule: (
      JSON.parse(String(row.weeklyScheduleJson)) as DaySchedule[]
    ).map((d) => ({
      ...d,
      pickupEnabled: d.pickupEnabled ?? d.enabled,
      pickupStartTime: d.pickupStartTime || d.openTime || "11:00",
      pickupEndTime: d.pickupEndTime || d.closeTime || "21:30",
      pickupSlotIntervalMinutes: d.pickupSlotIntervalMinutes || 30,
      pickupSlotMaxOrders: d.pickupSlotMaxOrders ?? 5,
      customPickupSlots: Array.isArray(d.customPickupSlots)
        ? d.customPickupSlots
        : [],
      pickupSlotCapacities:
        d.pickupSlotCapacities && typeof d.pickupSlotCapacities === "object"
          ? d.pickupSlotCapacities
          : {},
    })),
    blackoutWindows: JSON.parse(String(row.blackoutWindowsJson)),
    paymentConfig: JSON.parse(String(row.paymentConfigJson)),
    commsConfig: JSON.parse(String(row.commsConfigJson)),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapMenuItemRow(row: Record<string, unknown>): MenuItem {
  const id = String(row.id);
  const restaurantId = String(row.restaurantId);
  const category = String(row.category);
  const parsedModifiers = JSON.parse(String(row.modifiersJson || "[]"));

  return {
    id,
    restaurantId,
    category,
    name: String(row.name),
    description: String(row.description),
    price: Number(row.price),
    imageUrl: String(row.imageUrl),
    available: Boolean(row.available),
    unavailableReason: String(row.unavailableReason || ""),
    dailyStockLimit:
      row.dailyStockLimit !== null && row.dailyStockLimit !== undefined
        ? Number(row.dailyStockLimit)
        : null,
    currentStockCount:
      row.currentStockCount !== null && row.currentStockCount !== undefined
        ? Number(row.currentStockCount)
        : null,
    popular: Boolean(row.popular),
    prepTimeMinutes: Number(row.prepTimeMinutes),
    dietaryTags: JSON.parse(String(row.dietaryTagsJson)),
    modifiers: ensureMenuItemVariantsAndSides(parsedModifiers, {
      id,
      category,
      restaurantId,
    }),
    sortOrder: Number(row.sortOrder),
  };
}

function mapCustomerRow(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    defaultAddress: String(row.defaultAddress || ""),
    totalOrders: Number(row.totalOrders),
    totalSpent: Number(row.totalSpent),
    loyaltyPoints: Number(row.loyaltyPoints),
    vipStatus: Boolean(row.vipStatus),
    smsOptIn: Boolean(row.smsOptIn),
    emailOptIn: Boolean(row.emailOptIn),
    tags: JSON.parse(String(row.tagsJson || "[]")),
    notes: String(row.notes || ""),
    lastOrderAt: row.lastOrderAt ? String(row.lastOrderAt) : null,
    createdAt: String(row.createdAt),
  };
}

function mapOrderRow(row: Record<string, unknown>): Order {
  let deliveryTracking: Order["deliveryTracking"] = undefined;
  if (row.deliveryTrackingJson && String(row.deliveryTrackingJson).trim()) {
    try {
      deliveryTracking = JSON.parse(String(row.deliveryTrackingJson));
    } catch {
      deliveryTracking = undefined;
    }
  }

  let posSync: Order["posSync"] = undefined;
  if (row.posSyncJson && String(row.posSyncJson).trim()) {
    try {
      posSync = JSON.parse(String(row.posSyncJson));
    } catch {
      posSync = undefined;
    }
  }

  return {
    id: String(row.id),
    orderNumber: String(row.orderNumber),
    restaurantId: String(row.restaurantId),
    customerId: row.customerId ? String(row.customerId) : null,
    customerName: String(row.customerName),
    customerEmail: String(row.customerEmail),
    customerPhone: String(row.customerPhone),
    orderType: row.orderType as Order["orderType"],
    tableNumber: row.tableNumber ? String(row.tableNumber) : undefined,
    deliveryAddress: row.deliveryAddress
      ? String(row.deliveryAddress)
      : undefined,
    items: JSON.parse(String(row.itemsJson)),
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    deliveryFee: Number(row.deliveryFee),
    tip: Number(row.tip),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.paymentMethod as Order["paymentMethod"],
    paymentStatus: row.paymentStatus as Order["paymentStatus"],
    paymentReference: String(row.paymentReference),
    status: row.status as Order["status"],
    specialInstructions: String(row.specialInstructions || ""),
    scheduledFor: row.scheduledFor ? String(row.scheduledFor) : undefined,
    deliveryTracking,
    posSync,
    createdAt: String(row.createdAt),
  };
}

function mapSmsRow(row: Record<string, unknown>): SmsLog {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId),
    customerName: String(row.customerName),
    customerPhone: String(row.customerPhone),
    triggerType: row.triggerType as SmsLog["triggerType"],
    message: String(row.message),
    provider: row.provider as SmsLog["provider"],
    status: row.status as SmsLog["status"],
    createdAt: String(row.createdAt),
  };
}

function mapCampaignRow(row: Record<string, unknown>): EmailCampaign {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId),
    name: String(row.name),
    subject: String(row.subject),
    segment: row.segment as EmailCampaign["segment"],
    promoCode: row.promoCode ? String(row.promoCode) : undefined,
    discountPercent:
      row.discountPercent !== null && row.discountPercent !== undefined
        ? Number(row.discountPercent)
        : undefined,
    bodyHtml: String(row.bodyHtml),
    status: row.status as EmailCampaign["status"],
    recipientCount: Number(row.recipientCount),
    openRate: Number(row.openRate),
    clickRate: Number(row.clickRate),
    revenueGenerated: Number(row.revenueGenerated),
    sentAt: String(row.sentAt),
  };
}

// Repository functions
export function listRestaurants(): RestaurantTenant[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM restaurants ORDER BY createdAt ASC")
    .all() as Record<string, unknown>[];
  return rows.map(mapRestaurantRow);
}

export function getRestaurantBySlugOrDomain(
  identifier: string
): RestaurantTenant | null {
  const db = getDb();
  const clean = identifier.trim().toLowerCase();
  const row = db
    .prepare(
      "SELECT * FROM restaurants WHERE LOWER(slug) = ? OR LOWER(customDomain) = ? OR LOWER(subdomain) = ? OR id = ? LIMIT 1"
    )
    .get(clean, clean, clean, identifier) as Record<string, unknown> | undefined;
  return row ? mapRestaurantRow(row) : null;
}

export function createRestaurantTenant(
  input: Partial<RestaurantTenant> & {
    name: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
  }
): RestaurantTenant {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `rest_${Date.now()}`;
  const slug = input.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  const newTenant: RestaurantTenant = {
    id,
    name: input.name,
    slug,
    tagline: input.tagline || `Freshly prepared ${input.cuisine || "cuisine"} made to order`,
    cuisine: input.cuisine || "Contemporary Kitchen",
    description:
      input.description ||
      `Welcome to ${input.name}! Order online directly from our kitchen for fast pickup or local delivery.`,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    phone: input.phone || "+1 (555) 234-5678",
    address: input.address || "100 Main Culinary Blvd",
    timezone: input.timezone || "America/Chicago",
    plan: input.plan || "growth",
    status: input.status || "active",
    customDomain:
      input.customDomain || `orders.${slug.replace(/-/g, "")}.com`,
    subdomain: `${slug}.platerift.app`,
    domainVerified: input.domainVerified ?? false,
    sslStatus: input.domainVerified ? "active" : "pending",
    dnsTxtToken: `platerift-verify=${Math.random().toString(36).substring(2, 12)}`,
    logoEmoji: input.logoEmoji || "🍽️",
    primaryColor: input.primaryColor || "#ea580c",
    accentColor: input.accentColor || "#fff7ed",
    layoutStyle: input.layoutStyle || "modern-grid",
    heroBannerUrl:
      input.heroBannerUrl ||
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
    customRequirementNotes: input.customRequirementNotes || "",
    features: input.features || {
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
    orderingEnabled: input.orderingEnabled ?? true,
    pauseReason: input.pauseReason || "",
    maxOrdersPerHour: input.maxOrdersPerHour ?? 25,
    maxOrdersPerDay: input.maxOrdersPerDay ?? 200,
    minOrderAmount: input.minOrderAmount ?? 15,
    maxOrderAmount: input.maxOrderAmount ?? 500,
    prepTimeMinutes: input.prepTimeMinutes ?? 20,
    advanceNoticeDays: input.advanceNoticeDays ?? 0,
    advanceNoticeHours: input.advanceNoticeHours ?? 0,
    advanceNoticeNote: input.advanceNoticeNote || "",
    autoPauseOnLimit: input.autoPauseOnLimit ?? true,
    weeklySchedule: input.weeklySchedule || defaultWeeklySchedule(),
    blackoutWindows: input.blackoutWindows || [],
    paymentConfig: input.paymentConfig || {
      mode: "simulated",
      currency: "USD",
      taxRatePercent: 8.5,
      deliveryFee: 4.99,
      freeDeliveryMin: 50,
      serviceFeePercent: 2.0,
      stripe: {
        enabled: true,
        accountId: `acct_${slug.replace(/-/g, "")}`,
        publishableKey: `pk_test_${slug.replace(/-/g, "")}`,
        secretKey: `sk_test_${slug.replace(/-/g, "")}`,
        webhookSecret: `whsec_${slug.replace(/-/g, "")}`,
      },
      paypal: {
        enabled: true,
        merchantEmail: input.ownerEmail,
        clientId: `AY_${slug.replace(/-/g, "")}_PayPal`,
        clientSecret: `EJ_${slug.replace(/-/g, "")}_Secret`,
      },
    },
    commsConfig: input.commsConfig || {
      sms: {
        enabled: true,
        mode: "simulated",
        provider: "twilio",
        twilioAccountSid: "AC_SIMULATED_TWILIO_SID",
        twilioAuthToken: "TWILIO_SIMULATED_TOKEN",
        senderPhone: "+15550009999",
        autoNotifyConfirmed: true,
        autoNotifyPreparing: true,
        autoNotifyReady: true,
        autoNotifyCancelled: true,
        templates: {
          confirmed: `🍽️ Hi {{customer_name}}! ${input.name} received your order #{{order_number}} ({{total}}). Est. prep: {{prep_time}} mins.`,
          preparing: `🔥 Good news {{customer_name}}! ${input.name} is now preparing your order #{{order_number}}.`,
          ready: `✅ Your order #{{order_number}} from ${input.name} is hot and ready!`,
          cancelled: `⚠️ Hi {{customer_name}}, your order #{{order_number}} at ${input.name} was cancelled and refunded.`,
        },
      },
      email: {
        enabled: true,
        mode: "simulated",
        provider: "resend",
        fromName: input.name,
        fromEmail: `hello@${input.customDomain || `orders.${slug}.com`}`,
        apiKeyOrSmtpHost: "re_simulated_key",
      },
    },
    createdAt: now,
    updatedAt: now,
  };

  newTenant.storefrontPages =
    input.storefrontPages || buildDefaultStorefrontPages(newTenant);
  newTenant.inventoryConfig =
    input.inventoryConfig || buildDefaultInventoryConfig(newTenant);
  newTenant.integrationsConfig =
    input.integrationsConfig || buildDefaultIntegrationsConfig(newTenant);

  db.prepare(`
    INSERT INTO restaurants (
      id, name, slug, tagline, cuisine, description, ownerName, ownerEmail, phone, address,
      timezone, plan, status, customDomain, subdomain, domainVerified, sslStatus, dnsTxtToken,
      logoEmoji, primaryColor, accentColor, layoutStyle, heroBannerUrl, customRequirementNotes,
      featuresJson, orderingEnabled, pauseReason, maxOrdersPerHour, maxOrdersPerDay,
      minOrderAmount, maxOrderAmount, prepTimeMinutes, advanceNoticeDays, advanceNoticeHours, advanceNoticeNote, autoPauseOnLimit,
      weeklyScheduleJson, blackoutWindowsJson, paymentConfigJson, commsConfigJson, storefrontPagesJson, inventoryConfigJson, integrationsConfigJson,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `).run(
    newTenant.id,
    newTenant.name,
    newTenant.slug,
    newTenant.tagline,
    newTenant.cuisine,
    newTenant.description,
    newTenant.ownerName,
    newTenant.ownerEmail,
    newTenant.phone,
    newTenant.address,
    newTenant.timezone,
    newTenant.plan,
    newTenant.status,
    newTenant.customDomain,
    newTenant.subdomain,
    newTenant.domainVerified ? 1 : 0,
    newTenant.sslStatus,
    newTenant.dnsTxtToken,
    newTenant.logoEmoji,
    newTenant.primaryColor,
    newTenant.accentColor,
    newTenant.layoutStyle,
    newTenant.heroBannerUrl,
    newTenant.customRequirementNotes,
    JSON.stringify(newTenant.features),
    newTenant.orderingEnabled ? 1 : 0,
    newTenant.pauseReason,
    newTenant.maxOrdersPerHour,
    newTenant.maxOrdersPerDay,
    newTenant.minOrderAmount,
    newTenant.maxOrderAmount,
    newTenant.prepTimeMinutes,
    newTenant.advanceNoticeDays,
    newTenant.advanceNoticeHours,
    newTenant.advanceNoticeNote,
    newTenant.autoPauseOnLimit ? 1 : 0,
    JSON.stringify(newTenant.weeklySchedule),
    JSON.stringify(newTenant.blackoutWindows),
    JSON.stringify(newTenant.paymentConfig),
    JSON.stringify(newTenant.commsConfig),
    JSON.stringify(newTenant.storefrontPages),
    JSON.stringify(newTenant.inventoryConfig),
    JSON.stringify(newTenant.integrationsConfig),
    newTenant.createdAt,
    newTenant.updatedAt
  );

  // Seed 3 starter menu items so the new restaurant immediately has a working storefront
  const starterItems: MenuItem[] = [
    {
      id: `item_${Date.now()}_1`,
      restaurantId: newTenant.id,
      category: "Signature Mains",
      name: `${newTenant.name} House Special`,
      description: `Chef ${newTenant.ownerName}'s signature dish prepared fresh to order with house-made sauces.`,
      price: 21.0,
      imageUrl:
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 50,
      currentStockCount: 50,
      popular: true,
      prepTimeMinutes: 15,
      dietaryTags: ["Chef Special", "Popular"],
      modifiers: [
        {
          name: "Preparation Style",
          required: true,
          options: [
            { label: "Standard House Style", priceDelta: 0 },
            { label: "Large Shareable Portion", priceDelta: 6.0 },
          ],
        },
      ],
      sortOrder: 1,
    },
    {
      id: `item_${Date.now()}_2`,
      restaurantId: newTenant.id,
      category: "Starters & Shareables",
      name: "Artisanal Crispy Appetizer Platter",
      description:
        "Golden crispy bites served with our signature herb aioli and house pickled vegetables.",
      price: 14.5,
      imageUrl:
        "https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 40,
      currentStockCount: 40,
      popular: true,
      prepTimeMinutes: 10,
      dietaryTags: ["Vegetarian"],
      modifiers: [],
      sortOrder: 2,
    },
    {
      id: `item_${Date.now()}_3`,
      restaurantId: newTenant.id,
      category: "Desserts & Drinks",
      name: "House Craft Dessert",
      description:
        "Decadent daily house-crafted sweet finish made in small batches.",
      price: 10.5,
      imageUrl:
        "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
      available: true,
      unavailableReason: "",
      dailyStockLimit: 25,
      currentStockCount: 25,
      popular: false,
      prepTimeMinutes: 5,
      dietaryTags: ["Vegetarian"],
      modifiers: [],
      sortOrder: 3,
    },
  ];

  for (const m of starterItems) {
    createMenuItem(m);
  }

  // Automatically provision the Restaurant Owner user account for this new tenant
  createUserAccount({
    scope: "restaurant",
    restaurantId: newTenant.id,
    name: newTenant.ownerName,
    email: newTenant.ownerEmail,
    phone: newTenant.phone,
    role: "restaurant_owner",
    status: "active",
    title: "Restaurant Owner & Proprietor",
  });

  return newTenant;
}

export function updateRestaurantTenant(
  idOrSlug: string,
  updates: Partial<RestaurantTenant>
): RestaurantTenant | null {
  const db = getDb();
  const existing = getRestaurantBySlugOrDomain(idOrSlug);
  if (!existing) return null;

  const merged: RestaurantTenant = {
    ...existing,
    ...updates,
    features: updates.features
      ? { ...existing.features, ...updates.features }
      : existing.features,
    paymentConfig: updates.paymentConfig
      ? {
          ...existing.paymentConfig,
          ...updates.paymentConfig,
          stripe: {
            ...existing.paymentConfig.stripe,
            ...(updates.paymentConfig.stripe || {}),
          },
          paypal: {
            ...existing.paymentConfig.paypal,
            ...(updates.paymentConfig.paypal || {}),
          },
        }
      : existing.paymentConfig,
    commsConfig: updates.commsConfig
      ? {
          ...existing.commsConfig,
          ...updates.commsConfig,
          sms: {
            ...existing.commsConfig.sms,
            ...(updates.commsConfig.sms || {}),
            templates: {
              ...existing.commsConfig.sms.templates,
              ...(updates.commsConfig.sms?.templates || {}),
            },
          },
          email: {
            ...existing.commsConfig.email,
            ...(updates.commsConfig.email || {}),
          },
        }
      : existing.commsConfig,
    storefrontPages: updates.storefrontPages
      ? {
          ...(existing.storefrontPages ||
            buildDefaultStorefrontPages(existing)),
          ...updates.storefrontPages,
          about: {
            ...(
              existing.storefrontPages ||
              buildDefaultStorefrontPages(existing)
            ).about,
            ...(updates.storefrontPages.about || {}),
          },
          privacyPolicy: {
            ...(
              existing.storefrontPages ||
              buildDefaultStorefrontPages(existing)
            ).privacyPolicy,
            ...(updates.storefrontPages.privacyPolicy || {}),
          },
          termsAndConditions: {
            ...(
              existing.storefrontPages ||
              buildDefaultStorefrontPages(existing)
            ).termsAndConditions,
            ...(updates.storefrontPages.termsAndConditions || {}),
          },
          orderingPolicy: {
            ...(
              existing.storefrontPages ||
              buildDefaultStorefrontPages(existing)
            ).orderingPolicy,
            ...(updates.storefrontPages.orderingPolicy || {}),
          },
          footer: {
            ...(
              existing.storefrontPages ||
              buildDefaultStorefrontPages(existing)
            ).footer,
            ...(updates.storefrontPages.footer || {}),
          },
        }
      : existing.storefrontPages || buildDefaultStorefrontPages(existing),
    inventoryConfig: updates.inventoryConfig
      ? {
          ...(existing.inventoryConfig ||
            buildDefaultInventoryConfig(existing)),
          ...updates.inventoryConfig,
        }
      : existing.inventoryConfig || buildDefaultInventoryConfig(existing),
    integrationsConfig: updates.integrationsConfig
      ? {
          ...(existing.integrationsConfig ||
            buildDefaultIntegrationsConfig(existing)),
          ...updates.integrationsConfig,
          doordashDrive: {
            ...(
              existing.integrationsConfig ||
              buildDefaultIntegrationsConfig(existing)
            ).doordashDrive,
            ...(updates.integrationsConfig.doordashDrive || {}),
          },
          square: {
            ...(
              existing.integrationsConfig ||
              buildDefaultIntegrationsConfig(existing)
            ).square,
            ...(updates.integrationsConfig.square || {}),
          },
          clover: {
            ...(
              existing.integrationsConfig ||
              buildDefaultIntegrationsConfig(existing)
            ).clover,
            ...(updates.integrationsConfig.clover || {}),
          },
          vapi: {
            ...(
              existing.integrationsConfig ||
              buildDefaultIntegrationsConfig(existing)
            ).vapi,
            ...(updates.integrationsConfig.vapi || {}),
          },
          activityLogs:
            updates.integrationsConfig.activityLogs ||
            (
              existing.integrationsConfig ||
              buildDefaultIntegrationsConfig(existing)
            ).activityLogs,
        }
      : existing.integrationsConfig || buildDefaultIntegrationsConfig(existing),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE restaurants SET
      name = ?, tagline = ?, cuisine = ?, description = ?,
      ownerName = ?, ownerEmail = ?, phone = ?, address = ?,
      timezone = ?, plan = ?, status = ?, customDomain = ?,
      domainVerified = ?, sslStatus = ?, logoEmoji = ?,
      primaryColor = ?, accentColor = ?, layoutStyle = ?,
      heroBannerUrl = ?, customRequirementNotes = ?,
      featuresJson = ?, orderingEnabled = ?, pauseReason = ?,
      maxOrdersPerHour = ?, maxOrdersPerDay = ?, minOrderAmount = ?,
      maxOrderAmount = ?, prepTimeMinutes = ?, advanceNoticeDays = ?,
      advanceNoticeHours = ?, advanceNoticeNote = ?, autoPauseOnLimit = ?,
      weeklyScheduleJson = ?, blackoutWindowsJson = ?,
      paymentConfigJson = ?, commsConfigJson = ?, storefrontPagesJson = ?, inventoryConfigJson = ?, integrationsConfigJson = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    merged.name,
    merged.tagline,
    merged.cuisine,
    merged.description,
    merged.ownerName,
    merged.ownerEmail,
    merged.phone,
    merged.address,
    merged.timezone,
    merged.plan,
    merged.status,
    merged.customDomain,
    merged.domainVerified ? 1 : 0,
    merged.sslStatus,
    merged.logoEmoji,
    merged.primaryColor,
    merged.accentColor,
    merged.layoutStyle,
    merged.heroBannerUrl,
    merged.customRequirementNotes,
    JSON.stringify(merged.features),
    merged.orderingEnabled ? 1 : 0,
    merged.pauseReason,
    merged.maxOrdersPerHour,
    merged.maxOrdersPerDay,
    merged.minOrderAmount,
    merged.maxOrderAmount,
    merged.prepTimeMinutes,
    merged.advanceNoticeDays ?? 0,
    merged.advanceNoticeHours ?? 0,
    merged.advanceNoticeNote || "",
    merged.autoPauseOnLimit ? 1 : 0,
    JSON.stringify(merged.weeklySchedule),
    JSON.stringify(merged.blackoutWindows),
    JSON.stringify(merged.paymentConfig),
    JSON.stringify(merged.commsConfig),
    JSON.stringify(merged.storefrontPages),
    JSON.stringify(merged.inventoryConfig),
    JSON.stringify(merged.integrationsConfig),
    merged.updatedAt,
    existing.id
  );

  return getRestaurantBySlugOrDomain(existing.id);
}

// Menu Items
export function listMenuItems(restaurantId: string): MenuItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM menu_items WHERE restaurantId = ? ORDER BY sortOrder ASC, name ASC"
    )
    .all(restaurantId) as Record<string, unknown>[];
  return rows.map(mapMenuItemRow);
}

export function createMenuItem(
  input: Partial<MenuItem> & {
    restaurantId: string;
    name: string;
    category: string;
    price: number;
  }
): MenuItem {
  const db = getDb();
  const item: MenuItem = {
    id: input.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    restaurantId: input.restaurantId,
    category: input.category,
    name: input.name,
    description: input.description || "",
    price: Number(input.price),
    imageUrl:
      input.imageUrl ||
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    available: input.available ?? true,
    unavailableReason: input.unavailableReason || "",
    dailyStockLimit: input.dailyStockLimit ?? null,
    currentStockCount: input.currentStockCount ?? input.dailyStockLimit ?? null,
    popular: input.popular ?? false,
    prepTimeMinutes: input.prepTimeMinutes ?? 15,
    dietaryTags: input.dietaryTags || [],
    modifiers: ensureMenuItemVariantsAndSides(input.modifiers, {
      id: input.id,
      category: input.category,
      restaurantId: input.restaurantId,
    }),
    sortOrder: input.sortOrder ?? 10,
  };

  db.prepare(`
    INSERT INTO menu_items (
      id, restaurantId, category, name, description, price, imageUrl,
      available, unavailableReason, dailyStockLimit, currentStockCount,
      popular, prepTimeMinutes, dietaryTagsJson, modifiersJson, sortOrder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.restaurantId,
    item.category,
    item.name,
    item.description,
    item.price,
    item.imageUrl,
    item.available ? 1 : 0,
    item.unavailableReason,
    item.dailyStockLimit,
    item.currentStockCount,
    item.popular ? 1 : 0,
    item.prepTimeMinutes,
    JSON.stringify(item.dietaryTags),
    JSON.stringify(item.modifiers),
    item.sortOrder
  );

  return item;
}

export function updateMenuItem(
  itemId: string,
  updates: Partial<MenuItem>
): MenuItem | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM menu_items WHERE id = ?")
    .get(itemId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const existing = mapMenuItemRow(row);
  const merged: MenuItem = {
    ...existing,
    ...updates,
  };

  db.prepare(`
    UPDATE menu_items SET
      category = ?, name = ?, description = ?, price = ?, imageUrl = ?,
      available = ?, unavailableReason = ?, dailyStockLimit = ?, currentStockCount = ?,
      popular = ?, prepTimeMinutes = ?, dietaryTagsJson = ?, modifiersJson = ?, sortOrder = ?
    WHERE id = ?
  `).run(
    merged.category,
    merged.name,
    merged.description,
    merged.price,
    merged.imageUrl,
    merged.available ? 1 : 0,
    merged.unavailableReason,
    merged.dailyStockLimit,
    merged.currentStockCount,
    merged.popular ? 1 : 0,
    merged.prepTimeMinutes,
    JSON.stringify(merged.dietaryTags),
    JSON.stringify(merged.modifiers),
    merged.sortOrder,
    itemId
  );

  // If availability changed (86'd or restored), push 2-way inventory sync event to Square / Clover if active
  if (existing.available !== merged.available) {
    const restRow = db
      .prepare("SELECT * FROM restaurants WHERE id = ?")
      .get(merged.restaurantId) as Record<string, unknown> | undefined;
    if (restRow) {
      const rest = mapRestaurantRow(restRow);
      const intCfg =
        rest.integrationsConfig || buildDefaultIntegrationsConfig(rest);
      const now = new Date().toISOString();
      const nextLogs = [...(intCfg.activityLogs || [])];
      let synced = false;

      if (intCfg.square.enabled && intCfg.square.autoSyncCatalogAndStock) {
        nextLogs.unshift({
          id: `ilog_sq_86_${Date.now()}`,
          integration: "square",
          action: merged.available
            ? `2-Way Stock Restored: ${merged.name}`
            : `2-Way 86'd Sync: ${merged.name}`,
          status: "success",
          summary: merged.available
            ? `Restored "${merged.name}" as IN_STOCK across Square POS register & web storefront.`
            : `Marked "${merged.name}" SOLD_OUT across Square POS register & web storefront (${merged.unavailableReason || "86'd"}).`,
          createdAt: now,
        });
        intCfg.square.lastSyncedAt = now;
        synced = true;
      }
      if (intCfg.clover.enabled && intCfg.clover.autoSyncMenuAndStock) {
        nextLogs.unshift({
          id: `ilog_clv_86_${Date.now() + 1}`,
          integration: "clover",
          action: merged.available
            ? `Clover Item Stock Restored: ${merged.name}`
            : `Clover Item 86'd Sync: ${merged.name}`,
          status: "success",
          summary: merged.available
            ? `Synced "${merged.name}" stock count (${merged.currentStockCount ?? "Available"}) to Clover Station.`
            : `Pushed 0 stock / 86'd state for "${merged.name}" to Clover Station & Kitchen KDS.`,
          createdAt: now,
        });
        intCfg.clover.lastSyncedAt = now;
        synced = true;
      }

      if (synced) {
        updateRestaurantTenant(rest.id, {
          integrationsConfig: {
            ...intCfg,
            activityLogs: nextLogs.slice(0, 30),
          },
        });
      }
    }
  }

  return merged;
}

export function deleteMenuItem(itemId: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM menu_items WHERE id = ?").run(itemId);
  return res.changes > 0;
}

// Customers
export function listCustomers(restaurantId: string): Customer[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM customers WHERE restaurantId = ? ORDER BY totalSpent DESC, createdAt DESC"
    )
    .all(restaurantId) as Record<string, unknown>[];
  return rows.map(mapCustomerRow);
}

export function createOrUpdateCustomerFromOrder(
  restaurantId: string,
  name: string,
  email: string,
  phone: string,
  orderTotal: number
): Customer {
  const db = getDb();
  const now = new Date().toISOString();
  const existingRow = db
    .prepare(
      "SELECT * FROM customers WHERE restaurantId = ? AND (LOWER(email) = LOWER(?) OR phone = ?) LIMIT 1"
    )
    .get(restaurantId, email, phone) as Record<string, unknown> | undefined;

  if (existingRow) {
    const existing = mapCustomerRow(existingRow);
    const newOrders = existing.totalOrders + 1;
    const newSpent = Number((existing.totalSpent + orderTotal).toFixed(2));
    const newPoints = existing.loyaltyPoints + Math.round(orderTotal);
    const isVip = existing.vipStatus || newSpent >= 250 || newOrders >= 8;

    db.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, totalOrders = ?, totalSpent = ?,
        loyaltyPoints = ?, vipStatus = ?, lastOrderAt = ?
      WHERE id = ?
    `).run(
      name || existing.name,
      phone || existing.phone,
      newOrders,
      newSpent,
      newPoints,
      isVip ? 1 : 0,
      now,
      existing.id
    );

    return {
      ...existing,
      name: name || existing.name,
      phone: phone || existing.phone,
      totalOrders: newOrders,
      totalSpent: newSpent,
      loyaltyPoints: newPoints,
      vipStatus: isVip,
      lastOrderAt: now,
    };
  }

  const newCustomer: Customer = {
    id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    restaurantId,
    name,
    email,
    phone,
    totalOrders: 1,
    totalSpent: Number(orderTotal.toFixed(2)),
    loyaltyPoints: Math.round(orderTotal),
    vipStatus: orderTotal >= 200,
    smsOptIn: true,
    emailOptIn: true,
    tags: ["Online Customer"],
    notes: "",
    lastOrderAt: now,
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO customers (
      id, restaurantId, name, email, phone, totalOrders, totalSpent,
      loyaltyPoints, vipStatus, smsOptIn, emailOptIn, tagsJson, notes, lastOrderAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newCustomer.id,
    newCustomer.restaurantId,
    newCustomer.name,
    newCustomer.email,
    newCustomer.phone,
    newCustomer.totalOrders,
    newCustomer.totalSpent,
    newCustomer.loyaltyPoints,
    newCustomer.vipStatus ? 1 : 0,
    1,
    1,
    JSON.stringify(newCustomer.tags),
    newCustomer.notes,
    newCustomer.lastOrderAt,
    newCustomer.createdAt
  );

  return newCustomer;
}

export function createCustomerManual(
  input: Partial<Customer> & {
    restaurantId: string;
    name: string;
    email: string;
    phone: string;
  }
): Customer {
  const db = getDb();
  const now = new Date().toISOString();
  const cust: Customer = {
    id: `cust_${Date.now()}`,
    restaurantId: input.restaurantId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    totalOrders: input.totalOrders ?? 0,
    totalSpent: input.totalSpent ?? 0,
    loyaltyPoints: input.loyaltyPoints ?? 50,
    vipStatus: input.vipStatus ?? false,
    smsOptIn: input.smsOptIn ?? true,
    emailOptIn: input.emailOptIn ?? true,
    tags: input.tags || ["Manual Entry"],
    notes: input.notes || "",
    lastOrderAt: null,
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO customers (
      id, restaurantId, name, email, phone, totalOrders, totalSpent,
      loyaltyPoints, vipStatus, smsOptIn, emailOptIn, tagsJson, notes, lastOrderAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cust.id,
    cust.restaurantId,
    cust.name,
    cust.email,
    cust.phone,
    cust.totalOrders,
    cust.totalSpent,
    cust.loyaltyPoints,
    cust.vipStatus ? 1 : 0,
    cust.smsOptIn ? 1 : 0,
    cust.emailOptIn ? 1 : 0,
    JSON.stringify(cust.tags),
    cust.notes,
    cust.lastOrderAt,
    cust.createdAt
  );

  return cust;
}

// Orders & Automated SMS Dispatch (Powered by Super Admin Platform Twilio Gateway)
function renderSmsTemplate(
  template: string,
  vars: {
    customer_name: string;
    order_number: string;
    total: string;
    prep_time: string;
    restaurant_name: string;
    order_type?: string;
    owner_name?: string;
  }
): string {
  return template
    .replace(/\{\{customer_name\}\}/g, vars.customer_name)
    .replace(/\{\{order_number\}\}/g, vars.order_number)
    .replace(/\{\{total\}\}/g, vars.total)
    .replace(/\{\{prep_time\}\}/g, vars.prep_time)
    .replace(/\{\{restaurant_name\}\}/g, vars.restaurant_name)
    .replace(/\{\{order_type\}\}/g, vars.order_type || "ORDER")
    .replace(/\{\{owner_name\}\}/g, vars.owner_name || "Owner");
}

export function getPlatformTwilioConfig(): PlatformTwilioConfig {
  const db = getDb();
  const row = db
    .prepare("SELECT valueJson FROM platform_settings WHERE key = 'twilio_gateway'")
    .get() as { valueJson: string } | undefined;

  if (row) {
    try {
      return JSON.parse(row.valueJson) as PlatformTwilioConfig;
    } catch {
      // Fallback to default
    }
  }

  const defaultConfig: PlatformTwilioConfig = {
    enabled: true,
    mode: "simulated",
    provider: "twilio",
    accountSid: "AC_PLATERIFT_SUPERADMIN_MASTER_99281A",
    authToken: "platerift_master_twilio_token_live_8812",
    messagingServiceSid: "MG_PLATERIFT_GLOBAL_POOL_7741",
    senderPhone: "+1 (888) 555-0100",
    notifyRestaurantOwnersOnNewOrder: true,
    notifyCustomersOnOrderEvents: true,
    ownerNewOrderTemplate:
      "🔔 [Platerift Order Alert — {{restaurant_name}}] New {{order_type}} Order #{{order_number}} ({{total}}) placed by {{customer_name}}. Open your Owner Portal to start preparing!",
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT OR REPLACE INTO platform_settings (key, valueJson) VALUES ('twilio_gateway', ?)"
  ).run(JSON.stringify(defaultConfig));

  return defaultConfig;
}

export function updatePlatformTwilioConfig(
  updates: Partial<PlatformTwilioConfig>
): PlatformTwilioConfig {
  const db = getDb();
  const current = getPlatformTwilioConfig();
  const merged: PlatformTwilioConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT OR REPLACE INTO platform_settings (key, valueJson) VALUES ('twilio_gateway', ?)"
  ).run(JSON.stringify(merged));

  return merged;
}

export function getPlatformIntegrationsConfig(): PlatformIntegrationsConfig {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT valueJson FROM platform_settings WHERE key = 'platform_integrations'"
    )
    .get() as { valueJson: string } | undefined;

  const fallback = buildDefaultPlatformIntegrationsConfig();
  if (row?.valueJson) {
    try {
      const parsed = JSON.parse(row.valueJson) as Partial<PlatformIntegrationsConfig>;
      return {
        doordashDrive: {
          ...fallback.doordashDrive,
          ...(parsed.doordashDrive || {}),
        },
        square: {
          ...fallback.square,
          ...(parsed.square || {}),
        },
        clover: {
          ...fallback.clover,
          ...(parsed.clover || {}),
        },
        vapi: {
          ...fallback.vapi,
          ...(parsed.vapi || {}),
        },
        updatedAt: parsed.updatedAt || fallback.updatedAt,
      };
    } catch {
      // Fall through to default
    }
  }

  db.prepare(
    "INSERT OR REPLACE INTO platform_settings (key, valueJson) VALUES ('platform_integrations', ?)"
  ).run(JSON.stringify(fallback));

  return fallback;
}

export function updatePlatformIntegrationsConfig(
  updates: Partial<PlatformIntegrationsConfig>
): PlatformIntegrationsConfig {
  const db = getDb();
  const current = getPlatformIntegrationsConfig();
  const merged: PlatformIntegrationsConfig = {
    doordashDrive: {
      ...current.doordashDrive,
      ...(updates.doordashDrive || {}),
    },
    square: {
      ...current.square,
      ...(updates.square || {}),
    },
    clover: {
      ...current.clover,
      ...(updates.clover || {}),
    },
    vapi: {
      ...current.vapi,
      ...(updates.vapi || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT OR REPLACE INTO platform_settings (key, valueJson) VALUES ('platform_integrations', ?)"
  ).run(JSON.stringify(merged));

  return merged;
}

export function listAllPlatformSmsLogs(limit = 50): SmsLog[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM sms_logs ORDER BY createdAt DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapSmsRow);
}

export function listOrders(restaurantId: string): Order[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM orders WHERE restaurantId = ? ORDER BY createdAt DESC"
    )
    .all(restaurantId) as Record<string, unknown>[];
  return rows.map(mapOrderRow);
}

export function updateOrderIntegrationFields(
  orderId: string,
  patch: {
    deliveryTracking?: Order["deliveryTracking"];
    posSync?: Order["posSync"];
  }
): Order | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const existing = mapOrderRow(row);
  const nextDelivery =
    patch.deliveryTracking !== undefined
      ? patch.deliveryTracking
      : existing.deliveryTracking;
  const nextPosSync =
    patch.posSync !== undefined
      ? { ...(existing.posSync || {}), ...patch.posSync }
      : existing.posSync;

  db.prepare(
    "UPDATE orders SET deliveryTrackingJson = ?, posSyncJson = ? WHERE id = ?"
  ).run(
    nextDelivery ? JSON.stringify(nextDelivery) : "",
    nextPosSync ? JSON.stringify(nextPosSync) : "",
    orderId
  );

  const updatedRow = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown>;
  return mapOrderRow(updatedRow);
}

export function createOrder(
  input: Omit<Order, "id" | "orderNumber" | "createdAt" | "customerId">
): { order: Order; smsSent: SmsLog | null; ownerSmsSent?: SmsLog | null } {
  const db = getDb();
  const restaurant = getRestaurantBySlugOrDomain(input.restaurantId);
  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  const customer = createOrUpdateCustomerFromOrder(
    restaurant.id,
    input.customerName,
    input.customerEmail,
    input.customerPhone,
    input.total
  );

  const prefix = restaurant.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const orderNumber = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  // Compute earliest ready timestamp if the restaurant requires advance notice (days/hours)
  let computedScheduledFor = input.scheduledFor;
  const reqDays = Number(restaurant.advanceNoticeDays || 0);
  const reqHours = Number(restaurant.advanceNoticeHours || 0);
  if (!computedScheduledFor && (reqDays > 0 || reqHours > 0)) {
    const totalLeadMs =
      (reqDays * 24 * 60 + reqHours * 60 + (restaurant.prepTimeMinutes || 0)) *
      60 *
      1000;
    const readyDate = new Date(Date.now() + totalLeadMs);
    const yyyy = readyDate.getFullYear();
    const mm = String(readyDate.getMonth() + 1).padStart(2, "0");
    const dd = String(readyDate.getDate()).padStart(2, "0");
    const hh = String(readyDate.getHours()).padStart(2, "0");
    const min = String(readyDate.getMinutes()).padStart(2, "0");
    computedScheduledFor = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  const intCfg =
    restaurant.integrationsConfig || buildDefaultIntegrationsConfig(restaurant);
  const platformInt = getPlatformIntegrationsConfig();

  const doordashAllowed =
    platformInt.doordashDrive.setupCompleted &&
    platformInt.doordashDrive.availableToOwners &&
    restaurant.features.doordashDrive !== false;
  const squareAllowed =
    platformInt.square.setupCompleted &&
    platformInt.square.availableToOwners &&
    restaurant.features.squarePos !== false;
  const cloverAllowed =
    platformInt.clover.setupCompleted &&
    platformInt.clover.availableToOwners &&
    restaurant.features.cloverPos !== false;

  // Auto-dispatch DoorDash Drive Dasher if enabled for delivery orders
  const autoDeliveryTracking =
    input.deliveryTracking ||
    (input.orderType === "delivery" &&
    doordashAllowed &&
    intCfg.doordashDrive.enabled &&
    intCfg.doordashDrive.autoDispatchOnConfirm
      ? buildSimulatedDoorDashTracking({
          orderNumber,
          orderSubtotal: input.subtotal,
          config: intCfg.doordashDrive,
          stage: "dasher_confirmed",
        })
      : undefined);

  // Auto-push to Square POS / Clover Kitchen KDS if enabled
  const shouldAutoPushSquare =
    squareAllowed && intCfg.square.enabled && intCfg.square.autoPushOrdersToPos;
  const shouldAutoPushClover =
    cloverAllowed &&
    intCfg.clover.enabled &&
    intCfg.clover.autoPushOrdersToKitchenKds;

  const autoPosSync: Order["posSync"] = {
    sourceChannel: input.posSync?.sourceChannel || "web_storefront",
    ...(shouldAutoPushSquare
      ? {
          squareOrderId: `sq_ord_${orderNumber.toLowerCase()}`,
          squareSyncedAt: now,
        }
      : {}),
    ...(shouldAutoPushClover
      ? {
          cloverOrderId: `clv_ord_${orderNumber.toLowerCase()}`,
          cloverSyncedAt: now,
        }
      : {}),
    ...(input.posSync || {}),
  };

  // Record integration activity logs on the tenant when auto-dispatch or POS auto-push fires
  const newActivityLogs = [...(intCfg.activityLogs || [])];
  let intLogsAdded = false;
  if (autoDeliveryTracking && !input.deliveryTracking) {
    newActivityLogs.unshift({
      id: `ilog_dd_${Date.now()}`,
      integration: "doordash_drive",
      action: `Auto-Dispatched Dasher (${orderNumber})`,
      status: "success",
      summary: `Assigned ${autoDeliveryTracking.dasherName} (${autoDeliveryTracking.dasherVehicle}) for delivery to ${input.deliveryAddress || "customer"} — ETA ${autoDeliveryTracking.dropoffEtaMinutes} mins.`,
      createdAt: now,
    });
    intLogsAdded = true;
  }
  if (shouldAutoPushSquare && autoPosSync.squareOrderId) {
    newActivityLogs.unshift({
      id: `ilog_sq_${Date.now() + 1}`,
      integration: "square",
      action: `Order Pushed to Square POS (${orderNumber})`,
      status: "success",
      summary: `Created Square Order ${autoPosSync.squareOrderId} ($${input.total.toFixed(2)}) for ${input.customerName}.`,
      createdAt: now,
    });
    intLogsAdded = true;
  }
  if (shouldAutoPushClover && autoPosSync.cloverOrderId) {
    newActivityLogs.unshift({
      id: `ilog_clv_${Date.now() + 2}`,
      integration: "clover",
      action: `Ticket Printed on Clover KDS (${orderNumber})`,
      status: "success",
      summary: `Fired Clover Kitchen Order ${autoPosSync.cloverOrderId} (${input.items.length} item${input.items.length === 1 ? "" : "s"}) to station printer.`,
      createdAt: now,
    });
    intLogsAdded = true;
  }
  if (intLogsAdded) {
    updateRestaurantTenant(restaurant.id, {
      integrationsConfig: {
        ...intCfg,
        activityLogs: newActivityLogs.slice(0, 30),
      },
    });
  }

  const order: Order = {
    ...input,
    id: `ord_${Date.now()}`,
    orderNumber,
    restaurantId: restaurant.id,
    customerId: customer.id,
    scheduledFor: computedScheduledFor,
    deliveryTracking: autoDeliveryTracking,
    posSync: autoPosSync,
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO orders (
      id, orderNumber, restaurantId, customerId, customerName, customerEmail,
      customerPhone, orderType, tableNumber, deliveryAddress, itemsJson,
      subtotal, tax, deliveryFee, tip, discount, total, paymentMethod,
      paymentStatus, paymentReference, status, specialInstructions, scheduledFor,
      deliveryTrackingJson, posSyncJson, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.orderNumber,
    order.restaurantId,
    order.customerId,
    order.customerName,
    order.customerEmail,
    order.customerPhone,
    order.orderType,
    order.tableNumber || null,
    order.deliveryAddress || null,
    JSON.stringify(order.items),
    order.subtotal,
    order.tax,
    order.deliveryFee,
    order.tip,
    order.discount,
    order.total,
    order.paymentMethod,
    order.paymentStatus,
    order.paymentReference,
    order.status,
    order.specialInstructions || "",
    order.scheduledFor || null,
    order.deliveryTracking ? JSON.stringify(order.deliveryTracking) : "",
    order.posSync ? JSON.stringify(order.posSync) : "",
    order.createdAt
  );

  // Decrement stock counts on ordered items (applying Variant Portion Multipliers & Shared Ingredient Pool deduction)
  const invConfig =
    restaurant.inventoryConfig || buildDefaultInventoryConfig(restaurant);
  let invChanged = false;
  const updatedInvItems = [...invConfig.items];

  for (const line of order.items) {
    // Check if the customer chose a Large / Grande / Shareable / Double variant that consumes 2x portion stock
    const hasDoublePortionVariant = (line.selectedModifiers || []).some((m) => {
      const lbl = m.optionLabel.toLowerCase();
      return (
        lbl.includes("grande") ||
        lbl.includes("shareable") ||
        lbl.includes("double") ||
        lbl.includes("famiglia") ||
        lbl.includes("imperial")
      );
    });
    const portionUnitsUsed = line.quantity * (hasDoublePortionVariant ? 2 : 1);

    const itemRow = db
      .prepare("SELECT * FROM menu_items WHERE id = ?")
      .get(line.menuItemId) as Record<string, unknown> | undefined;
    if (itemRow) {
      const mItem = mapMenuItemRow(itemRow);
      if (mItem.currentStockCount !== null) {
        const nextStock = Math.max(
          0,
          mItem.currentStockCount - portionUnitsUsed
        );
        updateMenuItem(mItem.id, {
          currentStockCount: nextStock,
          available: nextStock > 0 ? mItem.available : false,
          unavailableReason:
            nextStock === 0
              ? "Auto-marked unavailable: Daily stock limit sold out"
              : mItem.unavailableReason,
        });
      }
    }

    // Deduct from linked Shared Ingredients / Packaging in Inventory Config
    if (invConfig.autoDeductOnOrder) {
      for (let i = 0; i < updatedInvItems.length; i++) {
        const inv = updatedInvItems[i];
        if (inv.linkedMenuItemIds.includes(line.menuItemId)) {
          const nextInvStock = Math.max(
            0,
            inv.currentStock - portionUnitsUsed
          );
          if (nextInvStock !== inv.currentStock) {
            updatedInvItems[i] = { ...inv, currentStock: nextInvStock };
            invChanged = true;
          }
          // If this shared ingredient hit 0 and auto86LinkedDishes is enabled, 86 all linked menu items
          if (nextInvStock === 0 && inv.auto86LinkedDishes) {
            for (const linkedId of inv.linkedMenuItemIds) {
              updateMenuItem(linkedId, {
                available: false,
                currentStockCount: 0,
                unavailableReason: `86'd — Shared ingredient (${inv.name}) sold out for today`,
              });
            }
          }
        }
      }
    }
  }

  if (invChanged) {
    updateRestaurantTenant(restaurant.id, {
      inventoryConfig: {
        ...invConfig,
        items: updatedInvItems,
      },
    });
  }

  // Central Super Admin Platform Twilio Gateway Dispatch
  const platformTwilio = getPlatformTwilioConfig();
  const providerMode =
    platformTwilio.mode === "live" ? "twilio_live" : "twilio_simulated";

  let ownerSmsSent: SmsLog | null = null;
  let smsSent: SmsLog | null = null;

  if (platformTwilio.enabled) {
    // 1. Instant SMS Order Notification to the Restaurant Owner
    const ownerAlertEnabled =
      restaurant.commsConfig.sms.ownerAlertEnabled ?? true;
    if (platformTwilio.notifyRestaurantOwnersOnNewOrder && ownerAlertEnabled) {
      const ownerTargetPhone =
        restaurant.commsConfig.sms.ownerAlertPhone || restaurant.phone;
      const ownerMsg = renderSmsTemplate(platformTwilio.ownerNewOrderTemplate, {
        customer_name: order.customerName,
        order_number: order.orderNumber,
        total: `$${order.total.toFixed(2)}`,
        prep_time: String(restaurant.prepTimeMinutes),
        restaurant_name: restaurant.name,
        order_type: order.orderType.replace("_", " ").toUpperCase(),
        owner_name: restaurant.ownerName,
      });

      ownerSmsSent = createSmsLog({
        restaurantId: restaurant.id,
        customerName: `${restaurant.ownerName} (Restaurant Owner)`,
        customerPhone: ownerTargetPhone,
        triggerType: "owner_new_order_alert",
        message: ownerMsg,
        provider: providerMode,
      });
    }

    // 2. Instant SMS Order Confirmation to the Customer
    if (
      platformTwilio.notifyCustomersOnOrderEvents &&
      restaurant.commsConfig.sms.enabled &&
      restaurant.commsConfig.sms.autoNotifyConfirmed
    ) {
      const msg = renderSmsTemplate(
        restaurant.commsConfig.sms.templates.confirmed,
        {
          customer_name: order.customerName,
          order_number: order.orderNumber,
          total: `$${order.total.toFixed(2)}`,
          prep_time: String(restaurant.prepTimeMinutes),
          restaurant_name: restaurant.name,
        }
      );
      smsSent = createSmsLog({
        restaurantId: restaurant.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        triggerType: "order_confirmed",
        message: msg,
        provider: providerMode,
      });
    }
  }

  return { order, smsSent: smsSent || ownerSmsSent, ownerSmsSent };
}

export function updateOrderStatus(
  orderId: string,
  status: Order["status"]
): { order: Order | null; smsSent: SmsLog | null } {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as Record<string, unknown> | undefined;
  if (!row) return { order: null, smsSent: null };

  const existing = mapOrderRow(row);
  const paymentStatus =
    status === "cancelled" ? "refunded" : existing.paymentStatus;

  db.prepare(
    "UPDATE orders SET status = ?, paymentStatus = ? WHERE id = ?"
  ).run(status, paymentStatus, orderId);

  const updated: Order = { ...existing, status, paymentStatus };
  const restaurant = getRestaurantBySlugOrDomain(existing.restaurantId);
  const platformTwilio = getPlatformTwilioConfig();
  let smsSent: SmsLog | null = null;

  if (
    platformTwilio.enabled &&
    platformTwilio.notifyCustomersOnOrderEvents &&
    restaurant &&
    restaurant.commsConfig.sms.enabled
  ) {
    const smsCfg = restaurant.commsConfig.sms;
    let tpl = "";
    let triggerType: SmsLog["triggerType"] | null = null;

    if (status === "preparing" && smsCfg.autoNotifyPreparing) {
      tpl = smsCfg.templates.preparing;
      triggerType = "order_preparing";
    } else if (status === "ready" && smsCfg.autoNotifyReady) {
      tpl = smsCfg.templates.ready;
      triggerType = "order_ready";
    } else if (status === "cancelled" && smsCfg.autoNotifyCancelled) {
      tpl = smsCfg.templates.cancelled;
      triggerType = "order_cancelled";
    }

    if (tpl && triggerType) {
      const msg = renderSmsTemplate(tpl, {
        customer_name: updated.customerName,
        order_number: updated.orderNumber,
        total: `$${updated.total.toFixed(2)}`,
        prep_time: String(restaurant.prepTimeMinutes),
        restaurant_name: restaurant.name,
      });
      smsSent = createSmsLog({
        restaurantId: restaurant.id,
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        triggerType,
        message: msg,
        provider:
          platformTwilio.mode === "live" ? "twilio_live" : "twilio_simulated",
      });
    }
  }

  return { order: updated, smsSent };
}

// SMS Logs
export function listSmsLogs(restaurantId: string): SmsLog[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM sms_logs WHERE restaurantId = ? ORDER BY createdAt DESC LIMIT 100"
    )
    .all(restaurantId) as Record<string, unknown>[];
  return rows.map(mapSmsRow);
}

export function createSmsLog(input: {
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  triggerType: SmsLog["triggerType"];
  message: string;
  provider?: SmsLog["provider"];
}): SmsLog {
  const db = getDb();
  const sms: SmsLog = {
    id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    restaurantId: input.restaurantId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    triggerType: input.triggerType,
    message: input.message,
    provider: input.provider || "twilio_simulated",
    status: "delivered",
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO sms_logs (
      id, restaurantId, customerName, customerPhone, triggerType, message, provider, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sms.id,
    sms.restaurantId,
    sms.customerName,
    sms.customerPhone,
    sms.triggerType,
    sms.message,
    sms.provider,
    sms.status,
    sms.createdAt
  );

  return sms;
}

// Email Campaigns
export function listEmailCampaigns(restaurantId: string): EmailCampaign[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM email_campaigns WHERE restaurantId = ? ORDER BY sentAt DESC"
    )
    .all(restaurantId) as Record<string, unknown>[];
  return rows.map(mapCampaignRow);
}

export function createEmailCampaign(input: {
  restaurantId: string;
  name: string;
  subject: string;
  segment: EmailCampaign["segment"];
  promoCode?: string;
  discountPercent?: number;
  bodyHtml: string;
}): EmailCampaign {
  const db = getDb();
  const customers = listCustomers(input.restaurantId).filter((c) => c.emailOptIn);
  let recipientCount = customers.length;
  if (input.segment === "vip") {
    recipientCount = Math.max(1, customers.filter((c) => c.vipStatus).length);
  } else if (input.segment === "repeat") {
    recipientCount = Math.max(
      1,
      customers.filter((c) => c.totalOrders >= 2).length
    );
  } else {
    recipientCount = Math.max(customers.length, 45);
  }

  const campaign: EmailCampaign = {
    id: `camp_${Date.now()}`,
    restaurantId: input.restaurantId,
    name: input.name,
    subject: input.subject,
    segment: input.segment,
    promoCode: input.promoCode,
    discountPercent: input.discountPercent,
    bodyHtml: input.bodyHtml,
    status: "sent",
    recipientCount,
    openRate: Number((48 + Math.random() * 22).toFixed(1)),
    clickRate: Number((14 + Math.random() * 14).toFixed(1)),
    revenueGenerated: 0,
    sentAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO email_campaigns (
      id, restaurantId, name, subject, segment, promoCode, discountPercent,
      bodyHtml, status, recipientCount, openRate, clickRate, revenueGenerated, sentAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaign.id,
    campaign.restaurantId,
    campaign.name,
    campaign.subject,
    campaign.segment,
    campaign.promoCode || null,
    campaign.discountPercent || null,
    campaign.bodyHtml,
    campaign.status,
    campaign.recipientCount,
    campaign.openRate,
    campaign.clickRate,
    campaign.revenueGenerated,
    campaign.sentAt
  );

  return campaign;
}

function seedUsersIfEmpty(db: DatabaseSync) {
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM users")
    .get() as { cnt: number };
  if (row.cnt > 0) return;

  const now = new Date().toISOString();
  const initialUsers: UserAccount[] = [
    // Platform Super Admin Team
    {
      id: "usr_plat_1",
      scope: "platform",
      restaurantId: null,
      name: "Jordan Sterling",
      email: "founder@platerift.app",
      phone: "+1 (415) 555-0101",
      role: "super_admin",
      status: "active",
      title: "SaaS Founder & Chief Executive",
      pinCode: "0001",
      permissions: ROLE_DEFINITIONS.super_admin.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_plat_2",
      scope: "platform",
      restaurantId: null,
      name: "Maya Lin",
      email: "maya.ops@platerift.app",
      phone: "+1 (415) 555-0102",
      role: "platform_ops",
      status: "active",
      title: "Head of Tenant Onboarding & Custom Domains",
      pinCode: "0002",
      permissions: ROLE_DEFINITIONS.platform_ops.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_plat_3",
      scope: "platform",
      restaurantId: null,
      name: "Marcus Thorne",
      email: "billing@platerift.app",
      phone: "+1 (415) 555-0103",
      role: "billing_admin",
      status: "active",
      title: "Merchant Settlements & Subscriptions Lead",
      pinCode: "0003",
      permissions: ROLE_DEFINITIONS.billing_admin.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_plat_4",
      scope: "platform",
      restaurantId: null,
      name: "Chloe Bennett",
      email: "support@platerift.app",
      phone: "+1 (415) 555-0104",
      role: "support_agent",
      status: "active",
      title: "24/7 Restaurant Success Specialist",
      pinCode: "0004",
      permissions: ROLE_DEFINITIONS.support_agent.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },

    // Bella Napoli Trattoria Staff
    {
      id: "usr_bn_1",
      scope: "restaurant",
      restaurantId: "rest_bella_napoli",
      name: "Marco Rossi",
      email: "marco@bellanapoli.com",
      phone: "+1 (312) 555-0194",
      role: "restaurant_owner",
      status: "active",
      title: "Proprietor & Executive Pizzaiolo",
      pinCode: "1101",
      permissions: ROLE_DEFINITIONS.restaurant_owner.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_bn_2",
      scope: "restaurant",
      restaurantId: "rest_bella_napoli",
      name: "Giulia Conti",
      email: "giulia.gm@bellanapoli.com",
      phone: "+1 (312) 555-0210",
      role: "general_manager",
      status: "active",
      title: "General Manager • Floor & Schedule Ops",
      pinCode: "1102",
      permissions: ROLE_DEFINITIONS.general_manager.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_bn_3",
      scope: "restaurant",
      restaurantId: "rest_bella_napoli",
      name: "Lorenzo De Luca",
      email: "chef.lorenzo@bellanapoli.com",
      phone: "+1 (312) 555-0218",
      role: "kitchen_chef",
      status: "active",
      title: "Head Wood-Fired Oven Chef",
      pinCode: "1103",
      permissions: ROLE_DEFINITIONS.kitchen_chef.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_bn_4",
      scope: "restaurant",
      restaurantId: "rest_bella_napoli",
      name: "Aria Romano",
      email: "aria.host@bellanapoli.com",
      phone: "+1 (312) 555-0244",
      role: "cashier_host",
      status: "active",
      title: "Lead Pickup Counter & Maître D'",
      pinCode: "1104",
      permissions: ROLE_DEFINITIONS.cashier_host.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_bn_5",
      scope: "restaurant",
      restaurantId: "rest_bella_napoli",
      name: "Matteo Bellini",
      email: "vip@bellanapoli.com",
      phone: "+1 (312) 555-0299",
      role: "marketing_manager",
      status: "active",
      title: "VIP Wine Club & CRM Director",
      pinCode: "1105",
      permissions: ROLE_DEFINITIONS.marketing_manager.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },

    // Sakura Izakaya & Sushi Staff
    {
      id: "usr_sk_1",
      scope: "restaurant",
      restaurantId: "rest_sakura_omakase",
      name: "Kenji Takahashi",
      email: "kenji@sakurasushi.io",
      phone: "+1 (206) 555-0148",
      role: "restaurant_owner",
      status: "active",
      title: "Owner & Omakase Master",
      pinCode: "2201",
      permissions: ROLE_DEFINITIONS.restaurant_owner.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_sk_2",
      scope: "restaurant",
      restaurantId: "rest_sakura_omakase",
      name: "Haruto Sato",
      email: "haruto@sakurasushi.io",
      phone: "+1 (206) 555-0177",
      role: "kitchen_chef",
      status: "active",
      title: "Head Sushi & Robata Chef",
      pinCode: "2202",
      permissions: ROLE_DEFINITIONS.kitchen_chef.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },

    // Fuego Craft Taqueria Staff
    {
      id: "usr_fg_1",
      scope: "restaurant",
      restaurantId: "rest_fuego_taqueria",
      name: "Elena Morales",
      email: "elena@fuegotaqueria.mx",
      phone: "+1 (512) 555-0172",
      role: "restaurant_owner",
      status: "active",
      title: "Founder & Executive Chef",
      pinCode: "3301",
      permissions: ROLE_DEFINITIONS.restaurant_owner.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
    {
      id: "usr_fg_2",
      scope: "restaurant",
      restaurantId: "rest_fuego_taqueria",
      name: "Diego Vargas",
      email: "diego@fuegotaqueria.mx",
      phone: "+1 (512) 555-0188",
      role: "general_manager",
      status: "active",
      title: "Store Manager",
      pinCode: "3302",
      permissions: ROLE_DEFINITIONS.general_manager.defaultPermissions,
      lastActiveAt: now,
      createdAt: now,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, scope, restaurantId, name, email, phone, role, status,
      title, pinCode, permissionsJson, lastActiveAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of initialUsers) {
    insertUser.run(
      u.id,
      u.scope,
      u.restaurantId,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.status,
      u.title,
      u.pinCode,
      JSON.stringify(u.permissions),
      u.lastActiveAt,
      u.createdAt
    );
  }
}

function mapUserRow(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id),
    scope: row.scope as UserScope,
    restaurantId: row.restaurantId ? String(row.restaurantId) : null,
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone || ""),
    role: row.role as UserRole,
    status: row.status as UserStatus,
    title: String(row.title || ""),
    pinCode: String(row.pinCode || ""),
    permissions: JSON.parse(String(row.permissionsJson || "[]")),
    lastActiveAt: String(row.lastActiveAt),
    createdAt: String(row.createdAt),
  };
}

export function listUsers(filter?: {
  scope?: UserScope;
  restaurantId?: string;
}): UserAccount[] {
  const db = getDb();
  if (filter?.restaurantId) {
    const rows = db
      .prepare(
        "SELECT * FROM users WHERE restaurantId = ? ORDER BY createdAt ASC"
      )
      .all(filter.restaurantId) as Record<string, unknown>[];
    return rows.map(mapUserRow);
  }
  if (filter?.scope) {
    const rows = db
      .prepare("SELECT * FROM users WHERE scope = ? ORDER BY createdAt ASC")
      .all(filter.scope) as Record<string, unknown>[];
    return rows.map(mapUserRow);
  }
  const rows = db
    .prepare("SELECT * FROM users ORDER BY scope ASC, createdAt ASC")
    .all() as Record<string, unknown>[];
  return rows.map(mapUserRow);
}

export function createUserAccount(input: {
  scope: UserScope;
  restaurantId?: string | null;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status?: UserStatus;
  title?: string;
  pinCode?: string;
  permissions?: string[];
}): UserAccount {
  const db = getDb();
  const now = new Date().toISOString();
  const roleDef = ROLE_DEFINITIONS[input.role] || ROLE_DEFINITIONS.general_manager;

  const user: UserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    scope: input.scope,
    restaurantId:
      input.scope === "restaurant" ? input.restaurantId || null : null,
    name: input.name,
    email: input.email,
    phone: input.phone || "+1 (555) 234-9000",
    role: input.role,
    status: input.status || "active",
    title: input.title || roleDef.label,
    pinCode:
      input.pinCode || String(Math.floor(1000 + Math.random() * 9000)),
    permissions: input.permissions || roleDef.defaultPermissions,
    lastActiveAt: now,
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO users (
      id, scope, restaurantId, name, email, phone, role, status,
      title, pinCode, permissionsJson, lastActiveAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.scope,
    user.restaurantId,
    user.name,
    user.email,
    user.phone,
    user.role,
    user.status,
    user.title,
    user.pinCode,
    JSON.stringify(user.permissions),
    user.lastActiveAt,
    user.createdAt
  );

  return user;
}

export function updateUserAccount(
  userId: string,
  updates: Partial<UserAccount>
): UserAccount | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const existing = mapUserRow(row);
  const nextRole = updates.role || existing.role;
  const nextPermissions =
    updates.permissions ||
    (updates.role
      ? ROLE_DEFINITIONS[updates.role]?.defaultPermissions || existing.permissions
      : existing.permissions);

  const merged: UserAccount = {
    ...existing,
    ...updates,
    role: nextRole,
    permissions: nextPermissions,
    lastActiveAt: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE users SET
      name = ?, email = ?, phone = ?, role = ?, status = ?,
      title = ?, pinCode = ?, permissionsJson = ?, restaurantId = ?, scope = ?, lastActiveAt = ?
    WHERE id = ?
  `).run(
    merged.name,
    merged.email,
    merged.phone,
    merged.role,
    merged.status,
    merged.title,
    merged.pinCode,
    JSON.stringify(merged.permissions),
    merged.restaurantId,
    merged.scope,
    merged.lastActiveAt,
    userId
  );

  return merged;
}

export function deleteUserAccount(userId: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  return res.changes > 0;
}

export function authenticateStaffOrAdminUser(input: {
  emailOrPin: string;
  scope?: UserScope;
  restaurantId?: string;
}): UserAccount | null {
  const db = getDb();
  const clean = input.emailOrPin.trim().toLowerCase();
  if (!clean) return null;

  const all = listUsers({
    scope: input.scope,
    restaurantId: input.restaurantId,
  });

  const matched =
    all.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        (u.pinCode && u.pinCode.toLowerCase() === clean)
    ) ||
    listUsers().find(
      (u) =>
        u.email.toLowerCase() === clean ||
        (u.pinCode && u.pinCode.toLowerCase() === clean)
    );

  if (matched) {
    return updateUserAccount(matched.id, {});
  }
  return null;
}

function mapScheduledReorderRow(
  row: Record<string, unknown>
): ScheduledReorder {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId),
    customerId: String(row.customerId),
    customerName: String(row.customerName),
    customerEmail: String(row.customerEmail),
    customerPhone: String(row.customerPhone),
    sourceOrderNumber: String(row.sourceOrderNumber),
    title: String(row.title),
    orderType: row.orderType as ScheduledReorder["orderType"],
    deliveryAddress: row.deliveryAddress
      ? String(row.deliveryAddress)
      : undefined,
    tableNumber: row.tableNumber ? String(row.tableNumber) : undefined,
    items: JSON.parse(String(row.itemsJson || "[]")),
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    deliveryFee: Number(row.deliveryFee),
    tip: Number(row.tip),
    total: Number(row.total),
    paymentMethod: row.paymentMethod as ScheduledReorder["paymentMethod"],
    frequency: row.frequency as ReorderFrequency,
    scheduledDate: String(row.scheduledDate),
    scheduledTime: String(row.scheduledTime),
    specialInstructions: String(row.specialInstructions || ""),
    status: row.status as ScheduledReorderStatus,
    lastTriggeredAt: row.lastTriggeredAt ? String(row.lastTriggeredAt) : null,
    createdAt: String(row.createdAt),
  };
}

function seedCustomerHistoryAndReordersIfEmpty(db: DatabaseSync) {
  // Ensure default addresses are populated on seeded customers
  db.prepare(
    "UPDATE customers SET defaultAddress = '900 N Michigan Ave Apt 14B, Chicago, IL' WHERE id = 'cust_1' AND (defaultAddress IS NULL OR defaultAddress = '')"
  ).run();
  db.prepare(
    "UPDATE customers SET defaultAddress = '400 W Huron St Suite 300, Chicago, IL' WHERE id = 'cust_2' AND (defaultAddress IS NULL OR defaultAddress = '')"
  ).run();
  db.prepare(
    "UPDATE customers SET defaultAddress = '215 W Ohio St Loft 5A, Chicago, IL' WHERE id = 'cust_3' AND (defaultAddress IS NULL OR defaultAddress = '')"
  ).run();
  db.prepare(
    "UPDATE customers SET defaultAddress = '1520 Bellevue Ave PH 2, Seattle, WA' WHERE id = 'cust_4' AND (defaultAddress IS NULL OR defaultAddress = '')"
  ).run();
  db.prepare(
    "UPDATE customers SET defaultAddress = '601 W 2nd St Apt 904, Austin, TX' WHERE id = 'cust_5' AND (defaultAddress IS NULL OR defaultAddress = '')"
  ).run();

  // Seed extra completed historical orders so customers see a rich Order History right away
  const hasPastOrder = db
    .prepare("SELECT COUNT(*) as cnt FROM orders WHERE id = 'ord_hist_1'")
    .get() as { cnt: number };

  if (hasPastOrder.cnt === 0) {
    const pastOrders: Order[] = [
      {
        id: "ord_hist_1",
        orderNumber: "BN-0988",
        restaurantId: "rest_bella_napoli",
        customerId: "cust_1",
        customerName: "Sophia Vance",
        customerEmail: "sophia.vance@example.com",
        customerPhone: "+1 (312) 555-0821",
        orderType: "delivery",
        deliveryAddress: "900 N Michigan Ave Apt 14B, Chicago, IL",
        items: [
          {
            menuItemId: "item_bn_4",
            name: "Rigatoni alla Vodka & Burrata",
            quantity: 2,
            unitPrice: 24.5,
            selectedModifiers: [
              {
                groupName: "Add Protein",
                optionLabel: "Grilled Garlic Prawns",
                priceDelta: 8.0,
              },
            ],
            itemTotal: 65.0,
          },
          {
            menuItemId: "item_bn_5",
            name: "Burrata & Heirloom Prosciutto",
            quantity: 1,
            unitPrice: 18.0,
            selectedModifiers: [],
            itemTotal: 18.0,
          },
        ],
        subtotal: 83.0,
        tax: 7.26,
        deliveryFee: 0,
        tip: 15.0,
        discount: 0,
        total: 105.26,
        paymentMethod: "stripe",
        paymentStatus: "paid",
        paymentReference: "pi_3Q8BellaPast988",
        status: "completed",
        specialInstructions: "Extra warm focaccia & chili oil on the side.",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "ord_hist_2",
        orderNumber: "BN-0914",
        restaurantId: "rest_bella_napoli",
        customerId: "cust_1",
        customerName: "Sophia Vance",
        customerEmail: "sophia.vance@example.com",
        customerPhone: "+1 (312) 555-0821",
        orderType: "pickup",
        items: [
          {
            menuItemId: "item_bn_2",
            name: "Diavola & Hot Soppressata",
            quantity: 2,
            unitPrice: 23.0,
            selectedModifiers: [
              {
                groupName: "Crust Option",
                optionLabel: "Traditional Sourdough (12\")",
                priceDelta: 0,
              },
            ],
            itemTotal: 46.0,
          },
          {
            menuItemId: "item_bn_6",
            name: "Nonno's Espresso Tiramisu",
            quantity: 1,
            unitPrice: 12.5,
            selectedModifiers: [],
            itemTotal: 12.5,
          },
        ],
        subtotal: 58.5,
        tax: 5.12,
        deliveryFee: 0,
        tip: 10.0,
        discount: 0,
        total: 73.62,
        paymentMethod: "stripe",
        paymentStatus: "paid",
        paymentReference: "pi_3Q7BellaPast914",
        status: "completed",
        specialInstructions: "Slice into 8 pieces please.",
        createdAt: new Date(
          Date.now() - 11 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      {
        id: "ord_hist_3",
        orderNumber: "BN-0960",
        restaurantId: "rest_bella_napoli",
        customerId: "cust_3",
        customerName: "Olivia Martinez",
        customerEmail: "olivia.m@designstudio.co",
        customerPhone: "+1 (312) 555-0911",
        orderType: "pickup",
        items: [
          {
            menuItemId: "item_bn_4",
            name: "Rigatoni alla Vodka & Burrata",
            quantity: 1,
            unitPrice: 24.5,
            selectedModifiers: [],
            itemTotal: 24.5,
          },
          {
            menuItemId: "item_bn_6",
            name: "Nonno's Espresso Tiramisu",
            quantity: 1,
            unitPrice: 12.5,
            selectedModifiers: [],
            itemTotal: 12.5,
          },
        ],
        subtotal: 37.0,
        tax: 3.24,
        deliveryFee: 0,
        tip: 6.5,
        discount: 0,
        total: 46.74,
        paymentMethod: "paypal",
        paymentStatus: "paid",
        paymentReference: "PAYID-OLIVIA-960",
        status: "completed",
        specialInstructions: "No plastic cutlery needed!",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "ord_hist_4",
        orderNumber: "FG-3019",
        restaurantId: "rest_fuego_taqueria",
        customerId: "cust_5",
        customerName: "Carlos Mendez",
        customerEmail: "carlos@austincreative.org",
        customerPhone: "+1 (512) 555-0623",
        orderType: "pickup",
        items: [
          {
            menuItemId: "item_fg_1",
            name: "Jalisco Beef Birria Quesatacos (3pc)",
            quantity: 2,
            unitPrice: 16.5,
            selectedModifiers: [
              {
                groupName: "Salsa Heat Level",
                optionLabel: "Extra Spicy Mango Habanero",
                priceDelta: 1.0,
              },
            ],
            itemTotal: 35.0,
          },
          {
            menuItemId: "item_fg_2",
            name: "Charred Street Corn Elote",
            quantity: 2,
            unitPrice: 9.5,
            selectedModifiers: [],
            itemTotal: 19.0,
          },
        ],
        subtotal: 54.0,
        tax: 4.46,
        deliveryFee: 0,
        tip: 9.0,
        discount: 0,
        total: 67.46,
        paymentMethod: "stripe",
        paymentStatus: "paid",
        paymentReference: "pi_3Q8Fuego3019",
        status: "completed",
        specialInstructions: "Extra lime wedges & consommé.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, orderNumber, restaurantId, customerId, customerName, customerEmail,
        customerPhone, orderType, tableNumber, deliveryAddress, itemsJson,
        subtotal, tax, deliveryFee, tip, discount, total, paymentMethod,
        paymentStatus, paymentReference, status, specialInstructions, scheduledFor, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const o of pastOrders) {
      insertOrder.run(
        o.id,
        o.orderNumber,
        o.restaurantId,
        o.customerId,
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        o.orderType,
        o.tableNumber || null,
        o.deliveryAddress || null,
        JSON.stringify(o.items),
        o.subtotal,
        o.tax,
        o.deliveryFee,
        o.tip,
        o.discount,
        o.total,
        o.paymentMethod,
        o.paymentStatus,
        o.paymentReference,
        o.status,
        o.specialInstructions,
        o.scheduledFor || null,
        o.createdAt
      );
    }
  }

  // Seed Scheduled & Recurring Re-Orders if empty
  const schedCount = db
    .prepare("SELECT COUNT(*) as cnt FROM scheduled_reorders")
    .get() as { cnt: number };

  if (schedCount.cnt === 0) {
    const now = new Date();
    const nextFriday = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const nextTuesday = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const initialScheduled: ScheduledReorder[] = [
      {
        id: "sched_1",
        restaurantId: "rest_bella_napoli",
        customerId: "cust_1",
        customerName: "Sophia Vance",
        customerEmail: "sophia.vance@example.com",
        customerPhone: "+1 (312) 555-0821",
        sourceOrderNumber: "BN-1042",
        title: "Friday Family Wood-Fired Pizza & Tiramisu Night",
        orderType: "delivery",
        deliveryAddress: "900 N Michigan Ave Apt 14B, Chicago, IL",
        items: [
          {
            menuItemId: "item_bn_1",
            name: "Margherita Verace DOP",
            quantity: 1,
            unitPrice: 19.5,
            selectedModifiers: [
              {
                groupName: "Crust Option",
                optionLabel: "Traditional Sourdough (12\")",
                priceDelta: 0,
              },
              {
                groupName: "Artisanal Add-Ons",
                optionLabel: "Fresh Burrata Center",
                priceDelta: 5.5,
              },
            ],
            itemTotal: 25.0,
          },
          {
            menuItemId: "item_bn_6",
            name: "Nonno's Espresso Tiramisu",
            quantity: 2,
            unitPrice: 12.5,
            selectedModifiers: [],
            itemTotal: 25.0,
          },
        ],
        subtotal: 50.0,
        tax: 4.38,
        deliveryFee: 0,
        tip: 9.0,
        total: 63.38,
        paymentMethod: "stripe",
        frequency: "weekly",
        scheduledDate: nextFriday,
        scheduledTime: "19:00",
        specialInstructions: "Ring buzzer #14B • Recurring Friday VIP standing order",
        status: "active",
        lastTriggeredAt: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        createdAt: now.toISOString(),
      },
      {
        id: "sched_2",
        restaurantId: "rest_bella_napoli",
        customerId: "cust_2",
        customerName: "David Chen",
        customerEmail: "dchen@chicagotech.io",
        customerPhone: "+1 (312) 555-0432",
        sourceOrderNumber: "BN-1043",
        title: "Team Lunch Pasta & Gluten-Free Diavola",
        orderType: "pickup",
        items: [
          {
            menuItemId: "item_bn_2",
            name: "Diavola & Hot Soppressata",
            quantity: 1,
            unitPrice: 23.0,
            selectedModifiers: [
              {
                groupName: "Crust Option",
                optionLabel: "Gluten-Free Crust",
                priceDelta: 4.0,
              },
            ],
            itemTotal: 27.0,
          },
          {
            menuItemId: "item_bn_4",
            name: "Rigatoni alla Vodka & Burrata",
            quantity: 1,
            unitPrice: 24.5,
            selectedModifiers: [],
            itemTotal: 24.5,
          },
        ],
        subtotal: 51.5,
        tax: 4.51,
        deliveryFee: 0,
        tip: 7.5,
        total: 63.51,
        paymentMethod: "paypal",
        frequency: "biweekly",
        scheduledDate: nextTuesday,
        scheduledTime: "12:30",
        specialInstructions: "Office lunch pickup • Label boxes",
        status: "active",
        lastTriggeredAt: null,
        createdAt: now.toISOString(),
      },
      {
        id: "sched_3",
        restaurantId: "rest_sakura_omakase",
        customerId: "cust_4",
        customerName: "Liam O'Connor",
        customerEmail: "liam@seattleventures.com",
        customerPhone: "+1 (206) 555-0334",
        sourceOrderNumber: "SK-2088",
        title: "Weekly Friday Omakase Tasting Box",
        orderType: "pickup",
        items: [
          {
            menuItemId: "item_sk_1",
            name: "Chef's 12-Piece Omakase Box",
            quantity: 1,
            unitPrice: 68.0,
            selectedModifiers: [
              {
                groupName: "Soy Sauce Preference",
                optionLabel: "House Aged Shoyu",
                priceDelta: 0,
              },
            ],
            itemTotal: 68.0,
          },
        ],
        subtotal: 68.0,
        tax: 6.87,
        deliveryFee: 0,
        tip: 12.0,
        total: 86.87,
        paymentMethod: "stripe",
        frequency: "weekly",
        scheduledDate: nextFriday,
        scheduledTime: "19:30",
        specialInstructions: "Extra pickled ginger & fresh grated wasabi.",
        status: "active",
        lastTriggeredAt: null,
        createdAt: now.toISOString(),
      },
    ];

    const insertScheduled = db.prepare(`
      INSERT INTO scheduled_reorders (
        id, restaurantId, customerId, customerName, customerEmail, customerPhone,
        sourceOrderNumber, title, orderType, deliveryAddress, tableNumber,
        itemsJson, subtotal, tax, deliveryFee, tip, total, paymentMethod,
        frequency, scheduledDate, scheduledTime, specialInstructions, status,
        lastTriggeredAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of initialScheduled) {
      insertScheduled.run(
        s.id,
        s.restaurantId,
        s.customerId,
        s.customerName,
        s.customerEmail,
        s.customerPhone,
        s.sourceOrderNumber,
        s.title,
        s.orderType,
        s.deliveryAddress || null,
        s.tableNumber || null,
        JSON.stringify(s.items),
        s.subtotal,
        s.tax,
        s.deliveryFee,
        s.tip,
        s.total,
        s.paymentMethod,
        s.frequency,
        s.scheduledDate,
        s.scheduledTime,
        s.specialInstructions,
        s.status,
        s.lastTriggeredAt,
        s.createdAt
      );
    }
  }
}

export function authenticateOrRegisterCustomer(input: {
  restaurantId: string;
  mode: "login" | "register";
  email: string;
  name?: string;
  phone?: string;
  defaultAddress?: string;
  notes?: string;
}): Customer {
  const db = getDb();
  const cleanEmail = input.email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Check if customer already exists in this restaurant
  const existingInRest = db
    .prepare(
      "SELECT * FROM customers WHERE restaurantId = ? AND LOWER(email) = LOWER(?) LIMIT 1"
    )
    .get(input.restaurantId, cleanEmail) as Record<string, unknown> | undefined;

  if (existingInRest) {
    return mapCustomerRow(existingInRest);
  }

  // Check if customer exists on another tenant in the platform so we can carry over their identity
  const existingGlobal = db
    .prepare("SELECT * FROM customers WHERE LOWER(email) = LOWER(?) LIMIT 1")
    .get(cleanEmail) as Record<string, unknown> | undefined;

  const baseGlobal = existingGlobal ? mapCustomerRow(existingGlobal) : null;

  const newCust: Customer = {
    id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    restaurantId: input.restaurantId,
    name:
      input.name?.trim() ||
      baseGlobal?.name ||
      cleanEmail.split("@")[0].replace(/[._-]/g, " "),
    email: cleanEmail,
    phone: input.phone?.trim() || baseGlobal?.phone || "+1 (312) 555-0199",
    defaultAddress:
      input.defaultAddress?.trim() ||
      baseGlobal?.defaultAddress ||
      "742 W Fulton Market, Suite 400",
    totalOrders: 0,
    totalSpent: 0,
    loyaltyPoints: 50, // Welcome bonus loyalty points!
    vipStatus: false,
    smsOptIn: true,
    emailOptIn: true,
    tags: ["Member", "Online Account"],
    notes: input.notes?.trim() || baseGlobal?.notes || "",
    lastOrderAt: null,
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO customers (
      id, restaurantId, name, email, phone, defaultAddress, totalOrders, totalSpent,
      loyaltyPoints, vipStatus, smsOptIn, emailOptIn, tagsJson, notes, lastOrderAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newCust.id,
    newCust.restaurantId,
    newCust.name,
    newCust.email,
    newCust.phone,
    newCust.defaultAddress || "",
    newCust.totalOrders,
    newCust.totalSpent,
    newCust.loyaltyPoints,
    newCust.vipStatus ? 1 : 0,
    newCust.smsOptIn ? 1 : 0,
    newCust.emailOptIn ? 1 : 0,
    JSON.stringify(newCust.tags),
    newCust.notes,
    newCust.lastOrderAt,
    newCust.createdAt
  );

  return newCust;
}

export function updateCustomerProfile(
  customerId: string,
  updates: Partial<Customer>
): Customer | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(customerId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const existing = mapCustomerRow(row);
  const merged: Customer = {
    ...existing,
    ...updates,
    tags: updates.tags || existing.tags,
  };

  db.prepare(`
    UPDATE customers SET
      name = ?, email = ?, phone = ?, defaultAddress = ?,
      smsOptIn = ?, emailOptIn = ?, notes = ?, tagsJson = ?
    WHERE id = ?
  `).run(
    merged.name,
    merged.email,
    merged.phone,
    merged.defaultAddress || "",
    merged.smsOptIn ? 1 : 0,
    merged.emailOptIn ? 1 : 0,
    merged.notes,
    JSON.stringify(merged.tags),
    customerId
  );

  return merged;
}

export function listCustomerOrders(
  restaurantId: string,
  customerId: string,
  customerEmail: string
): Order[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM orders WHERE restaurantId = ? AND (customerId = ? OR LOWER(customerEmail) = LOWER(?)) ORDER BY createdAt DESC"
    )
    .all(restaurantId, customerId, customerEmail) as Record<string, unknown>[];
  return rows.map(mapOrderRow);
}

export function listScheduledReorders(
  restaurantId: string,
  customerId?: string,
  customerEmail?: string
): ScheduledReorder[] {
  const db = getDb();
  if (customerId || customerEmail) {
    const rows = db
      .prepare(
        "SELECT * FROM scheduled_reorders WHERE restaurantId = ? AND (customerId = ? OR LOWER(customerEmail) = LOWER(?)) ORDER BY scheduledDate ASC, scheduledTime ASC"
      )
      .all(
        restaurantId,
        customerId || "",
        customerEmail || ""
      ) as Record<string, unknown>[];
    return rows.map(mapScheduledReorderRow);
  }
  const rows = db
    .prepare(
      "SELECT * FROM scheduled_reorders WHERE restaurantId = ? ORDER BY scheduledDate ASC, scheduledTime ASC"
    )
    .all(restaurantId) as Record<string, unknown>[];
  return rows.map(mapScheduledReorderRow);
}

export function createScheduledReorder(
  input: Omit<
    ScheduledReorder,
    "id" | "createdAt" | "lastTriggeredAt" | "status"
  >
): ScheduledReorder {
  const db = getDb();
  const now = new Date().toISOString();
  const record: ScheduledReorder = {
    ...input,
    id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: "active",
    lastTriggeredAt: null,
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO scheduled_reorders (
      id, restaurantId, customerId, customerName, customerEmail, customerPhone,
      sourceOrderNumber, title, orderType, deliveryAddress, tableNumber,
      itemsJson, subtotal, tax, deliveryFee, tip, total, paymentMethod,
      frequency, scheduledDate, scheduledTime, specialInstructions, status,
      lastTriggeredAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.restaurantId,
    record.customerId,
    record.customerName,
    record.customerEmail,
    record.customerPhone,
    record.sourceOrderNumber,
    record.title,
    record.orderType,
    record.deliveryAddress || null,
    record.tableNumber || null,
    JSON.stringify(record.items),
    record.subtotal,
    record.tax,
    record.deliveryFee,
    record.tip,
    record.total,
    record.paymentMethod,
    record.frequency,
    record.scheduledDate,
    record.scheduledTime,
    record.specialInstructions || "",
    record.status,
    record.lastTriggeredAt,
    record.createdAt
  );

  return record;
}

export function updateScheduledReorderStatus(
  id: string,
  updates: {
    status?: ScheduledReorderStatus;
    scheduledDate?: string;
    scheduledTime?: string;
    frequency?: ReorderFrequency;
  }
): ScheduledReorder | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM scheduled_reorders WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const existing = mapScheduledReorderRow(row);
  const merged: ScheduledReorder = {
    ...existing,
    status: updates.status || existing.status,
    scheduledDate: updates.scheduledDate || existing.scheduledDate,
    scheduledTime: updates.scheduledTime || existing.scheduledTime,
    frequency: updates.frequency || existing.frequency,
  };

  db.prepare(`
    UPDATE scheduled_reorders SET
      status = ?, scheduledDate = ?, scheduledTime = ?, frequency = ?
    WHERE id = ?
  `).run(
    merged.status,
    merged.scheduledDate,
    merged.scheduledTime,
    merged.frequency,
    id
  );

  return merged;
}

function advanceDateByFrequency(
  dateStr: string,
  frequency: ReorderFrequency
): string {
  const base = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }
  if (frequency === "weekly") {
    base.setUTCDate(base.getUTCDate() + 7);
  } else if (frequency === "biweekly") {
    base.setUTCDate(base.getUTCDate() + 14);
  } else if (frequency === "monthly") {
    base.setUTCMonth(base.getUTCMonth() + 1);
  }
  return base.toISOString().slice(0, 10);
}

export function triggerScheduledReorderNow(id: string): {
  order: Order;
  smsSent: SmsLog | null;
  scheduledReorder: ScheduledReorder;
} {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM scheduled_reorders WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Scheduled re-order not found");
  }

  const sched = mapScheduledReorderRow(row);
  const { order, smsSent } = createOrder({
    restaurantId: sched.restaurantId,
    customerName: sched.customerName,
    customerEmail: sched.customerEmail,
    customerPhone: sched.customerPhone,
    orderType: sched.orderType,
    tableNumber: sched.tableNumber,
    deliveryAddress: sched.deliveryAddress,
    items: sched.items,
    subtotal: sched.subtotal,
    tax: sched.tax,
    deliveryFee: sched.deliveryFee,
    tip: sched.tip,
    discount: 0,
    total: sched.total,
    paymentMethod: sched.paymentMethod,
    paymentStatus: "paid",
    paymentReference: `${sched.paymentMethod.toUpperCase()}-SCHED-${Math.floor(100000 + Math.random() * 900000)}`,
    status: "confirmed",
    specialInstructions: `${sched.specialInstructions ? sched.specialInstructions + " • " : ""}[Auto-Dispatched from Scheduled Re-Order: ${sched.title}]`,
    scheduledFor: `${sched.scheduledDate} ${sched.scheduledTime}`,
  });

  const nextStatus: ScheduledReorderStatus =
    sched.frequency === "once" ? "completed" : "active";
  const nextDate =
    sched.frequency === "once"
      ? sched.scheduledDate
      : advanceDateByFrequency(sched.scheduledDate, sched.frequency);
  const nowIso = new Date().toISOString();

  db.prepare(`
    UPDATE scheduled_reorders SET
      status = ?, scheduledDate = ?, lastTriggeredAt = ?
    WHERE id = ?
  `).run(nextStatus, nextDate, nowIso, id);

  const updatedRow = db
    .prepare("SELECT * FROM scheduled_reorders WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return {
    order,
    smsSent,
    scheduledReorder: mapScheduledReorderRow(updatedRow),
  };
}

