import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  createOrder,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listEmailCampaigns,
  listMenuItems,
  listOrders,
  syncPlatformSettingFromTurso,
  updateOrderStatus,
} from "@/lib/db";
import {
  evaluateRestaurantAvailability,
  findMatchingBlackoutWindow,
} from "@/lib/availability";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import {
  createDoorDashDriveDelivery,
  resolveDoorDashCredentials,
} from "@/lib/doordashDriveClient";
import {
  createCloverChargeAndAtomicOrder,
  createSquareOrderAndPayment,
} from "@/lib/squareCloverPosClient";
import { checkRateLimit, isMaskedSecret } from "@/lib/security";
import {
  authorizeRestaurantStaff,
  getRawSessionToken,
  verifySessionToken,
} from "@/lib/session";
import type { Order, OrderLineItem, OrderStatus, OrderType } from "@/lib/types";

const SEEDED_PROMO_CODES: Record<string, number> = {
  NAPOLIVIP15: 15,
  WEEKEND20: 20,
  TRUFFLE10: 10,
  OMAKASE10: 10,
  WELCOME10: 10,
};

const VALID_ORDER_STATUSES: readonly OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

const VALID_ORDER_TYPES: readonly OrderType[] = [
  "pickup",
  "delivery",
  "dine_in",
];

type CheckoutGateway = "stripe" | "paypal" | "square" | "clover" | "apple_pay";

const VALID_CHECKOUT_GATEWAYS: readonly CheckoutGateway[] = [
  "stripe",
  "paypal",
  "square",
  "clover",
  "apple_pay",
];

function isPlaceholderStripeSecret(secret: string | undefined, slug: string): boolean {
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

function isSandboxTokenFormat(token: string): boolean {
  return (
    token.startsWith("pm_sandbox_") ||
    token.startsWith("tok_sandbox_") ||
    token.startsWith("pi_sandbox_") ||
    token.startsWith("cnon:sandbox-") ||
    token === "cnon:card-nonce-ok" ||
    token.startsWith("clv_sandbox_") ||
    token.startsWith("clv_tok_") ||
    token.startsWith("PAYPAL_SANDBOX_") ||
    token.startsWith("applepay_tok_")
  );
}

function validatePaymentTokenForGateway(
  gateway: CheckoutGateway,
  token: string,
  mode?: "live" | "sandbox"
): { valid: boolean; error?: string } {
  const isSandboxToken = isSandboxTokenFormat(token);
  if (mode === "live" && isSandboxToken) {
    return {
      valid: false,
      error: `Sandbox payment token cannot be used in live payment mode for ${gateway}.`,
    };
  }
  if (mode === "sandbox" && !isSandboxToken) {
    return {
      valid: false,
      error: `Payment token format does not match sandbox mode for ${gateway}.`,
    };
  }

  if (gateway === "stripe") {
    const validSandbox =
      token.startsWith("pm_sandbox_") ||
      token.startsWith("tok_sandbox_") ||
      token.startsWith("pi_sandbox_");
    const validLive =
      /^(pm|tok|pi|src)_[A-Za-z0-9_]{4,}$/.test(token) && !isSandboxToken;
    if (mode === "sandbox" && !validSandbox) {
      return { valid: false, error: "Invalid sandbox Stripe payment token." };
    }
    if (mode === "live" && !validLive) {
      return { valid: false, error: "Invalid live Stripe payment token." };
    }
    if (!validSandbox && !validLive) {
      return { valid: false, error: "Invalid Stripe payment token format." };
    }
    return { valid: true };
  }

  if (gateway === "apple_pay") {
    const validSandbox =
      token.startsWith("applepay_tok_") || token.startsWith("pm_sandbox_");
    const validLive =
      /^(pm|tok|pi|applepay)_[A-Za-z0-9_]{4,}$/.test(token) && !isSandboxToken;
    if (mode === "sandbox" && !validSandbox) {
      return { valid: false, error: "Invalid sandbox Apple Pay token." };
    }
    if (mode === "live" && !validLive) {
      return { valid: false, error: "Invalid live Apple Pay token." };
    }
    if (!validSandbox && !validLive) {
      return { valid: false, error: "Invalid Apple Pay token format." };
    }
    return { valid: true };
  }

  if (gateway === "square") {
    const validSandbox =
      token.startsWith("cnon:sandbox-") || token === "cnon:card-nonce-ok";
    const validLive =
      (token.startsWith("cnon:") || token.startsWith("bnon:")) && !validSandbox;
    if (mode === "sandbox" && !validSandbox) {
      return { valid: false, error: "Invalid sandbox Square payment token." };
    }
    if (mode === "live" && !validLive) {
      return { valid: false, error: "Invalid live Square payment token." };
    }
    if (!validSandbox && !validLive) {
      return { valid: false, error: "Invalid Square payment token format." };
    }
    return { valid: true };
  }

  if (gateway === "clover") {
    const validSandbox =
      token.startsWith("clv_sandbox_") || token.startsWith("clv_tok_");
    const validLive = token.startsWith("clv_") && !validSandbox;
    if (mode === "sandbox" && !validSandbox) {
      return { valid: false, error: "Invalid sandbox Clover payment token." };
    }
    if (mode === "live" && !validLive) {
      return { valid: false, error: "Invalid live Clover payment token." };
    }
    if (!validSandbox && !validLive) {
      return { valid: false, error: "Invalid Clover payment token format." };
    }
    return { valid: true };
  }

  // paypal
  const validSandbox = token.startsWith("PAYPAL_SANDBOX_");
  const validLive =
    /^(PAYPAL_LIVE_|PAYID-|[A-Za-z0-9_-]{8,})/.test(token) &&
    !token.toUpperCase().includes("SANDBOX");
  if (mode === "sandbox" && !validSandbox) {
    return { valid: false, error: "Invalid sandbox PayPal payment token." };
  }
  if (mode === "live" && !validLive) {
    return { valid: false, error: "Invalid live PayPal payment token." };
  }
  if (!validSandbox && !validLive) {
    return { valid: false, error: "Invalid PayPal payment token format." };
  }
  return { valid: true };
}

function redactTokenTail(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  return `••••${trimmed.slice(-4)}`;
}

function sanitizeOrderForPublicTracking(order: Order): Order {
  return {
    ...order,
    customerEmail: "",
    customerPhone: "",
    deliveryAddress: "",
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await hydrateFromTursoIfNeeded();
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const orderId = req.nextUrl.searchParams.get("orderId")?.trim() || "";
    if (orderId) {
      const rawToken = getRawSessionToken(req);
      const session = rawToken !== null ? verifySessionToken(rawToken) : null;
      if (rawToken !== null && !session) {
        return NextResponse.json(
          { error: "Invalid or expired session token. Please sign in again." },
          { status: 401 }
        );
      }

      if (session) {
        if (session.actor === "staff") {
          if (
            session.scope !== "platform" &&
            session.restaurantId !== restaurant.id
          ) {
            return NextResponse.json(
              { error: "Cross-tenant access denied for this restaurant." },
              { status: 403 }
            );
          }
        } else if (session.actor === "customer") {
          if (session.restaurantId !== restaurant.id) {
            return NextResponse.json(
              { error: "Cross-tenant access denied for this restaurant." },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Forbidden session actor." },
            { status: 403 }
          );
        }
      }

      const order = listOrders(restaurant.id).find((o) => o.id === orderId);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (session) {
        if (session.actor === "staff") {
          return NextResponse.json({ order });
        }

        const ownsOrder =
          (order.customerId && order.customerId === session.sub) ||
          (session.email &&
            order.customerEmail.toLowerCase() === session.email.toLowerCase());
        if (!ownsOrder) {
          return NextResponse.json(
            { error: "Access denied for this customer order." },
            { status: 403 }
          );
        }
        return NextResponse.json({ order });
      }

      return NextResponse.json({ order: sanitizeOrderForPublicTracking(order) });
    }

    const authz = authorizeRestaurantStaff(req, restaurant.id, "orders");
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.error },
        { status: authz.status }
      );
    }

    const orders = listOrders(restaurant.id);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const rate = checkRateLimit(req, "order_checkout", 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many checkout requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    await hydrateFromTursoIfNeeded();
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const existingOrders = listOrders(restaurant.id);

    // 1. Check ordering availability (manual pause, weekly schedule, blackout windows, order limits)
    const availability = evaluateRestaurantAvailability(
      restaurant,
      existingOrders,
      body.simDay,
      body.simTime,
      body.simDate
    );
    if (!availability.allowed) {
      return NextResponse.json(
        {
          error: `${availability.title}: ${availability.message}`,
          availability,
        },
        { status: 403 }
      );
    }

    // 2. Validate requested fulfillment option before processing items
    const requestedOrderType = (body.orderType || "pickup") as OrderType;
    if (!VALID_ORDER_TYPES.includes(requestedOrderType)) {
      return NextResponse.json(
        { error: `Invalid fulfillment type '${String(body.orderType)}'.` },
        { status: 400 }
      );
    }
    if (requestedOrderType === "pickup" && !restaurant.features.pickup) {
      return NextResponse.json(
        {
          error: `🛍️ Pickup fulfillment is currently disabled by ${restaurant.name}. Please choose another fulfillment option.`,
        },
        { status: 400 }
      );
    }
    if (requestedOrderType === "delivery" && !restaurant.features.delivery) {
      return NextResponse.json(
        {
          error: `🛵 Delivery fulfillment is currently disabled by ${restaurant.name}. Please choose another fulfillment option.`,
        },
        { status: 400 }
      );
    }
    if (requestedOrderType === "dine_in" && !restaurant.features.dineInQr) {
      return NextResponse.json(
        {
          error: `🍽️ Dine-In fulfillment is currently disabled by ${restaurant.name}. Please choose another fulfillment option.`,
        },
        { status: 400 }
      );
    }
    if (requestedOrderType === "pickup" && !body.scheduledFor) {
      const activeDayRule = restaurant.weeklySchedule.find(
        (d) => d.day.toLowerCase() === availability.checkedDay.toLowerCase()
      );
      if (activeDayRule && activeDayRule.pickupEnabled === false) {
        return NextResponse.json(
          {
            error: `🛍️ Pickup is not available on ${activeDayRule.day}s at ${restaurant.name}. Please choose another fulfillment option.`,
          },
          { status: 400 }
        );
      }
    }

    // 3. Verify all items are currently available and recalculate authoritative server-side prices
    const menuItems = listMenuItems(restaurant.id);
    const rawItems: OrderLineItem[] = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: "Your order must contain at least one menu item." },
        { status: 400 }
      );
    }

    const verifiedItems: OrderLineItem[] = [];
    for (const line of rawItems) {
      const mItem = menuItems.find((m) => m.id === line.menuItemId);
      if (mItem && !mItem.available) {
        return NextResponse.json(
          {
            error: `Sorry, "${mItem.name}" was just marked unavailable (${
              mItem.unavailableReason || "Sold out"
            }). Please remove it from your cart.`,
          },
          { status: 400 }
        );
      }
      const safeQty = Math.min(99, Math.max(1, Math.round(Number(line.quantity) || 1)));
      const authoritativeUnitPrice = mItem
        ? mItem.price
        : Math.max(0, Number(line.unitPrice) || 0);
      const safeMods = Array.isArray(line.selectedModifiers)
        ? line.selectedModifiers.map((mod) => {
            const gName = String(mod.groupName || "");
            const oLabel = String(mod.optionLabel || "");
            const matchedGroup = mItem?.modifiers?.find(
              (g) => g.name.toLowerCase() === gName.toLowerCase()
            );
            const matchedOpt = matchedGroup?.options.find(
              (o) => o.label.toLowerCase() === oLabel.toLowerCase()
            );
            return {
              groupName: gName,
              optionLabel: oLabel,
              priceDelta: matchedOpt
                ? Math.max(0, matchedOpt.priceDelta)
                : Math.max(0, Number(mod.priceDelta) || 0),
            };
          })
        : [];
      const modTotalDelta = safeMods.reduce((s, m) => s + m.priceDelta, 0);
      const itemTotal = Number(
        ((authoritativeUnitPrice + modTotalDelta) * safeQty).toFixed(2)
      );
      verifiedItems.push({
        menuItemId: line.menuItemId,
        name: mItem ? mItem.name : String(line.name || "Menu Item"),
        quantity: safeQty,
        unitPrice: authoritativeUnitPrice,
        selectedModifiers: safeMods,
        itemTotal,
        notes: line.notes ? String(line.notes).slice(0, 300) : undefined,
      });
    }

    const computedSubtotal = Number(
      verifiedItems.reduce((s, i) => s + i.itemTotal, 0).toFixed(2)
    );

    // 4. Enforce restaurant minOrderAmount, maxOrderAmount, and deliveryMinOrderAmount on computedSubtotal
    if (
      restaurant.minOrderAmount > 0 &&
      computedSubtotal < restaurant.minOrderAmount
    ) {
      return NextResponse.json(
        {
          error: `Minimum order subtotal at ${restaurant.name} is $${restaurant.minOrderAmount.toFixed(
            2
          )}.`,
        },
        { status: 400 }
      );
    }
    if (
      restaurant.maxOrderAmount > 0 &&
      computedSubtotal > restaurant.maxOrderAmount
    ) {
      return NextResponse.json(
        {
          error: `Maximum order subtotal at ${restaurant.name} is $${restaurant.maxOrderAmount.toFixed(
            2
          )}.`,
        },
        { status: 400 }
      );
    }
    if (
      requestedOrderType === "delivery" &&
      restaurant.features.deliveryMinOrderAmount &&
      computedSubtotal < restaurant.features.deliveryMinOrderAmount
    ) {
      return NextResponse.json(
        {
          error: `🛵 Delivery orders at ${restaurant.name} require a minimum subtotal of $${restaurant.features.deliveryMinOrderAmount.toFixed(
            2
          )}.`,
        },
        { status: 400 }
      );
    }

    // 5. Verify scheduled blackout windows, day/pickup availability, and per-time-slot capacity
    if (body.scheduledFor) {
      const [schedDatePart, schedTimePart] = String(body.scheduledFor)
        .trim()
        .split(/\s+/);
      if (schedDatePart && schedTimePart) {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ] as const;
        const parsedDate = new Date(`${schedDatePart}T12:00:00`);
        if (!isNaN(parsedDate.getTime())) {
          const dayName = dayNames[parsedDate.getDay()];
          const schedBlackout = findMatchingBlackoutWindow(
            restaurant.blackoutWindows,
            schedDatePart,
            dayName,
            schedTimePart
          );
          if (schedBlackout) {
            return NextResponse.json(
              {
                error:
                  schedBlackout.reasonMessage ||
                  `Scheduled time falls during a blackout window (${schedBlackout.title}).`,
              },
              { status: 403 }
            );
          }

          const dayRule = restaurant.weeklySchedule.find(
            (d) => d.day === dayName
          );
          if (dayRule) {
            if (!dayRule.enabled) {
              return NextResponse.json(
                {
                  error: `${restaurant.name} does not accept online orders on ${dayRule.day}s.`,
                },
                { status: 400 }
              );
            }
            if (
              requestedOrderType === "pickup" &&
              dayRule.pickupEnabled === false
            ) {
              return NextResponse.json(
                {
                  error: `🛍️ Pickup is not available on ${dayRule.day}s at ${restaurant.name}.`,
                },
                { status: 400 }
              );
            }

            const slotMaxOrders =
              dayRule.pickupSlotCapacities?.[schedTimePart] ??
              dayRule.pickupSlotMaxOrders ??
              5;
            const bookedInSlot = existingOrders.filter(
              (o) =>
                o.status !== "cancelled" &&
                o.scheduledFor &&
                o.scheduledFor.trim() === `${schedDatePart} ${schedTimePart}`
            ).length;

            if (bookedInSlot >= slotMaxOrders) {
              return NextResponse.json(
                {
                  error: `⏳ Time slot ${schedTimePart} on ${schedDatePart} (${dayName}) has reached its maximum capacity (${bookedInSlot}/${slotMaxOrders} orders booked). Please select another time slot.`,
                },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // 6. Sync platform settings and calculate authoritative discount, tax, delivery fee, and total
    await syncPlatformSettingFromTurso("platform_integrations");
    await syncPlatformSettingFromTurso("twilio_gateway");
    const platformIntegrations = getPlatformIntegrationsConfig();
    const intCfg =
      restaurant.integrationsConfig ||
      buildDefaultIntegrationsConfig(restaurant);

    let validatedDiscountPercent = 0;
    const submittedPromoCode =
      typeof body.promoCode === "string"
        ? body.promoCode.trim().toUpperCase()
        : "";

    if (restaurant.features.promoCodes && submittedPromoCode) {
      const campaigns = listEmailCampaigns(restaurant.id);
      const matchedCampaign = campaigns.find(
        (c) =>
          typeof c.promoCode === "string" &&
          c.promoCode.trim().toUpperCase() === submittedPromoCode &&
          Number(c.discountPercent) > 0
      );
      if (matchedCampaign) {
        validatedDiscountPercent = Math.min(
          50,
          Math.max(0, Number(matchedCampaign.discountPercent) || 0)
        );
      } else if (SEEDED_PROMO_CODES[submittedPromoCode] !== undefined) {
        validatedDiscountPercent = Math.min(
          50,
          SEEDED_PROMO_CODES[submittedPromoCode]
        );
      }
    }

    const safeDiscount =
      validatedDiscountPercent > 0
        ? Number(
            Math.min(
              computedSubtotal * 0.5,
              (computedSubtotal * validatedDiscountPercent) / 100
            ).toFixed(2)
          )
        : 0;
    const discountedSub = Math.max(
      0,
      Number((computedSubtotal - safeDiscount).toFixed(2))
    );
    const computedTax = Number(
      (
        (discountedSub * (restaurant.paymentConfig.taxRatePercent || 0)) /
        100
      ).toFixed(2)
    );

    const doordashDriveEnabled =
      platformIntegrations.doordashDrive.setupCompleted &&
      platformIntegrations.doordashDrive.availableToOwners &&
      restaurant.features.doordashDrive !== false &&
      intCfg.doordashDrive.enabled;

    const freeDeliveryThreshold = doordashDriveEnabled
      ? intCfg.doordashDrive.freeDeliveryThreshold ??
        restaurant.paymentConfig.freeDeliveryMin ??
        0
      : restaurant.paymentConfig.freeDeliveryMin ?? 0;

    const baseDeliveryFee = doordashDriveEnabled
      ? intCfg.doordashDrive.customerDeliveryFeeShare
      : restaurant.paymentConfig.deliveryFee;

    const serverDeliveryFee =
      requestedOrderType === "delivery"
        ? freeDeliveryThreshold > 0 && discountedSub >= freeDeliveryThreshold
          ? 0
          : Number(Math.max(0, Number(baseDeliveryFee) || 0).toFixed(2))
        : 0;

    const safeTip =
      restaurant.features.tipping === false
        ? 0
        : Number(
            Math.max(
              0,
              Number.isFinite(Number(body.tip)) ? Number(body.tip) : 0
            ).toFixed(2)
          );

    const computedTotal = Number(
      (discountedSub + computedTax + serverDeliveryFee + safeTip).toFixed(2)
    );

    // 7. Verify payment gateway, payment mode/tokens, and optional live Stripe PaymentIntent

    if (
      body.paymentGateway !== undefined &&
      body.paymentGateway !== null &&
      body.paymentGateway !== "" &&
      !VALID_CHECKOUT_GATEWAYS.includes(
        String(body.paymentGateway).toLowerCase() as CheckoutGateway
      )
    ) {
      return NextResponse.json(
        { error: "Invalid paymentGateway specified." },
        { status: 400 }
      );
    }

    if (
      body.paymentMethod !== undefined &&
      body.paymentMethod !== null &&
      body.paymentMethod !== "" &&
      !VALID_CHECKOUT_GATEWAYS.includes(
        String(body.paymentMethod).toLowerCase() as CheckoutGateway
      )
    ) {
      return NextResponse.json(
        { error: "Invalid paymentMethod specified." },
        { status: 400 }
      );
    }

    const rawGateway =
      typeof body.paymentGateway === "string" && body.paymentGateway.trim()
        ? body.paymentGateway.trim().toLowerCase()
        : typeof body.paymentMethod === "string" && body.paymentMethod.trim()
          ? body.paymentMethod.trim().toLowerCase()
          : "stripe";

    const effectiveGateway: CheckoutGateway = VALID_CHECKOUT_GATEWAYS.includes(
      rawGateway as CheckoutGateway
    )
      ? (rawGateway as CheckoutGateway)
      : "stripe";

    const method: "stripe" | "paypal" | "square" | "clover" =
      effectiveGateway === "apple_pay" ? "stripe" : effectiveGateway;

    if (method === "stripe" && !restaurant.paymentConfig.stripe.enabled) {
      return NextResponse.json(
        {
          error:
            effectiveGateway === "apple_pay"
              ? "Apple Pay (via Stripe) is not enabled for this restaurant."
              : "Stripe payments are not enabled for this restaurant.",
        },
        { status: 400 }
      );
    }
    if (method === "paypal" && !restaurant.paymentConfig.paypal.enabled) {
      return NextResponse.json(
        { error: "PayPal payments are not enabled for this restaurant." },
        { status: 400 }
      );
    }
    if (
      method === "square" &&
      (!platformIntegrations.square.setupCompleted ||
        !platformIntegrations.square.availableToOwners ||
        restaurant.features.squarePos === false ||
        !intCfg.square.enabled ||
        !intCfg.square.acceptSquareCheckout)
    ) {
      return NextResponse.json(
        {
          error:
            "Square online checkout is not currently enabled for this restaurant.",
        },
        { status: 400 }
      );
    }
    if (
      method === "clover" &&
      (!platformIntegrations.clover.setupCompleted ||
        !platformIntegrations.clover.availableToOwners ||
        restaurant.features.cloverPos === false ||
        !intCfg.clover.enabled ||
        !intCfg.clover.acceptCloverCheckout)
    ) {
      return NextResponse.json(
        {
          error:
            "Clover online checkout is not currently enabled for this restaurant.",
        },
        { status: 400 }
      );
    }

    let requestedPaymentMode: "live" | "sandbox" | undefined;
    if (
      body.paymentMode !== undefined &&
      body.paymentMode !== null &&
      body.paymentMode !== ""
    ) {
      if (body.paymentMode !== "live" && body.paymentMode !== "sandbox") {
        return NextResponse.json(
          { error: "Invalid paymentMode. Must be 'live' or 'sandbox'." },
          { status: 400 }
        );
      }
      requestedPaymentMode = body.paymentMode;
    }

    const rawPaymentToken =
      typeof body.paymentToken === "string" ? body.paymentToken.trim() : "";
    const rawPaymentIntentId =
      typeof body.paymentIntentId === "string"
        ? body.paymentIntentId.trim()
        : "";

    if (rawPaymentToken) {
      const compactDigits = rawPaymentToken.replace(/[\s-]/g, "");
      if (/^\d{13,19}$/.test(compactDigits)) {
        return NextResponse.json(
          {
            error:
              "Raw payment card numbers are not accepted. Use a gateway payment token.",
          },
          { status: 400 }
        );
      }
      if (/^pi_.*_secret_/i.test(rawPaymentToken)) {
        return NextResponse.json(
          { error: "Client secret cannot be submitted as paymentToken." },
          { status: 400 }
        );
      }
      const tokenCheck = validatePaymentTokenForGateway(
        effectiveGateway,
        rawPaymentToken,
        requestedPaymentMode
      );
      if (!tokenCheck.valid) {
        return NextResponse.json(
          { error: tokenCheck.error || "Invalid payment token." },
          { status: 400 }
        );
      }
    }

    const safeIntentId = rawPaymentIntentId.includes("_secret_")
      ? rawPaymentIntentId.split("_secret_")[0]
      : rawPaymentIntentId;

    if (safeIntentId) {
      const isSandboxIntent =
        safeIntentId.startsWith("pi_sandbox_") ||
        safeIntentId.startsWith("pi_applepay_sandbox_") ||
        safeIntentId.toLowerCase().includes("sandbox");
      if (requestedPaymentMode === "live" && isSandboxIntent) {
        return NextResponse.json(
          { error: "Sandbox paymentIntentId cannot be used in live mode." },
          { status: 400 }
        );
      }
      if (
        requestedPaymentMode === "sandbox" &&
        method === "stripe" &&
        safeIntentId.startsWith("pi_") &&
        !isSandboxIntent
      ) {
        return NextResponse.json(
          { error: "Live paymentIntentId cannot be used in sandbox mode." },
          { status: 400 }
        );
      }
    }

    const inferredPaymentMode: "live" | "sandbox" | undefined =
      requestedPaymentMode ||
      (rawPaymentToken
        ? isSandboxTokenFormat(rawPaymentToken)
          ? "sandbox"
          : "live"
        : safeIntentId
          ? safeIntentId.toLowerCase().includes("sandbox")
            ? "sandbox"
            : "live"
          : undefined);

    let verifiedPaymentStatus: "paid" | "pending" = "paid";

    // Verify live Stripe PaymentIntent status via Stripe REST API when live mode + real pi_ intent ID are supplied
    if (
      method === "stripe" &&
      inferredPaymentMode === "live" &&
      safeIntentId.startsWith("pi_") &&
      !safeIntentId.startsWith("pi_sandbox_") &&
      !safeIntentId.startsWith("pi_applepay_sandbox_")
    ) {
      const tenantStripeSecret = !isPlaceholderStripeSecret(
        restaurant.paymentConfig.stripe.secretKey,
        restaurant.slug
      )
        ? restaurant.paymentConfig.stripe.secretKey.trim()
        : "";
      const envStripeSecret = !isPlaceholderStripeSecret(
        process.env.STRIPE_SECRET_KEY,
        restaurant.slug
      )
        ? (process.env.STRIPE_SECRET_KEY || "").trim()
        : "";
      const stripeSecret = tenantStripeSecret || envStripeSecret;

      if (!stripeSecret) {
        return NextResponse.json(
          {
            error:
              "Live Stripe credentials are not configured on this restaurant to verify PaymentIntent.",
          },
          { status: 400 }
        );
      }

      const verifyRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(
          safeIntentId
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
          },
          cache: "no-store",
        }
      );

      const intentData = (await verifyRes.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        amount?: number;
        error?: { message?: string };
      };

      if (!verifyRes.ok) {
        return NextResponse.json(
          {
            error:
              intentData?.error?.message ||
              `Stripe PaymentIntent verification failed (${verifyRes.status}).`,
          },
          { status: 402 }
        );
      }

      if (
        intentData.status !== "succeeded" &&
        intentData.status !== "requires_capture" &&
        intentData.status !== "processing"
      ) {
        return NextResponse.json(
          {
            error: `Stripe PaymentIntent has not completed (status: ${String(
              intentData.status || "unknown"
            )}).`,
          },
          { status: 402 }
        );
      }

      if (typeof intentData.amount === "number") {
        const expectedCents = Math.round(computedTotal * 100);
        if (Math.abs(intentData.amount - expectedCents) > 1) {
          return NextResponse.json(
            {
              error:
                "Stripe PaymentIntent amount does not match server-computed order total.",
            },
            { status: 400 }
          );
        }
      }

      verifiedPaymentStatus =
        intentData.status === "processing" ? "pending" : "paid";
    }

    const randToken = Math.random().toString(36).slice(2, 9).toUpperCase();
    const slugShort = restaurant.slug.replace(/-/g, "").slice(0, 8);
    let paymentReference =
      method === "stripe"
        ? safeIntentId ||
          (inferredPaymentMode === "sandbox"
            ? `pi_sandbox_${slugShort}_${randToken}`
            : `pi_3Q9_${slugShort}_${randToken}`)
        : method === "paypal"
          ? safeIntentId || `PAYID-${slugShort.toUpperCase()}-${randToken}`
          : method === "square"
            ? `sq_pay_${slugShort}_${randToken}`
            : `clv_pay_${slugShort}_${randToken}`;

    const doordashAllowed =
      platformIntegrations.doordashDrive.setupCompleted &&
      platformIntegrations.doordashDrive.availableToOwners &&
      restaurant.features.doordashDrive !== false &&
      intCfg.doordashDrive.enabled &&
      intCfg.doordashDrive.autoDispatchOnConfirm;

    let preDispatchedDeliveryTracking = undefined;
    if (requestedOrderType === "delivery" && doordashAllowed) {
      const ddCreds = resolveDoorDashCredentials(
        intCfg.doordashDrive,
        platformIntegrations.doordashDrive
      );
      if (
        ddCreds.isRealKey ||
        intCfg.doordashDrive.mode === "live" ||
        platformIntegrations.doordashDrive.mode === "live"
      ) {
        const dispatchRes = await createDoorDashDriveDelivery({
          restaurant,
          orderNumber: `DD-${randToken}`,
          orderSubtotal: computedSubtotal,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          deliveryAddress: body.deliveryAddress || "",
          dropoffInstructions: body.specialInstructions || "",
          tipAmount: safeTip,
          items: verifiedItems,
          platformConfig: platformIntegrations.doordashDrive,
        });
        preDispatchedDeliveryTracking = dispatchRes.tracking;
      }
    }

    // Execute Square Orders API + Payments API or Clover Ecommerce Charge + Atomic Order when selected or auto-push enabled
    const preSyncedPos: {
      squareOrderId?: string;
      squareSyncedAt?: string;
      cloverOrderId?: string;
      cloverSyncedAt?: string;
    } = {};

    const nowIso = new Date().toISOString();
    const shouldFireSquare =
      method === "square" ||
      (platformIntegrations.square.setupCompleted &&
        platformIntegrations.square.availableToOwners &&
        restaurant.features.squarePos !== false &&
        intCfg.square.enabled &&
        intCfg.square.autoPushOrdersToPos);

    if (shouldFireSquare) {
      const sqRes = await createSquareOrderAndPayment({
        restaurant,
        orderNumber: randToken,
        orderType: requestedOrderType,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        deliveryAddress: body.deliveryAddress,
        items: verifiedItems,
        totalAmountDollars: computedTotal,
        tipAmountDollars: safeTip,
        sourceIdToken:
          method === "square"
            ? String(body.paymentToken || "cnon:card-nonce-ok")
            : undefined,
        appFeePercent: restaurant.paymentConfig.serviceFeePercent,
        platformCfg: platformIntegrations.square,
      });
      preSyncedPos.squareOrderId = sqRes.squareOrderId;
      preSyncedPos.squareSyncedAt = nowIso;
      if (method === "square" && sqRes.squarePaymentId) {
        paymentReference = sqRes.squarePaymentId;
      }
    }

    const shouldFireClover =
      method === "clover" ||
      (platformIntegrations.clover.setupCompleted &&
        platformIntegrations.clover.availableToOwners &&
        restaurant.features.cloverPos !== false &&
        intCfg.clover.enabled &&
        intCfg.clover.autoPushOrdersToKitchenKds);

    if (shouldFireClover) {
      const clvRes = await createCloverChargeAndAtomicOrder({
        restaurant,
        orderNumber: randToken,
        items: verifiedItems,
        totalAmountDollars: computedTotal,
        taxAmountDollars: computedTax,
        tipAmountDollars: safeTip,
        cardToken:
          method === "clover"
            ? String(body.paymentToken || `clv_tok_${randToken.toLowerCase()}`)
            : undefined,
        customerIp:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "127.0.0.1",
        platformCfg: platformIntegrations.clover,
      });
      preSyncedPos.cloverOrderId = clvRes.cloverOrderId;
      preSyncedPos.cloverSyncedAt = nowIso;
      if (method === "clover" && clvRes.cloverChargeId) {
        paymentReference = clvRes.cloverChargeId;
      }
    }

    const hasPaymentMetadata =
      Boolean(rawPaymentToken) ||
      Boolean(safeIntentId) ||
      Boolean(requestedPaymentMode) ||
      effectiveGateway === "apple_pay";

    if (hasPaymentMetadata) {
      const modeTag = inferredPaymentMode || "sandbox";
      const tokenTail = rawPaymentToken
        ? `:${redactTokenTail(rawPaymentToken)}`
        : "";
      paymentReference = `${paymentReference} [${effectiveGateway}:${modeTag}:${verifiedPaymentStatus}${tokenTail}]`;
    }

    const result = createOrder({
      restaurantId: restaurant.id,
      customerName: String(body.customerName || "Guest").slice(0, 120),
      customerEmail: String(body.customerEmail || "guest@example.com").slice(
        0,
        160
      ),
      customerPhone: String(body.customerPhone || "").slice(0, 40),
      orderType: requestedOrderType,
      tableNumber: body.tableNumber,
      deliveryAddress: body.deliveryAddress,
      items: verifiedItems,
      subtotal: computedSubtotal,
      tax: computedTax,
      deliveryFee: serverDeliveryFee,
      tip: safeTip,
      discount: safeDiscount,
      total: computedTotal,
      paymentMethod: method,
      paymentStatus: verifiedPaymentStatus,
      paymentReference,
      status: "confirmed",
      specialInstructions: String(body.specialInstructions || "").slice(0, 500),
      scheduledFor: body.scheduledFor,
      deliveryTracking: preDispatchedDeliveryTracking,
      posSync: preSyncedPos,
    });

    await commitToTurso();
    return NextResponse.json(
      {
        ...result,
        paymentVerification: {
          gateway: effectiveGateway,
          mode: inferredPaymentMode || "sandbox",
          paymentStatus: verifiedPaymentStatus,
          redactedReference: paymentReference,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST order error:", error);
    return NextResponse.json(
      { error: "Failed to process order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await hydrateFromTursoIfNeeded();
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const authz = authorizeRestaurantStaff(req, restaurant.id, "orders");
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.error },
        { status: authz.status }
      );
    }

    const body = await req.json();
    if (!body.orderId || !body.status) {
      return NextResponse.json(
        { error: "orderId and status are required" },
        { status: 400 }
      );
    }

    if (!VALID_ORDER_STATUSES.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Invalid order status '${String(
            body.status
          )}'. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (!listOrders(restaurant.id).some((o) => o.id === body.orderId)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const result = updateOrderStatus(body.orderId, body.status);
    if (!result.order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await commitToTurso();
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH order status error:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
