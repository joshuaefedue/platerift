import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  getPlatformIntegrationsConfig,
  listRestaurants,
  updatePlatformIntegrationsConfig,
} from "@/lib/db";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import {
  createSignedOAuthState,
  sanitizeRestaurantForPublicStorefront,
  verifySignedOAuthState,
  verifySquareWebhookSignature,
} from "@/lib/security";
import { GET as getRestaurants } from "@/app/api/restaurants/route";
import { POST as postCloverWebhook } from "@/app/api/webhooks/clover/route";
import { POST as postDoordashWebhook } from "@/app/api/webhooks/doordash/route";
import { POST as postSquareWebhook } from "@/app/api/webhooks/square/route";
import { POST as postVapiWebhook } from "@/app/api/webhooks/vapi/route";

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
let savedPlatformConfig: ReturnType<typeof getPlatformIntegrationsConfig> | null =
  null;

before(() => {
  for (const key of [
    ...TURSO_ENV_KEYS,
    "DOORDASH_WEBHOOK_SECRET",
    "VAPI_WEBHOOK_SECRET",
    "OAUTH_STATE_SECRET",
  ]) {
    savedEnv[key] = process.env[key];
  }
  for (const key of TURSO_ENV_KEYS) {
    delete process.env[key];
  }
  savedPlatformConfig = getPlatformIntegrationsConfig();
});

after(() => {
  if (savedPlatformConfig) {
    updatePlatformIntegrationsConfig(savedPlatformConfig);
  }
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
});

describe("Public storefront sanitization & GET /api/restaurants", () => {
  it("strips all private keys, tokens, and secrets in sanitizeRestaurantForPublicStorefront", () => {
    const base = listRestaurants()[0];
    assert.ok(base, "Expected at least one seeded restaurant");
    const defaultInt = buildDefaultIntegrationsConfig(base);

    const sensitive = {
      ...base,
      paymentConfig: {
        ...base.paymentConfig,
        stripe: {
          ...base.paymentConfig.stripe,
          publishableKey: "pk_live_public_123",
          secretKey: "sk_live_top_secret_999",
          webhookSecret: "whsec_top_secret_999",
        },
        paypal: {
          ...base.paymentConfig.paypal,
          clientId: "paypal_pub_client",
          clientSecret: "paypal_top_secret_999",
        },
      },
      commsConfig: {
        ...base.commsConfig,
        sms: {
          ...base.commsConfig.sms,
          twilioAuthToken: "twilio_top_secret_999",
        },
        email: {
          ...base.commsConfig.email,
          apiKeyOrSmtpHost: "re_live_top_secret_999",
        },
      },
      integrationsConfig: {
        ...defaultInt,
        doordashDrive: {
          ...defaultInt.doordashDrive,
          signingSecret: "dd_signing_secret_999",
        },
        square: {
          ...defaultInt.square,
          applicationId: "sq0idp-public-app",
          accessToken: "sq0atp-secret-access",
          refreshToken: "sq0rtp-secret-refresh",
          webhookSignatureKey: "sq-webhook-secret",
        },
        clover: {
          ...defaultInt.clover,
          publicKey: "pakms_public_key_ok",
          privateToken: "clv-private-oauth-token",
          webhookSecret: "clv-webhook-secret",
        },
        vapi: {
          ...defaultInt.vapi,
          publicKey: "vapi_pub_ok",
          privateKey: "vapi-private-key-999",
        },
      },
    };

    const sanitized = sanitizeRestaurantForPublicStorefront(sensitive);

    // Public identifiers preserved
    assert.equal(sanitized.name, base.name);
    assert.equal(sanitized.paymentConfig.stripe.publishableKey, "pk_live_public_123");
    assert.equal(sanitized.paymentConfig.paypal.clientId, "paypal_pub_client");
    assert.equal(sanitized.integrationsConfig?.square.applicationId, "sq0idp-public-app");
    assert.equal(sanitized.integrationsConfig?.clover.publicKey, "pakms_public_key_ok");
    assert.equal(sanitized.integrationsConfig?.vapi.publicKey, "vapi_pub_ok");

    // All secrets cleared
    assert.equal(sanitized.paymentConfig.stripe.secretKey, "");
    assert.equal(sanitized.paymentConfig.stripe.webhookSecret, "");
    assert.equal(sanitized.paymentConfig.paypal.clientSecret, "");
    assert.equal(sanitized.commsConfig.sms.twilioAuthToken, "");
    assert.equal(sanitized.commsConfig.email.apiKeyOrSmtpHost, "");
    assert.equal(sanitized.integrationsConfig?.doordashDrive.signingSecret, "");
    assert.equal(sanitized.integrationsConfig?.square.accessToken, "");
    assert.equal(sanitized.integrationsConfig?.square.refreshToken, "");
    assert.equal(sanitized.integrationsConfig?.square.webhookSignatureKey, "");
    assert.equal(sanitized.integrationsConfig?.clover.privateToken, "");
    assert.equal(sanitized.integrationsConfig?.clover.webhookSecret, "");
    assert.equal(sanitized.integrationsConfig?.vapi.privateKey, "");

    // Original object untouched
    assert.equal(sensitive.paymentConfig.stripe.secretKey, "sk_live_top_secret_999");
  });

  it("GET /api/restaurants?view=public returns sanitized tenants with zero secret keys or PINs", async () => {
    const req = new NextRequest("http://localhost:3000/api/restaurants?view=public");
    const res = await getRestaurants(req);
    assert.equal(res.status, 200);

    const payload = (await res.json()) as {
      restaurants: Array<Record<string, unknown>>;
    };
    assert.ok(Array.isArray(payload.restaurants));
    assert.ok(payload.restaurants.length >= 1);

    for (const r of payload.restaurants) {
      const paymentConfig = r.paymentConfig as {
        stripe: { secretKey: string; webhookSecret: string };
        paypal: { clientSecret: string };
      };
      const commsConfig = r.commsConfig as {
        sms: { twilioAuthToken: string };
        email: { apiKeyOrSmtpHost: string };
      };
      const integrationsConfig = r.integrationsConfig as
        | {
            doordashDrive: { signingSecret: string };
            square: {
              accessToken: string;
              refreshToken?: string;
              webhookSignatureKey: string;
            };
            clover: { privateToken: string; webhookSecret: string };
            vapi: { privateKey: string };
          }
        | undefined;

      assert.equal(paymentConfig.stripe.secretKey, "");
      assert.equal(paymentConfig.stripe.webhookSecret, "");
      assert.equal(paymentConfig.paypal.clientSecret, "");
      assert.equal(commsConfig.sms.twilioAuthToken, "");
      assert.equal(commsConfig.email.apiKeyOrSmtpHost, "");

      if (integrationsConfig) {
        assert.equal(integrationsConfig.doordashDrive.signingSecret, "");
        assert.equal(integrationsConfig.square.accessToken, "");
        assert.equal(integrationsConfig.square.refreshToken || "", "");
        assert.equal(integrationsConfig.square.webhookSignatureKey, "");
        assert.equal(integrationsConfig.clover.privateToken, "");
        assert.equal(integrationsConfig.clover.webhookSecret, "");
        assert.equal(integrationsConfig.vapi.privateKey, "");
      }

      assert.equal("pinCode" in r, false);
    }
  });
});

describe("OAuth CSRF state signing & verification", () => {
  it("completes roundtrip and rejects tampered slug, tampered signature, or expired timestamp", () => {
    process.env.OAUTH_STATE_SECRET = "unit-test-oauth-hmac-secret";
    const state = createSignedOAuthState("bella-napoli");
    const verified = verifySignedOAuthState(state);
    assert.deepEqual(verified, { valid: true, slug: "bella-napoli" });

    // Tamper signature
    const parts = state.split(".");
    assert.equal(parts.length, 3);
    const badSig = `${parts[0]}.${parts[1]}.${"A".repeat(parts[2].length)}`;
    assert.equal(verifySignedOAuthState(badSig).valid, false);

    // Tamper slug
    const tamperedSlug = `sakura-sushi.${parts[1]}.${parts[2]}`;
    assert.equal(verifySignedOAuthState(tamperedSlug).valid, false);

    // Expired timestamp (> 1 hour old)
    const oldTs = Math.floor(Date.now() / 1000) - 7200;
    const oldPayload = `bella-napoli.${oldTs}`;
    const oldSig = crypto
      .createHmac("sha256", "unit-test-oauth-hmac-secret")
      .update(oldPayload)
      .digest("base64url")
      .slice(0, 22);
    assert.equal(
      verifySignedOAuthState(`${oldPayload}.${oldSig}`).valid,
      false
    );

    // Empty state
    assert.equal(verifySignedOAuthState("").valid, false);
  });
});

describe("Webhook HMAC & timingSafeEqual authentication", () => {
  it("verifies Square webhook HMAC-SHA256 signatures and rejects invalid requests", async () => {
    const signatureKey = "sq_live_prod_hmac_key_7788";
    const notificationUrl = "https://platerift.com/api/webhooks/square";
    const rawBody = JSON.stringify({
      type: "inventory.count.updated",
      restaurant_slug: "bella-napoli",
      item_name: "Margherita",
      quantity: 12,
    });
    const validSig = crypto
      .createHmac("sha256", signatureKey)
      .update(`${notificationUrl}${rawBody}`, "utf8")
      .digest("base64");

    assert.equal(
      verifySquareWebhookSignature({
        rawBody,
        signatureHeader: validSig,
        signatureKey,
        notificationUrl,
      }),
      true
    );
    assert.equal(
      verifySquareWebhookSignature({
        rawBody,
        signatureHeader: "bad-sig",
        signatureKey,
        notificationUrl,
      }),
      false
    );
    assert.equal(
      verifySquareWebhookSignature({
        rawBody: `${rawBody} `,
        signatureHeader: validSig,
        signatureKey,
        notificationUrl,
      }),
      false
    );

    updatePlatformIntegrationsConfig({
      square: {
        ...getPlatformIntegrationsConfig().square,
        webhookSignatureKey: signatureKey,
        webhookUrl: notificationUrl,
      },
    });

    const badReq = new NextRequest("http://localhost:3000/api/webhooks/square", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-square-hmacsha256-signature": "invalid-signature",
      },
      body: rawBody,
    });
    const badRes = await postSquareWebhook(badReq);
    assert.equal(badRes.status, 401);

    const okReq = new NextRequest("http://localhost:3000/api/webhooks/square", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-square-hmacsha256-signature": validSig,
      },
      body: rawBody,
    });
    const okRes = await postSquareWebhook(okReq);
    assert.equal(okRes.status, 200);
    const okData = (await okRes.json()) as { received: boolean };
    assert.equal(okData.received, true);
  });

  it("enforces DOORDASH_WEBHOOK_SECRET via timingSafeEqual", async () => {
    process.env.DOORDASH_WEBHOOK_SECRET = "dd-test-secret-xyz-123";
    const body = JSON.stringify({
      event_name: "DASHER_CONFIRMED",
      restaurant_slug: "bella-napoli",
    });

    // Missing header -> 401
    const missingRes = await postDoordashWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/doordash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    );
    assert.equal(missingRes.status, 401);

    // Wrong length secret -> 401
    const badRes = await postDoordashWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/doordash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong",
        },
        body,
      })
    );
    assert.equal(badRes.status, 401);

    // Valid Bearer token -> 200
    const bearerRes = await postDoordashWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/doordash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer dd-test-secret-xyz-123",
        },
        body,
      })
    );
    assert.equal(bearerRes.status, 200);

    // Valid x-doordash-webhook-secret header -> 200
    const headerRes = await postDoordashWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/doordash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-doordash-webhook-secret": "dd-test-secret-xyz-123",
        },
        body,
      })
    );
    assert.equal(headerRes.status, 200);
  });

  it("enforces VAPI_WEBHOOK_SECRET via timingSafeEqual", async () => {
    process.env.VAPI_WEBHOOK_SECRET = "vapi-test-secret-abc-456";
    const body = JSON.stringify({
      message: {
        type: "assistant-request",
        call: { metadata: { restaurantSlug: "bella-napoli" } },
      },
    });

    const missingRes = await postVapiWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/vapi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    );
    assert.equal(missingRes.status, 401);

    const wrongRes = await postVapiWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/vapi", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vapi-secret": "wrong-secret",
        },
        body,
      })
    );
    assert.equal(wrongRes.status, 401);

    const validRes = await postVapiWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/vapi", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vapi-secret": "vapi-test-secret-abc-456",
        },
        body,
      })
    );
    assert.equal(validRes.status, 200);
  });

  it("enforces Clover X-Clover-Auth verification code via timingSafeEqual", async () => {
    const verificationCode = "clv_prod_verify_secret_987";
    updatePlatformIntegrationsConfig({
      clover: {
        ...getPlatformIntegrationsConfig().clover,
        webhookVerificationCode: verificationCode,
      },
    });

    const body = JSON.stringify({
      verificationCode,
    });

    const badRes = await postCloverWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/clover", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clover-auth": "wrong-clover-code",
        },
        body,
      })
    );
    assert.equal(badRes.status, 401);

    const emptyHeaderRes = await postCloverWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/clover", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clover-auth": "",
        },
        body,
      })
    );
    assert.equal(emptyHeaderRes.status, 401);

    const okRes = await postCloverWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/clover", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clover-auth": verificationCode,
        },
        body,
      })
    );
    assert.equal(okRes.status, 200);
    const data = (await okRes.json()) as { verified: boolean };
    assert.equal(data.verified, true);
  });
});
