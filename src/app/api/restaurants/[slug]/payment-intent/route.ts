import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  syncPlatformSettingFromTurso,
} from "@/lib/db";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import { isMaskedSecret } from "@/lib/security";
import {
  fetchCloverPakmsPublicKey,
  resolveCloverConfig,
  resolveSquareConfig,
} from "@/lib/squareCloverPosClient";

const VALID_GATEWAYS = [
  "stripe",
  "square",
  "clover",
  "paypal",
  "apple_pay",
] as const;

type PaymentGatewayId = (typeof VALID_GATEWAYS)[number];

function isValidGateway(val: unknown): val is PaymentGatewayId {
  return (
    typeof val === "string" &&
    (VALID_GATEWAYS as readonly string[]).includes(val)
  );
}

function isPlaceholderStripeSecret(
  secret: string | undefined,
  slug: string
): boolean {
  if (!secret) return true;
  const trimmed = secret.trim();
  if (!trimmed || isMaskedSecret(trimmed)) return true;

  const slugCompact = slug.replace(/-/g, "").toLowerCase();
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("placeholder") ||
    lower.includes("simulated") ||
    lower.includes("demo") ||
    lower.includes("secretkey") ||
    lower.includes("stripekey") ||
    lower.includes("bellanapoli") ||
    lower.includes("sakura") ||
    lower.includes("fuego") ||
    trimmed === `sk_test_${slugCompact}`
  ) {
    return true;
  }

  return !(
    trimmed.startsWith("sk_live_") ||
    trimmed.startsWith("sk_test_") ||
    trimmed.startsWith("rk_live_") ||
    trimmed.startsWith("rk_test_")
  );
}

function isPlaceholderStripePublishable(
  key: string | undefined,
  slug: string
): boolean {
  if (!key) return true;
  const trimmed = key.trim();
  if (!trimmed || isMaskedSecret(trimmed)) return true;
  const slugCompact = slug.replace(/-/g, "").toLowerCase();
  const lower = trimmed.toLowerCase();
  return (
    lower.includes("placeholder") ||
    lower.includes("simulated") ||
    lower.includes("stripekey") ||
    trimmed === `pk_test_${slugCompact}`
  );
}

function isPlaceholderPayPalCredential(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed || isMaskedSecret(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return (
    lower.includes("placeholder") ||
    lower.includes("simulated") ||
    lower.includes("demo") ||
    lower.includes("paypalclientid") ||
    lower.includes("paypalsecret") ||
    trimmed.endsWith("_PayPal") ||
    trimmed.endsWith("_Secret")
  );
}

function makeDeterministicHex(seed: string, length = 16): string {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, length);
}

function resolveStripeCredentials(
  restaurantSlug: string,
  paymentMode: "simulated" | "live",
  stripeCfg: {
    publishableKey?: string;
    secretKey?: string;
  }
) {
  const tenantSecret = !isPlaceholderStripeSecret(
    stripeCfg.secretKey,
    restaurantSlug
  )
    ? (stripeCfg.secretKey || "").trim()
    : "";
  const envSecret = !isPlaceholderStripeSecret(
    process.env.STRIPE_SECRET_KEY,
    restaurantSlug
  )
    ? (process.env.STRIPE_SECRET_KEY || "").trim()
    : "";

  const secretKey = tenantSecret || envSecret;
  const isLive =
    Boolean(secretKey) &&
    (paymentMode === "live" ||
      secretKey.startsWith("sk_live_") ||
      secretKey.startsWith("rk_live_") ||
      Boolean(envSecret));

  const tenantPub =
    stripeCfg.publishableKey && !isMaskedSecret(stripeCfg.publishableKey)
      ? stripeCfg.publishableKey.trim()
      : "";
  const envPub = (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  const publishableKey =
    (!isPlaceholderStripePublishable(tenantPub, restaurantSlug)
      ? tenantPub
      : "") ||
    (!isPlaceholderStripePublishable(envPub, restaurantSlug) ? envPub : "") ||
    tenantPub ||
    "pk_test_platerift_sandbox";

  return {
    secretKey,
    publishableKey,
    isLive,
  };
}

async function mintLiveStripePaymentIntent(params: {
  secretKey: string;
  amountCents: number;
  currency: string;
  restaurantId: string;
  restaurantSlug: string;
  customerEmail?: string;
}): Promise<
  | { ok: true; paymentIntentId: string; clientSecret: string }
  | { ok: false; error: string }
> {
  const form = new URLSearchParams({
    amount: String(params.amountCents),
    currency: params.currency,
    "automatic_payment_methods[enabled]": "true",
    "metadata[restaurantId]": params.restaurantId,
    "metadata[restaurantSlug]": params.restaurantSlug,
  });
  if (params.customerEmail) {
    form.set("receipt_email", params.customerEmail);
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      client_secret?: string;
      error?: { message?: string };
    };

    if (!res.ok || !data.id || !data.client_secret) {
      return {
        ok: false,
        error:
          data?.error?.message ||
          `Stripe PaymentIntent creation failed (${res.status}).`,
      };
    }

    return {
      ok: true,
      paymentIntentId: String(data.id),
      clientSecret: String(data.client_secret),
    };
  } catch (err) {
    return {
      ok: false,
      error: `Stripe API error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");

    const { slug } = await context.params;
    const decodedSlug = decodeURIComponent(slug);
    const restaurant = getRestaurantBySlugOrDomain(decodedSlug);
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    if (!isValidGateway(payload.gateway)) {
      return NextResponse.json(
        {
          error:
            "Invalid gateway. Must be one of: stripe, square, clover, paypal, apple_pay.",
        },
        { status: 400 }
      );
    }
    const gateway = payload.gateway;

    const amountCents = payload.amountCents;
    if (
      typeof amountCents !== "number" ||
      !Number.isFinite(amountCents) ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return NextResponse.json(
        { error: "amountCents must be a finite positive integer." },
        { status: 400 }
      );
    }

    const rawCurrency =
      typeof payload.currency === "string" && payload.currency.trim()
        ? payload.currency.trim().toLowerCase()
        : (restaurant.paymentConfig.currency || "usd").trim().toLowerCase() ||
          "usd";
    if (!/^[a-z]{3}$/.test(rawCurrency)) {
      return NextResponse.json(
        { error: "Invalid currency code." },
        { status: 400 }
      );
    }

    const customerEmail =
      typeof payload.customerEmail === "string" && payload.customerEmail.trim()
        ? payload.customerEmail.trim().slice(0, 160)
        : undefined;

    const platformIntegrations = getPlatformIntegrationsConfig();
    const intCfg =
      restaurant.integrationsConfig ||
      buildDefaultIntegrationsConfig(restaurant);
    const slugShort = restaurant.slug.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "store";

    if (gateway === "stripe") {
      if (!restaurant.paymentConfig.stripe.enabled) {
        return NextResponse.json(
          { error: "Stripe payments are not enabled for this restaurant." },
          { status: 400 }
        );
      }

      const stripeCreds = resolveStripeCredentials(
        restaurant.slug,
        restaurant.paymentConfig.mode,
        restaurant.paymentConfig.stripe
      );

      if (stripeCreds.isLive) {
        const liveIntent = await mintLiveStripePaymentIntent({
          secretKey: stripeCreds.secretKey,
          amountCents,
          currency: rawCurrency,
          restaurantId: restaurant.id,
          restaurantSlug: restaurant.slug,
          customerEmail,
        });

        if (!liveIntent.ok) {
          return NextResponse.json(
            { error: liveIntent.error },
            { status: 502 }
          );
        }

        return NextResponse.json({
          mode: "live",
          provider: "stripe",
          paymentIntentId: liveIntent.paymentIntentId,
          clientSecret: liveIntent.clientSecret,
          publishableKey: stripeCreds.publishableKey,
          currency: rawCurrency,
          amountCents,
        });
      }

      const digest = makeDeterministicHex(
        `${restaurant.id}:stripe:${amountCents}:${rawCurrency}`
      );
      const paymentIntentId = `pi_sandbox_${slugShort}_${digest}`;
      return NextResponse.json({
        mode: "sandbox",
        provider: "stripe",
        paymentIntentId,
        clientSecret: `${paymentIntentId}_secret_sandbox`,
        publishableKey: stripeCreds.publishableKey,
        currency: rawCurrency,
        amountCents,
      });
    }

    if (gateway === "square") {
      if (
        !platformIntegrations.square.setupCompleted ||
        !platformIntegrations.square.availableToOwners ||
        restaurant.features.squarePos === false ||
        !intCfg.square.enabled ||
        !intCfg.square.acceptSquareCheckout
      ) {
        return NextResponse.json(
          {
            error:
              "Square online checkout is not currently enabled for this restaurant.",
          },
          { status: 400 }
        );
      }

      const resolved = resolveSquareConfig(
        intCfg.square,
        platformIntegrations.square
      );
      const isLiveSquare =
        resolved.isRealToken &&
        Boolean(resolved.applicationId) &&
        !resolved.applicationId.startsWith("sandbox-sq0idp-platerift") &&
        (intCfg.square.mode === "live" ||
          resolved.environment === "production" ||
          !resolved.applicationId.startsWith("sandbox-sq0idb-"));

      return NextResponse.json({
        mode: isLiveSquare ? "live" : "sandbox",
        provider: "square",
        applicationId: resolved.applicationId || `sandbox-sq0idb-${slugShort}`,
        locationId: resolved.locationId || "main",
        environment: resolved.environment,
        currency: rawCurrency,
        amountCents,
      });
    }

    if (gateway === "clover") {
      if (
        !platformIntegrations.clover.setupCompleted ||
        !platformIntegrations.clover.availableToOwners ||
        restaurant.features.cloverPos === false ||
        !intCfg.clover.enabled ||
        !intCfg.clover.acceptCloverCheckout
      ) {
        return NextResponse.json(
          {
            error:
              "Clover online checkout is not currently enabled for this restaurant.",
          },
          { status: 400 }
        );
      }

      const resolved = resolveCloverConfig(
        intCfg.clover,
        platformIntegrations.clover
      );

      if (resolved.isRealToken) {
        const pakms = await fetchCloverPakmsPublicKey({
          tenantCfg: intCfg.clover,
          platformCfg: platformIntegrations.clover,
        });
        if (pakms.usedLiveApi && pakms.apiAccessKey) {
          return NextResponse.json({
            mode: "live",
            provider: "clover",
            publicKey: pakms.apiAccessKey,
            merchantId: resolved.merchantId || undefined,
            environment: resolved.environment,
            currency: rawCurrency,
            amountCents,
          });
        }
      }

      return NextResponse.json({
        mode: "sandbox",
        provider: "clover",
        publicKey: resolved.publicKey || `pakms_sandbox_${slugShort}`,
        merchantId:
          resolved.merchantId || `CLV_${slugShort.toUpperCase()}_01`,
        environment: resolved.environment,
        currency: rawCurrency,
        amountCents,
      });
    }

    if (gateway === "paypal") {
      if (!restaurant.paymentConfig.paypal.enabled) {
        return NextResponse.json(
          { error: "PayPal payments are not enabled for this restaurant." },
          { status: 400 }
        );
      }

      const clientIdRaw = !isMaskedSecret(
        restaurant.paymentConfig.paypal.clientId
      )
        ? (restaurant.paymentConfig.paypal.clientId || "").trim()
        : "";
      const isLivePayPal =
        restaurant.paymentConfig.mode === "live" &&
        !isPlaceholderPayPalCredential(clientIdRaw) &&
        !isPlaceholderPayPalCredential(
          restaurant.paymentConfig.paypal.clientSecret
        );

      return NextResponse.json({
        mode: isLivePayPal ? "live" : "sandbox",
        provider: "paypal",
        clientId: clientIdRaw || "sb",
        environment: isLivePayPal ? "production" : "sandbox",
        currency: rawCurrency,
        amountCents,
      });
    }

    // Apple Pay (backed by Stripe merchant capability)
    if (!restaurant.paymentConfig.stripe.enabled) {
      return NextResponse.json(
        {
          error:
            "Apple Pay (via Stripe) is not enabled for this restaurant.",
        },
        { status: 400 }
      );
    }

    const stripeCreds = resolveStripeCredentials(
      restaurant.slug,
      restaurant.paymentConfig.mode,
      restaurant.paymentConfig.stripe
    );

    if (stripeCreds.isLive) {
      const liveIntent = await mintLiveStripePaymentIntent({
        secretKey: stripeCreds.secretKey,
        amountCents,
        currency: rawCurrency,
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        customerEmail,
      });
      if (!liveIntent.ok) {
        return NextResponse.json({ error: liveIntent.error }, { status: 502 });
      }
      return NextResponse.json({
        mode: "live",
        provider: "apple_pay",
        clientId: stripeCreds.publishableKey,
        publishableKey: stripeCreds.publishableKey,
        paymentIntentId: liveIntent.paymentIntentId,
        clientSecret: liveIntent.clientSecret,
        environment: "production",
        currency: rawCurrency,
        amountCents,
      });
    }

    const digest = makeDeterministicHex(
      `${restaurant.id}:apple_pay:${amountCents}:${rawCurrency}`
    );
    return NextResponse.json({
      mode: "sandbox",
      provider: "apple_pay",
      clientId: stripeCreds.publishableKey,
      publishableKey: stripeCreds.publishableKey,
      paymentIntentId: `pi_applepay_sandbox_${slugShort}_${digest}`,
      environment: "sandbox",
      currency: rawCurrency,
      amountCents,
    });
  } catch (error) {
    console.error("POST /api/restaurants/[slug]/payment-intent error:", error);
    return NextResponse.json(
      { error: "Failed to initialize payment intent" },
      { status: 500 }
    );
  }
}
