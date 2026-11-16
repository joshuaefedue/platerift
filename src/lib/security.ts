import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type {
  PlatformIntegrationsConfig,
  PlatformTwilioConfig,
  RestaurantTenant,
} from "./types";

const REDACTED_MASK = "••••••••";

function maskSecretValue(val: string | undefined): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (!trimmed) return "";
  if (trimmed === REDACTED_MASK || trimmed.startsWith("••••")) return trimmed;
  if (trimmed.length <= 6) return REDACTED_MASK;
  return `${REDACTED_MASK}${trimmed.slice(-4)}`;
}

export function isMaskedSecret(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return val.includes(REDACTED_MASK) || val.startsWith("••••");
}

/**
 * Strips sensitive merchant API keys, OAuth private tokens, signing secrets,
 * and internal customer/staff PII before sending a RestaurantTenant to the public storefront.
 */
export function sanitizeRestaurantForPublicStorefront(
  restaurant: RestaurantTenant
): RestaurantTenant {
  return {
    ...restaurant,
    paymentConfig: {
      ...restaurant.paymentConfig,
      stripe: {
        ...restaurant.paymentConfig.stripe,
        secretKey: "",
        webhookSecret: "",
      },
      paypal: {
        ...restaurant.paymentConfig.paypal,
        clientSecret: "",
      },
    },
    commsConfig: {
      ...restaurant.commsConfig,
      sms: {
        ...restaurant.commsConfig.sms,
        twilioAuthToken: "",
      },
      email: {
        ...restaurant.commsConfig.email,
        apiKeyOrSmtpHost: "",
      },
    },
    integrationsConfig: restaurant.integrationsConfig
      ? {
          ...restaurant.integrationsConfig,
          doordashDrive: {
            ...restaurant.integrationsConfig.doordashDrive,
            signingSecret: "",
          },
          square: {
            ...restaurant.integrationsConfig.square,
            accessToken: "",
            refreshToken: "",
            webhookSignatureKey: "",
          },
          clover: {
            ...restaurant.integrationsConfig.clover,
            privateToken: "",
            webhookSecret: "",
          },
          vapi: {
            ...restaurant.integrationsConfig.vapi,
            privateKey: "",
          },
        }
      : undefined,
  };
}

/**
 * Masks master platform partner secrets when returning PlatformIntegrationsConfig to the browser.
 */
export function sanitizePlatformIntegrationsForClient(
  config: PlatformIntegrationsConfig
): PlatformIntegrationsConfig {
  return {
    ...config,
    doordashDrive: {
      ...config.doordashDrive,
      partnerSigningSecret: maskSecretValue(
        config.doordashDrive.partnerSigningSecret
      ),
    },
    square: {
      ...config.square,
      partnerClientSecret: maskSecretValue(config.square.partnerClientSecret),
      webhookSignatureKey: maskSecretValue(config.square.webhookSignatureKey),
    },
    clover: {
      ...config.clover,
      appSecret: maskSecretValue(config.clover.appSecret),
    },
    vapi: {
      ...config.vapi,
      masterPrivateKey: maskSecretValue(config.vapi.masterPrivateKey),
    },
  };
}

/**
 * Masks master Twilio authToken when returning PlatformTwilioConfig to the browser.
 */
export function sanitizePlatformTwilioForClient(
  config: PlatformTwilioConfig
): PlatformTwilioConfig {
  return {
    ...config,
    authToken: maskSecretValue(config.authToken),
  };
}

/**
 * Preserves existing stored secret if the client submitted a masked placeholder (`••••1234`).
 */
export function preserveIfMasked(
  incomingVal: string | undefined,
  existingVal: string
): string {
  if (incomingVal === undefined) return existingVal;
  if (isMaskedSecret(incomingVal)) return existingVal;
  return incomingVal;
}

/**
 * Sanitizes HTML strings in email campaigns or user notes to prevent stored XSS
 * (`<script>`, `javascript:`, inline event handlers like `onerror=`, `onload=`).
 */
export function sanitizeHtmlContent(rawHtml: string | undefined): string {
  if (!rawHtml) return "";
  return String(rawHtml)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

// ============================================================================
// OAUTH 2.0 CSRF STATE SIGNING & VERIFICATION
// ============================================================================

function getHmacSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.TURSO_AUTH_TOKEN ||
    process.env.DOORDASH_SIGNING_SECRET ||
    "platerift-multi-tenant-hmac-state-secret-2026"
  );
}

export function createSignedOAuthState(restaurantSlug: string): string {
  const cleanSlug = restaurantSlug.trim();
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${cleanSlug}.${timestamp}`;
  const sig = crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 22);
  return `${payload}.${sig}`;
}

export function verifySignedOAuthState(stateParam: string): {
  valid: boolean;
  slug: string;
} {
  if (!stateParam) return { valid: false, slug: "bella-napoli" };
  const parts = stateParam.split(".");
  if (parts.length !== 3) {
    // Allow legacy plain slug if valid slug format
    const clean = stateParam.replace(/[^a-zA-Z0-9_-]/g, "");
    return { valid: Boolean(clean), slug: clean || "bella-napoli" };
  }

  const [slug, tsStr, providedSig] = parts;
  const payload = `${slug}.${tsStr}`;
  const expectedSig = crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 22);

  const nowSec = Math.floor(Date.now() / 1000);
  const ageSec = nowSec - Number(tsStr || 0);
  const isFresh = ageSec >= -60 && ageSec <= 3600; // 1 hour window

  let sigMatches = false;
  try {
    sigMatches = crypto.timingSafeEqual(
      Buffer.from(providedSig),
      Buffer.from(expectedSig)
    );
  } catch {
    sigMatches = false;
  }

  return {
    valid: sigMatches && isFresh,
    slug: slug || "bella-napoli",
  };
}

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION (SQUARE HMAC-SHA256 & CLOVER VERIFICATION)
// ============================================================================

export function verifySquareWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  signatureKey: string | undefined;
  notificationUrl: string;
}): boolean {
  // If no signature header is sent (e.g. local dashboard test), allow
  if (!params.signatureHeader) return true;
  if (
    !params.signatureKey ||
    params.signatureKey.startsWith("sq_wh_") ||
    isMaskedSecret(params.signatureKey)
  ) {
    return true;
  }

  const combined = `${params.notificationUrl}${params.rawBody}`;
  const expected = crypto
    .createHmac("sha256", params.signatureKey)
    .update(combined, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(params.signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// IN-MEMORY RATE LIMITER FOR AUTH & CHECKOUT ENDPOINTS
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __plateriftRateLimitMap:
    | Map<string, { count: number; resetAtMs: number }>
    | undefined;
}

export function checkRateLimit(
  req: NextRequest,
  bucket: string,
  maxRequests: number,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  if (!global.__plateriftRateLimitMap) {
    global.__plateriftRateLimitMap = new Map();
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = global.__plateriftRateLimitMap.get(key);

  if (!entry || now > entry.resetAtMs) {
    global.__plateriftRateLimitMap.set(key, {
      count: 1,
      resetAtMs: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}
