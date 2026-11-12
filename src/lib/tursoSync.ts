import type { DatabaseSync } from "node:sqlite";

const TABLES = [
  "restaurants",
  "menu_items",
  "customers",
  "orders",
  "sms_logs",
  "email_campaigns",
  "users",
  "scheduled_reorders",
  "platform_settings",
] as const;

export interface TursoConfig {
  httpUrl: string;
  rawUrl: string;
  authToken: string;
}

export function getTursoConfig(): TursoConfig | null {
  const rawUrl = (
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    process.env.TURSO_URL ||
    process.env.DATABASE_URL ||
    ""
  ).trim();

  const authToken = (
    process.env.TURSO_AUTH_TOKEN ||
    process.env.LIBSQL_AUTH_TOKEN ||
    process.env.TURSO_TOKEN ||
    ""
  ).trim();

  if (
    !rawUrl ||
    (!rawUrl.startsWith("libsql://") && !rawUrl.startsWith("https://"))
  ) {
    return null;
  }

  const httpUrl = rawUrl
    .replace(/^libsql:\/\//i, "https://")
    .replace(/\/+$/, "");

  return {
    httpUrl,
    rawUrl,
    authToken,
  };
}

interface HranaValue {
  type: "null" | "integer" | "float" | "text" | "blob";
  value?: string | number;
}

interface HranaStmt {
  sql: string;
  args?: HranaValue[];
}

function toHranaArg(val: unknown): HranaValue {
  if (val === null || val === undefined) {
    return { type: "null" };
  }
  if (typeof val === "boolean") {
    return { type: "integer", value: val ? "1" : "0" };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { type: "integer", value: String(val) };
    }
    return { type: "float", value: val };
  }
  return { type: "text", value: String(val) };
}

function fromHranaValue(cell: HranaValue | undefined): unknown {
  if (!cell || cell.type === "null") return null;
  if (cell.type === "integer") return Number(cell.value ?? 0);
  if (cell.type === "float") return Number(cell.value ?? 0);
  return cell.value ?? "";
}

export async function executeTursoPipeline(
  config: TursoConfig,
  statements: { sql: string; args?: unknown[] }[]
): Promise<
  {
    cols: string[];
    rows: Record<string, unknown>[];
    affectedRowCount: number;
  }[]
> {
  if (statements.length === 0) return [];

  const requests = [
    ...statements.map((stmt) => ({
      type: "execute",
      stmt: {
        sql: stmt.sql,
        args: (stmt.args || []).map(toHranaArg),
      } satisfies HranaStmt,
    })),
    { type: "close" },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.authToken) {
    headers.Authorization = `Bearer ${config.authToken}`;
  }

  const res = await fetch(`${config.httpUrl}/v2/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Turso HTTP pipeline error (${res.status}): ${errText.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    results?: {
      type: "ok" | "error";
      error?: { message?: string };
      response?: {
        type: string;
        result?: {
          cols?: { name: string }[];
          rows?: HranaValue[][];
          affected_row_count?: number;
        };
      };
    }[];
  };

  const out: {
    cols: string[];
    rows: Record<string, unknown>[];
    affectedRowCount: number;
  }[] = [];

  for (const item of data.results || []) {
    if (item.type === "error") {
      throw new Error(item.error?.message || "Turso statement execution error");
    }
    if (item.response?.type === "execute" && item.response.result) {
      const cols = (item.response.result.cols || []).map((c) => c.name);
      const rawRows = item.response.result.rows || [];
      const rows = rawRows.map((r) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = fromHranaValue(r[i]);
        }
        return obj;
      });
      out.push({
        cols,
        rows,
        affectedRowCount: item.response.result.affected_row_count || 0,
      });
    }
  }

  return out;
}

export const TURSO_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS restaurants (
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
    storefrontPagesJson TEXT NOT NULL DEFAULT '',
    inventoryConfigJson TEXT NOT NULL DEFAULT '',
    integrationsConfigJson TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS menu_items (
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
    sortOrder INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
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
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
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
    deliveryTrackingJson TEXT NOT NULL DEFAULT '',
    posSyncJson TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sms_logs (
    id TEXT PRIMARY KEY,
    restaurantId TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    triggerType TEXT NOT NULL,
    message TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS email_campaigns (
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
    sentAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
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
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scheduled_reorders (
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
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    valueJson TEXT NOT NULL
  )`,
];

export interface TursoSyncSummary {
  connected: boolean;
  direction: "push_local_to_turso" | "pull_turso_to_local" | "bidirectional";
  tursoHost: string;
  tableCounts: Record<string, number>;
  syncedAt: string;
  error?: string;
}

/**
 * Push all rows from local SQLite into Turso cloud database (UPSERT / REPLACE).
 */
export async function pushLocalSqliteToTurso(
  db: DatabaseSync
): Promise<TursoSyncSummary> {
  const config = getTursoConfig();
  const syncedAt = new Date().toISOString();
  if (!config) {
    return {
      connected: false,
      direction: "push_local_to_turso",
      tursoHost: "not_configured",
      tableCounts: {},
      syncedAt,
      error:
        "TURSO_DATABASE_URL (or LIBSQL_URL) is not configured in environment variables.",
    };
  }

  // 1. Ensure all tables exist on Turso
  await executeTursoPipeline(
    config,
    TURSO_SCHEMA_STATEMENTS.map((sql) => ({ sql }))
  );

  // 2. Build batched INSERT OR REPLACE statements for all 9 tables
  const statements: { sql: string; args: unknown[] }[] = [];
  const tableCounts: Record<string, number> = {};

  for (const table of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<
      string,
      unknown
    >[];
    tableCounts[table] = rows.length;
    if (rows.length === 0) continue;

    const cols = Object.keys(rows[0]);
    const colList = cols.join(", ");
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`;

    for (const row of rows) {
      statements.push({
        sql,
        args: cols.map((c) => row[c]),
      });
    }
  }

  // Execute in chunks of 60 statements per HTTP pipeline call
  const CHUNK_SIZE = 60;
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const batch = statements.slice(i, i + CHUNK_SIZE);
    await executeTursoPipeline(config, batch);
  }

  return {
    connected: true,
    direction: "push_local_to_turso",
    tursoHost: config.httpUrl,
    tableCounts,
    syncedAt,
  };
}

/**
 * Pull all rows from Turso cloud database into local SQLite.
 * If Turso is completely empty (0 restaurants), automatically seeds Turso from local SQLite first!
 */
export async function pullTursoToLocalSqlite(
  db: DatabaseSync
): Promise<TursoSyncSummary> {
  const config = getTursoConfig();
  const syncedAt = new Date().toISOString();
  if (!config) {
    return {
      connected: false,
      direction: "pull_turso_to_local",
      tursoHost: "not_configured",
      tableCounts: {},
      syncedAt,
      error:
        "TURSO_DATABASE_URL (or LIBSQL_URL) is not configured in environment variables.",
    };
  }

  // 1. Ensure schema exists on Turso
  await executeTursoPipeline(
    config,
    TURSO_SCHEMA_STATEMENTS.map((sql) => ({ sql }))
  );

  // 2. Fetch all tables from Turso in one pipeline round-trip
  const selectResults = await executeTursoPipeline(
    config,
    TABLES.map((table) => ({ sql: `SELECT * FROM ${table}` }))
  );

  const tursoRestaurantCount = selectResults[0]?.rows?.length || 0;
  if (tursoRestaurantCount === 0) {
    // Turso is newly created and empty -> push our seeded local database to Turso!
    return pushLocalSqliteToTurso(db);
  }

  const tableCounts: Record<string, number> = {};
  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    for (let idx = 0; idx < TABLES.length; idx++) {
      const table = TABLES[idx];
      const res = selectResults[idx];
      const rows = res?.rows || [];
      tableCounts[table] = rows.length;
      if (rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const colList = cols.join(", ");
      const placeholders = cols.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`
      );

      for (const row of rows) {
        stmt.run(...(cols.map((c) => row[c]) as (string | number | null)[]));
      }
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }

  return {
    connected: true,
    direction: "pull_turso_to_local",
    tursoHost: config.httpUrl,
    tableCounts,
    syncedAt,
  };
}

/**
 * Inspect Turso cloud connection status and live row counts across all tables.
 */
export async function getTursoCloudStatus(db: DatabaseSync): Promise<{
  configured: boolean;
  connected: boolean;
  tursoHost: string;
  envVarDetected: string;
  localCounts: Record<string, number>;
  tursoCounts: Record<string, number>;
  lastCheckedAt: string;
  error?: string;
}> {
  const localCounts: Record<string, number> = {};
  for (const table of TABLES) {
    try {
      const r = db
        .prepare(`SELECT COUNT(*) as cnt FROM ${table}`)
        .get() as { cnt: number };
      localCounts[table] = r?.cnt || 0;
    } catch {
      localCounts[table] = 0;
    }
  }

  const config = getTursoConfig();
  const lastCheckedAt = new Date().toISOString();

  const envVarDetected = process.env.TURSO_DATABASE_URL
    ? "TURSO_DATABASE_URL"
    : process.env.LIBSQL_URL
    ? "LIBSQL_URL"
    : process.env.TURSO_URL
    ? "TURSO_URL"
    : process.env.DATABASE_URL
    ? "DATABASE_URL"
    : "none";

  if (!config) {
    return {
      configured: false,
      connected: false,
      tursoHost: "Not Configured",
      envVarDetected,
      localCounts,
      tursoCounts: {},
      lastCheckedAt,
    };
  }

  try {
    await executeTursoPipeline(
      config,
      TURSO_SCHEMA_STATEMENTS.map((sql) => ({ sql }))
    );

    const countResults = await executeTursoPipeline(
      config,
      TABLES.map((t) => ({ sql: `SELECT COUNT(*) as cnt FROM ${t}` }))
    );

    const tursoCounts: Record<string, number> = {};
    for (let i = 0; i < TABLES.length; i++) {
      const cnt = Number(countResults[i]?.rows?.[0]?.cnt ?? 0);
      tursoCounts[TABLES[i]] = cnt;
    }

    return {
      configured: true,
      connected: true,
      tursoHost: config.httpUrl,
      envVarDetected,
      localCounts,
      tursoCounts,
      lastCheckedAt,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      tursoHost: config.httpUrl,
      envVarDetected,
      localCounts,
      tursoCounts: {},
      lastCheckedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fire-and-forget helper to mirror any single-row mutation or full table to Turso
 * whenever a write happens in src/lib/db.ts.
 */
export function scheduleTursoMirror(db: DatabaseSync): void {
  const config = getTursoConfig();
  if (!config) return;
  pushLocalSqliteToTurso(db).catch(() => {
    // Non-blocking background sync
  });
}
