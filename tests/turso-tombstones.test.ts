import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  assertValidTombstoneTable,
  isValidTombstoneTable,
  pullTursoToLocalSqlite,
  pushLocalSqliteToTurso,
  TOMBSTONE_ALLOWED_TABLES,
  TURSO_SCHEMA_STATEMENTS,
} from "@/lib/tursoSync";
import {
  createMenuItem,
  createUserAccount,
  deleteMenuItem,
  deleteUserAccount,
  getDb,
  listMenuItems,
  listRestaurants,
  listUsers,
} from "@/lib/db";

interface MockHranaState {
  restaurants: Record<string, unknown>[];
  menu_items: Record<string, unknown>[];
  users: Record<string, unknown>[];
  deleted_records: Record<string, unknown>[];
  executedStatements: Array<{ sql: string; args: unknown[] }>;
}

function toHranaCell(val: unknown): {
  type: "null" | "integer" | "float" | "text";
  value?: string | number;
} {
  if (val === null || val === undefined) return { type: "null" };
  if (typeof val === "number") {
    return Number.isInteger(val)
      ? { type: "integer", value: String(val) }
      : { type: "float", value: val };
  }
  return { type: "text", value: String(val) };
}

function encodeRowsResult(rows: Record<string, unknown>[]) {
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    type: "ok",
    response: {
      type: "execute",
      result: {
        cols: cols.map((name) => ({ name })),
        rows: rows.map((row) => cols.map((c) => toHranaCell(row[c]))),
        affected_row_count: 0,
      },
    },
  };
}

function installMockTursoFetch(state: MockHranaState): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}")) as {
      requests?: Array<{
        type: string;
        stmt?: {
          sql: string;
          args?: Array<{ type: string; value?: string | number }>;
        };
      }>;
    };
    const results: unknown[] = [];

    for (const reqItem of body.requests || []) {
      if (reqItem.type === "close") {
        results.push({ type: "ok", response: { type: "close" } });
        continue;
      }

      const sql = reqItem.stmt?.sql || "";
      const args = (reqItem.stmt?.args || []).map((a) =>
        a.type === "null"
          ? null
          : a.type === "integer" || a.type === "float"
          ? Number(a.value)
          : a.value
      );
      state.executedStatements.push({ sql, args });

      if (/^SELECT tableName, recordId, deletedAt FROM deleted_records/i.test(sql)) {
        results.push(encodeRowsResult(state.deleted_records));
      } else if (/^SELECT \* FROM restaurants/i.test(sql)) {
        results.push(encodeRowsResult(state.restaurants));
      } else if (/^SELECT \* FROM menu_items/i.test(sql)) {
        results.push(encodeRowsResult(state.menu_items));
      } else if (/^SELECT \* FROM users/i.test(sql)) {
        results.push(encodeRowsResult(state.users));
      } else if (/^SELECT /i.test(sql)) {
        results.push(encodeRowsResult([]));
      } else {
        results.push({
          type: "ok",
          response: {
            type: "execute",
            result: { cols: [], rows: [], affected_row_count: 1 },
          },
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

const TURSO_ENV_KEYS = [
  "TURSO_DATABASE_URL",
  "STORAGE_URL",
  "LIBSQL_URL",
  "TURSO_URL",
  "DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "STORAGE_AUTH_TOKEN",
  "LIBSQL_AUTH_TOKEN",
  "TURSO_TOKEN",
] as const;

const savedEnv: Record<string, string | undefined> = {};
let tempDir = "";
let tempDb: DatabaseSync | null = null;

before(() => {
  for (const key of TURSO_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platerift-tombstone-"));
  const dbFile = path.join(tempDir, "isolated-tombstones.db");
  tempDb = new DatabaseSync(dbFile);
  for (const ddl of TURSO_SCHEMA_STATEMENTS) {
    tempDb.exec(ddl);
  }
});

after(() => {
  try {
    tempDb?.close();
  } catch {
    // Ignore close errors
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore transient Windows cleanup locks in os.tmpdir()
  }
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
});

describe("Tombstone table allowlist validation", () => {
  it("allows only the 4 permitted deletion-tracked tables", () => {
    assert.deepEqual(
      [...TOMBSTONE_ALLOWED_TABLES],
      ["menu_items", "users", "restaurants", "scheduled_reorders"]
    );
    for (const table of TOMBSTONE_ALLOWED_TABLES) {
      assert.equal(isValidTombstoneTable(table), true);
      assert.equal(assertValidTombstoneTable(table), table);
    }
  });

  it("rejects arbitrary and SQL-injection table names", () => {
    const maliciousInputs = [
      "",
      "orders",
      "customers",
      "deleted_records",
      "sqlite_master",
      "menu_items; DROP TABLE restaurants;--",
      "users WHERE 1=1",
      "menu_items` --",
      "MENU_ITEMS",
    ];
    for (const bad of maliciousInputs) {
      assert.equal(isValidTombstoneTable(bad), false);
      assert.throws(() => assertValidTombstoneTable(bad), /Invalid tombstone table name/);
    }
  });
});

describe("Tombstone merge and anti-resurrection sync", () => {
  it("applies remote tombstones and prevents resurrection of deleted records during pull", async () => {
    assert.ok(tempDb);
    const now = new Date().toISOString();

    const sampleRestaurant = {
      id: "rest_iso_1",
      name: "Isolated Cafe",
      slug: "isolated-cafe",
      tagline: "Tag",
      cuisine: "Italian",
      description: "Desc",
      ownerName: "Owner",
      ownerEmail: "owner@iso.test",
      phone: "555-0100",
      address: "1 Test Way",
      timezone: "America/Chicago",
      plan: "starter",
      status: "active",
      customDomain: "",
      subdomain: "isolated-cafe.platerift.com",
      domainVerified: 1,
      sslStatus: "active",
      dnsTxtToken: "tok",
      logoEmoji: "🍝",
      primaryColor: "#000000",
      accentColor: "#ffffff",
      layoutStyle: "modern-grid",
      heroBannerUrl: "",
      customRequirementNotes: "",
      featuresJson: "{}",
      orderingEnabled: 1,
      pauseReason: "",
      maxOrdersPerHour: 20,
      maxOrdersPerDay: 100,
      minOrderAmount: 10,
      maxOrderAmount: 500,
      prepTimeMinutes: 20,
      advanceNoticeDays: 0,
      advanceNoticeHours: 0,
      advanceNoticeNote: "",
      autoPauseOnLimit: 1,
      weeklyScheduleJson: "[]",
      blackoutWindowsJson: "[]",
      paymentConfigJson: "{}",
      commsConfigJson: "{}",
      storefrontPagesJson: "",
      inventoryConfigJson: "",
      integrationsConfigJson: "",
      createdAt: now,
      updatedAt: now,
    };

    const zombieMenuItem = {
      id: "item_zombie_1",
      restaurantId: "rest_iso_1",
      category: "Mains",
      name: "Deleted Pasta",
      description: "Should stay deleted",
      price: 16.5,
      imageUrl: "",
      available: 1,
      unavailableReason: "",
      dailyStockLimit: null,
      currentStockCount: null,
      popular: 0,
      prepTimeMinutes: 15,
      dietaryTagsJson: "[]",
      modifiersJson: "[]",
      sortOrder: 1,
    };

    const liveMenuItem = {
      ...zombieMenuItem,
      id: "item_live_1",
      name: "Active Risotto",
      price: 21.0,
    };

    const zombieUser = {
      id: "user_zombie_1",
      scope: "restaurant",
      restaurantId: "rest_iso_1",
      name: "Former Staff",
      email: "former@iso.test",
      phone: "",
      role: "cashier_host",
      status: "active",
      title: "Cashier",
      pinCode: "1111",
      permissionsJson: "[]",
      lastActiveAt: now,
      createdAt: now,
    };

    // Seed local temp DB with records that were deleted elsewhere
    tempDb
      .prepare(
        "INSERT OR REPLACE INTO restaurants (id, name, slug, tagline, cuisine, description, ownerName, ownerEmail, phone, address, timezone, plan, status, customDomain, subdomain, domainVerified, sslStatus, dnsTxtToken, logoEmoji, primaryColor, accentColor, layoutStyle, heroBannerUrl, customRequirementNotes, featuresJson, orderingEnabled, pauseReason, maxOrdersPerHour, maxOrdersPerDay, minOrderAmount, maxOrderAmount, prepTimeMinutes, advanceNoticeDays, advanceNoticeHours, advanceNoticeNote, autoPauseOnLimit, weeklyScheduleJson, blackoutWindowsJson, paymentConfigJson, commsConfigJson, storefrontPagesJson, inventoryConfigJson, integrationsConfigJson, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(...(Object.values(sampleRestaurant) as (string | number | null)[]));

    for (const item of [zombieMenuItem, liveMenuItem]) {
      tempDb
        .prepare(
          "INSERT OR REPLACE INTO menu_items (id, restaurantId, category, name, description, price, imageUrl, available, unavailableReason, dailyStockLimit, currentStockCount, popular, prepTimeMinutes, dietaryTagsJson, modifiersJson, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(...(Object.values(item) as (string | number | null)[]));
    }

    tempDb
      .prepare(
        "INSERT OR REPLACE INTO users (id, scope, restaurantId, name, email, phone, role, status, title, pinCode, permissionsJson, lastActiveAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(...(Object.values(zombieUser) as (string | number | null)[]));

    // Insert a malformed tombstone row locally to verify allowlist skips it cleanly
    tempDb
      .prepare(
        "INSERT OR REPLACE INTO deleted_records (tableName, recordId, deletedAt) VALUES (?, ?, ?)"
      )
      .run("orders; DROP TABLE restaurants;--", "bad_1", now);

    // Mock Turso returning tombstones PLUS stale rows for the deleted records
    const mockState: MockHranaState = {
      restaurants: [sampleRestaurant],
      menu_items: [zombieMenuItem, liveMenuItem],
      users: [zombieUser],
      deleted_records: [
        { tableName: "menu_items", recordId: "item_zombie_1", deletedAt: now },
        { tableName: "users", recordId: "user_zombie_1", deletedAt: now },
        { tableName: "orders; DROP TABLE users;--", recordId: "x", deletedAt: now },
      ],
      executedStatements: [],
    };

    process.env.TURSO_DATABASE_URL = "https://mock-turso.platerift.test";
    process.env.TURSO_AUTH_TOKEN = "mock-token";
    const restoreFetch = installMockTursoFetch(mockState);
    try {
      const pullRes = await pullTursoToLocalSqlite(tempDb);
      assert.equal(pullRes.connected, true);

      const remainingItems = tempDb
        .prepare("SELECT id FROM menu_items")
        .all() as Array<{ id: string }>;
      assert.deepEqual(
        remainingItems.map((r) => r.id),
        ["item_live_1"]
      );

      const remainingUsers = tempDb
        .prepare("SELECT id FROM users")
        .all() as Array<{ id: string }>;
      assert.equal(remainingUsers.length, 0);

      // Restaurants table intact despite injected tableName inside deleted_records
      const remainingRestaurants = tempDb
        .prepare("SELECT id FROM restaurants")
        .all() as Array<{ id: string }>;
      assert.deepEqual(
        remainingRestaurants.map((r) => r.id),
        ["rest_iso_1"]
      );

      // Local deleted_records now contains both merged tombstones
      const tombstones = tempDb
        .prepare("SELECT tableName, recordId FROM deleted_records ORDER BY tableName")
        .all() as Array<{ tableName: string; recordId: string }>;
      assert.ok(
        tombstones.some(
          (t) => t.tableName === "menu_items" && t.recordId === "item_zombie_1"
        )
      );
      assert.ok(
        tombstones.some(
          (t) => t.tableName === "users" && t.recordId === "user_zombie_1"
        )
      );
    } finally {
      restoreFetch();
      delete process.env.TURSO_DATABASE_URL;
      delete process.env.TURSO_AUTH_TOKEN;
    }
  });

  it("records tombstones on deleteMenuItem/deleteUserAccount, resists pull respawn, and pushes DELETE to Turso", async () => {
    const db = getDb();
    const restaurant = listRestaurants()[0];
    assert.ok(restaurant);

    const createdItem = createMenuItem({
      restaurantId: restaurant.id,
      category: "Specials",
      name: "Temp Tombstone Dish",
      description: "Will be deleted",
      price: 14.0,
      imageUrl: "",
      available: true,
      unavailableReason: "",
      dailyStockLimit: null,
      currentStockCount: null,
      popular: false,
      prepTimeMinutes: 10,
      dietaryTags: [],
      modifiers: [],
      sortOrder: 99,
    });
    const createdUser = createUserAccount({
      scope: "restaurant",
      restaurantId: restaurant.id,
      name: "Temp Staff",
      email: "temp-tombstone-staff@example.com",
      role: "cashier_host",
      title: "Cashier",
      pinCode: "8765",
    });

    assert.equal(deleteMenuItem(createdItem.id), true);
    assert.equal(deleteUserAccount(createdUser.id), true);

    const itemTombstone = db
      .prepare("SELECT * FROM deleted_records WHERE tableName = ? AND recordId = ?")
      .get("menu_items", createdItem.id) as { recordId: string } | undefined;
    const userTombstone = db
      .prepare("SELECT * FROM deleted_records WHERE tableName = ? AND recordId = ?")
      .get("users", createdUser.id) as { recordId: string } | undefined;
    assert.equal(itemTombstone?.recordId, createdItem.id);
    assert.equal(userTombstone?.recordId, createdUser.id);

    // Simulate stale Turso still having the deleted item & user and no remote tombstones yet
    const rawRestaurant = db
      .prepare("SELECT * FROM restaurants WHERE id = ?")
      .get(restaurant.id) as Record<string, unknown>;
    const mockState: MockHranaState = {
      restaurants: [rawRestaurant],
      menu_items: [
        {
          id: createdItem.id,
          restaurantId: restaurant.id,
          category: "Specials",
          name: "Temp Tombstone Dish",
          description: "Stale Turso copy",
          price: 14,
          imageUrl: "",
          available: 1,
          unavailableReason: "",
          dailyStockLimit: null,
          currentStockCount: null,
          popular: 0,
          prepTimeMinutes: 10,
          dietaryTagsJson: "[]",
          modifiersJson: "[]",
          sortOrder: 99,
        },
      ],
      users: [
        {
          id: createdUser.id,
          scope: "restaurant",
          restaurantId: restaurant.id,
          name: "Temp Staff",
          email: "temp-tombstone-staff@example.com",
          phone: "",
          role: "cashier_host",
          status: "active",
          title: "Cashier",
          pinCode: "8765",
          permissionsJson: "[]",
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      deleted_records: [],
      executedStatements: [],
    };

    process.env.TURSO_DATABASE_URL = "https://mock-turso.platerift.test";
    process.env.TURSO_AUTH_TOKEN = "mock-token";
    const restoreFetch = installMockTursoFetch(mockState);
    try {
      // Pull should preserve local tombstones and NOT resurrect deleted item/user
      await pullTursoToLocalSqlite(db);
      assert.equal(
        listMenuItems(restaurant.id).some((m) => m.id === createdItem.id),
        false
      );
      assert.equal(
        listUsers({ restaurantId: restaurant.id }).some((u) => u.id === createdUser.id),
        false
      );

      // Push should send tombstone upsert + DELETE FROM statements to Turso
      await pushLocalSqliteToTurso(db);
      const deleteMenuStmt = mockState.executedStatements.find(
        (s) =>
          s.sql === "DELETE FROM menu_items WHERE id = ?" &&
          s.args[0] === createdItem.id
      );
      const deleteUserStmt = mockState.executedStatements.find(
        (s) =>
          s.sql === "DELETE FROM users WHERE id = ?" &&
          s.args[0] === createdUser.id
      );
      const tombstonePushStmt = mockState.executedStatements.find(
        (s) =>
          s.sql.startsWith("INSERT OR REPLACE INTO deleted_records") &&
          s.args[0] === "menu_items" &&
          s.args[1] === createdItem.id
      );
      assert.ok(deleteMenuStmt, "Expected DELETE FROM menu_items statement pushed to Turso");
      assert.ok(deleteUserStmt, "Expected DELETE FROM users statement pushed to Turso");
      assert.ok(tombstonePushStmt, "Expected tombstone pushed to Turso deleted_records");
    } finally {
      restoreFetch();
      delete process.env.TURSO_DATABASE_URL;
      delete process.env.TURSO_AUTH_TOKEN;
    }
  });
});
