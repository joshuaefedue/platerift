import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest, NextResponse } from "next/server";
import {
  attachSessionCookie,
  authorizePlatformAdmin,
  authorizeRestaurantStaff,
  clearSessionCookie,
  createSessionToken,
  getRawSessionToken,
  getSessionFromRequest,
  isStrictAuthEnforced,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";
import { getRestaurantBySlugOrDomain } from "@/lib/db";
import {
  DELETE as deleteAuth,
  GET as getAuth,
  POST as postAuth,
} from "@/app/api/auth/route";

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

before(() => {
  for (const key of [
    ...TURSO_ENV_KEYS,
    "PLATERIFT_ENFORCE_AUTH",
    "SESSION_SECRET",
    "PLATERIFT_SESSION_SECRET",
    "OAUTH_STATE_SECRET",
  ]) {
    savedEnv[key] = process.env[key];
  }
  for (const key of TURSO_ENV_KEYS) {
    delete process.env[key];
  }
  process.env.SESSION_SECRET = "test-session-hmac-secret-2026";
  delete process.env.PLATERIFT_ENFORCE_AUTH;
});

after(() => {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
});

function makeReq(
  url = "http://localhost:3000/api/test",
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, { headers });
}

describe("Session HMAC token signing & verification", () => {
  it("signs and verifies a valid session token roundtrip", () => {
    const token = createSessionToken({
      sub: "user_1",
      actor: "staff",
      scope: "restaurant",
      role: "restaurant_owner",
      email: "owner@bellanapoli.com",
      name: "Marco Rossi",
      restaurantId: "rest_bella_napoli",
    });

    const verified = verifySessionToken(token);
    assert.ok(verified);
    assert.equal(verified.sub, "user_1");
    assert.equal(verified.actor, "staff");
    assert.equal(verified.scope, "restaurant");
    assert.equal(verified.role, "restaurant_owner");
    assert.equal(verified.restaurantId, "rest_bella_napoli");
    assert.ok(verified.exp > verified.iat);
  });

  it("rejects tampered payloads, tampered signatures, malformed strings, and expired tokens", () => {
    const token = createSessionToken({
      sub: "user_1",
      actor: "staff",
      scope: "restaurant",
      role: "cashier_host",
      email: "cashier@bellanapoli.com",
      name: "Cashier",
      restaurantId: "rest_bella_napoli",
    });
    const [payloadB64, sig] = token.split(".");

    // Tamper signature (same length & different length)
    const flippedSig = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    assert.equal(verifySessionToken(`${payloadB64}.${flippedSig}`), null);
    assert.equal(verifySessionToken(`${payloadB64}.${sig.slice(0, -3)}`), null);

    // Tamper payload (escalate role to super_admin)
    const decoded = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as Record<string, unknown>;
    decoded.scope = "platform";
    decoded.role = "super_admin";
    const tamperedPayloadB64 = Buffer.from(
      JSON.stringify(decoded),
      "utf8"
    ).toString("base64url");
    assert.equal(verifySessionToken(`${tamperedPayloadB64}.${sig}`), null);

    // Malformed / empty tokens
    assert.equal(verifySessionToken(null), null);
    assert.equal(verifySessionToken(undefined), null);
    assert.equal(verifySessionToken(""), null);
    assert.equal(verifySessionToken("not-a-valid-token"), null);

    // Expired token (ttl <= 0 -> exp <= nowSec)
    const expiredToken = createSessionToken(
      {
        sub: "user_1",
        actor: "staff",
        scope: "restaurant",
        role: "restaurant_owner",
        email: "owner@bellanapoli.com",
        name: "Owner",
        restaurantId: "rest_bella_napoli",
      },
      -10
    );
    assert.equal(verifySessionToken(expiredToken), null);
  });

  it("extracts session tokens from Cookie and Authorization Bearer headers and sets/clears cookies", () => {
    const token = createSessionToken({
      sub: "u_cookie",
      actor: "staff",
      scope: "platform",
      role: "super_admin",
      email: "admin@platerift.com",
      name: "Admin",
      restaurantId: null,
    });

    const cookieReq = makeReq("http://localhost:3000/api/platform/integrations", {
      cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    });
    assert.equal(getRawSessionToken(cookieReq), token);
    assert.equal(getSessionFromRequest(cookieReq)?.sub, "u_cookie");

    const bearerReq = makeReq("http://localhost:3000/api/platform/integrations", {
      authorization: `Bearer ${token}`,
    });
    assert.equal(getRawSessionToken(bearerReq), token);
    assert.equal(getSessionFromRequest(bearerReq)?.sub, "u_cookie");

    const res = attachSessionCookie(NextResponse.json({ ok: true }), token);
    const attachedCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(attachedCookie);
    assert.equal(attachedCookie.value, token);
    assert.equal(attachedCookie.httpOnly, true);
    assert.equal(attachedCookie.sameSite, "lax");
    assert.equal(attachedCookie.path, "/");

    clearSessionCookie(res);
    const clearedCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(clearedCookie);
    assert.equal(clearedCookie.value, "");
    assert.equal(clearedCookie.maxAge, 0);
  });
});

describe("authorizePlatformAdmin & authorizeRestaurantStaff RBAC", () => {
  it("allows unauthenticated demo requests only when PLATERIFT_ENFORCE_AUTH !== 'true', and returns 401 when enforced", () => {
    delete process.env.PLATERIFT_ENFORCE_AUTH;
    assert.equal(isStrictAuthEnforced(), false);

    const anonReq = makeReq();
    assert.deepEqual(authorizePlatformAdmin(anonReq), { ok: true, session: null });
    assert.deepEqual(authorizeRestaurantStaff(anonReq, "rest_1", "orders"), {
      ok: true,
      session: null,
    });

    process.env.PLATERIFT_ENFORCE_AUTH = "true";
    try {
      assert.equal(isStrictAuthEnforced(), true);
      const platRes = authorizePlatformAdmin(anonReq);
      assert.equal(platRes.ok, false);
      if (!platRes.ok) assert.equal(platRes.status, 401);

      const staffRes = authorizeRestaurantStaff(anonReq, "rest_1", "orders");
      assert.equal(staffRes.ok, false);
      if (!staffRes.ok) assert.equal(staffRes.status, 401);
    } finally {
      delete process.env.PLATERIFT_ENFORCE_AUTH;
    }
  });

  it("rejects invalid or expired cookies with 401 even in demo mode", () => {
    delete process.env.PLATERIFT_ENFORCE_AUTH;

    const tamperedReq = makeReq("http://localhost:3000/api/test", {
      cookie: `${SESSION_COOKIE_NAME}=bad.signature`,
    });
    const platRes = authorizePlatformAdmin(tamperedReq);
    assert.equal(platRes.ok, false);
    if (!platRes.ok) assert.equal(platRes.status, 401);

    const staffRes = authorizeRestaurantStaff(tamperedReq, "rest_1", "menu");
    assert.equal(staffRes.ok, false);
    if (!staffRes.ok) assert.equal(staffRes.status, 401);

    const expiredToken = createSessionToken(
      {
        sub: "u_exp",
        actor: "staff",
        scope: "platform",
        role: "super_admin",
        email: "admin@platerift.com",
        name: "Admin",
        restaurantId: null,
      },
      -5
    );
    const expiredReq = makeReq("http://localhost:3000/api/test", {
      cookie: `${SESSION_COOKIE_NAME}=${expiredToken}`,
    });
    const expiredRes = authorizeRestaurantStaff(expiredReq, "rest_1");
    assert.equal(expiredRes.ok, false);
    if (!expiredRes.ok) assert.equal(expiredRes.status, 401);
  });

  it("enforces platform scope, role allowlists, tenant isolation, customer rejection, and ROLE_DEFINITIONS tab permissions", () => {
    const ownerRestA = createSessionToken({
      sub: "u_owner_a",
      actor: "staff",
      scope: "restaurant",
      role: "restaurant_owner",
      email: "owner@a.test",
      name: "Owner A",
      restaurantId: "rest_a",
    });
    const chefRestA = createSessionToken({
      sub: "u_chef_a",
      actor: "staff",
      scope: "restaurant",
      role: "kitchen_chef",
      email: "chef@a.test",
      name: "Chef A",
      restaurantId: "rest_a",
    });
    const customerRestA = createSessionToken({
      sub: "cust_a",
      actor: "customer",
      scope: "customer",
      role: "customer",
      email: "guest@a.test",
      name: "Guest A",
      restaurantId: "rest_a",
    });
    const platformBilling = createSessionToken({
      sub: "u_billing",
      actor: "staff",
      scope: "platform",
      role: "billing_admin",
      email: "billing@platerift.com",
      name: "Billing Admin",
      restaurantId: null,
    });
    const superAdmin = createSessionToken({
      sub: "u_super",
      actor: "staff",
      scope: "platform",
      role: "super_admin",
      email: "founder@platerift.com",
      name: "Founder",
      restaurantId: null,
    });

    const ownerAsPlat = authorizePlatformAdmin(
      makeReq("http://localhost:3000/api/platform/integrations", {
        cookie: `${SESSION_COOKIE_NAME}=${ownerRestA}`,
      })
    );
    assert.equal(ownerAsPlat.ok, false);
    if (!ownerAsPlat.ok) assert.equal(ownerAsPlat.status, 403);

    const billingAsSuper = authorizePlatformAdmin(
      makeReq("http://localhost:3000/api/platform/turso-sync", {
        cookie: `${SESSION_COOKIE_NAME}=${platformBilling}`,
      }),
      ["super_admin"]
    );
    assert.equal(billingAsSuper.ok, false);
    if (!billingAsSuper.ok) assert.equal(billingAsSuper.status, 403);

    const custAsStaff = authorizeRestaurantStaff(
      makeReq("http://localhost:3000/api/restaurants/a/orders", {
        cookie: `${SESSION_COOKIE_NAME}=${customerRestA}`,
      }),
      "rest_a",
      "orders"
    );
    assert.equal(custAsStaff.ok, false);
    if (!custAsStaff.ok) assert.equal(custAsStaff.status, 403);

    const wrongTenant = authorizeRestaurantStaff(
      makeReq("http://localhost:3000/api/restaurants/b/orders", {
        cookie: `${SESSION_COOKIE_NAME}=${ownerRestA}`,
      }),
      "rest_b",
      "orders"
    );
    assert.equal(wrongTenant.ok, false);
    if (!wrongTenant.ok) assert.equal(wrongTenant.status, 403);

    const chefMenu = authorizeRestaurantStaff(
      makeReq("http://localhost:3000/api/restaurants/a/menu", {
        cookie: `${SESSION_COOKIE_NAME}=${chefRestA}`,
      }),
      "rest_a",
      "menu"
    );
    assert.equal(chefMenu.ok, true);

    const chefPayments = authorizeRestaurantStaff(
      makeReq("http://localhost:3000/api/restaurants/a/payments", {
        cookie: `${SESSION_COOKIE_NAME}=${chefRestA}`,
      }),
      "rest_a",
      "payments"
    );
    assert.equal(chefPayments.ok, false);
    if (!chefPayments.ok) assert.equal(chefPayments.status, 403);

    const chefTeam = authorizeRestaurantStaff(
      makeReq("http://localhost:3000/api/users", {
        cookie: `${SESSION_COOKIE_NAME}=${chefRestA}`,
      }),
      "rest_a",
      "team"
    );
    assert.equal(chefTeam.ok, false);
    if (!chefTeam.ok) assert.equal(chefTeam.status, 403);

    const superOnTenant = authorizeRestaurantStaff(
      makeReq("http://localhost:3000/api/restaurants/b/orders", {
        cookie: `${SESSION_COOKIE_NAME}=${superAdmin}`,
      }),
      "rest_b",
      "payments"
    );
    assert.equal(superOnTenant.ok, true);
  });
});

describe("/api/auth POST / GET / DELETE cookie session lifecycle", () => {
  it("sets, verifies, and clears platerift_session HTTP-only cookie across staff and customer auth", async () => {
    const bella = getRestaurantBySlugOrDomain("bella-napoli");
    assert.ok(bella, "Expected seeded bella-napoli restaurant");

    // 1. Invalid staff PIN -> 401 and no cookie
    const badLoginRes = await postAuth(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.1.1",
        },
        body: JSON.stringify({
          actor: "staff",
          emailOrPin: "9999",
          restaurantSlug: "bella-napoli",
        }),
      })
    );
    assert.equal(badLoginRes.status, 401);
    assert.equal(badLoginRes.cookies.get(SESSION_COOKIE_NAME), undefined);

    // 2. Cross-tenant staff login attempt -> 403
    const crossTenantRes = await postAuth(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.1.2",
        },
        body: JSON.stringify({
          actor: "staff",
          scope: "restaurant",
          emailOrPin: "2201", // Sakura Sushi owner
          restaurantSlug: "bella-napoli",
        }),
      })
    );
    assert.equal(crossTenantRes.status, 403);

    // 3. Valid Bella Napoli staff login -> 200 + HTTP-only platerift_session cookie
    const staffLoginRes = await postAuth(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.1.3",
        },
        body: JSON.stringify({
          actor: "staff",
          scope: "restaurant",
          emailOrPin: "1101",
          restaurantSlug: "bella-napoli",
        }),
      })
    );
    assert.equal(staffLoginRes.status, 200);
    const staffCookie = staffLoginRes.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(staffCookie?.value);
    assert.equal(staffCookie.httpOnly, true);

    const decodedStaff = verifySessionToken(staffCookie.value);
    assert.ok(decodedStaff);
    assert.equal(decodedStaff.actor, "staff");
    assert.equal(decodedStaff.scope, "restaurant");
    assert.equal(decodedStaff.role, "restaurant_owner");
    assert.equal(decodedStaff.restaurantId, bella.id);

    // 4. GET /api/auth verifies the cookie
    const getAuthedRes = await getAuth(
      new NextRequest("http://localhost:3000/api/auth", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${staffCookie.value}`,
        },
      })
    );
    assert.equal(getAuthedRes.status, 200);
    const getAuthedJson = (await getAuthedRes.json()) as {
      authenticated: boolean;
      session: { role: string; restaurantId: string | null } | null;
    };
    assert.equal(getAuthedJson.authenticated, true);
    assert.equal(getAuthedJson.session?.role, "restaurant_owner");
    assert.equal(getAuthedJson.session?.restaurantId, bella.id);

    // 5. GET /api/auth without cookie -> unauthenticated
    const getAnonRes = await getAuth(new NextRequest("http://localhost:3000/api/auth"));
    assert.equal(getAnonRes.status, 200);
    const getAnonJson = (await getAnonRes.json()) as {
      authenticated: boolean;
      session: unknown;
    };
    assert.equal(getAnonJson.authenticated, false);
    assert.equal(getAnonJson.session, null);

    // 6. Customer login sets customer session cookie
    const custLoginRes = await postAuth(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.1.4",
        },
        body: JSON.stringify({
          actor: "customer",
          mode: "register",
          restaurantSlug: "bella-napoli",
          email: "session-test-guest@example.com",
          name: "Session Test Guest",
        }),
      })
    );
    assert.equal(custLoginRes.status, 200);
    const custCookie = custLoginRes.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(custCookie?.value);
    const decodedCust = verifySessionToken(custCookie.value);
    assert.equal(decodedCust?.actor, "customer");
    assert.equal(decodedCust?.scope, "customer");
    assert.equal(decodedCust?.restaurantId, bella.id);

    // 7. DELETE /api/auth clears platerift_session cookie
    const delRes = await deleteAuth();
    assert.equal(delRes.status, 200);
    const delJson = (await delRes.json()) as { ok: boolean; authenticated: boolean };
    assert.equal(delJson.ok, true);
    assert.equal(delJson.authenticated, false);
    const cleared = delRes.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(cleared);
    assert.equal(cleared.value, "");
    assert.equal(cleared.maxAge, 0);
  });
});
