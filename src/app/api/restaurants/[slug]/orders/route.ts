import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  createOrder,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listMenuItems,
  listOrders,
  updateOrderStatus,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import {
  createDoorDashDriveDelivery,
  resolveDoorDashCredentials,
} from "@/lib/doordashDriveClient";
import {
  createCloverChargeAndAtomicOrder,
  createSquareOrderAndPayment,
} from "@/lib/squareCloverPosClient";
import { checkRateLimit } from "@/lib/security";
import type { OrderLineItem } from "@/lib/types";

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
    if (!body.bypassScheduleForDemo) {
      const availability = evaluateRestaurantAvailability(
        restaurant,
        existingOrders,
        body.simDay,
        body.simTime
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
    }

    // 2. Verify all items are currently available and recalculate authoritative server-side prices
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
        ? line.selectedModifiers.map((mod) => ({
            groupName: String(mod.groupName || ""),
            optionLabel: String(mod.optionLabel || ""),
            priceDelta: Math.max(0, Number(mod.priceDelta) || 0),
          }))
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
    const safeDiscount = Math.min(
      computedSubtotal * 0.5,
      Math.max(0, Number(body.discount) || 0)
    );
    const discountedSub = Math.max(0, computedSubtotal - safeDiscount);
    const computedTax = Number(
      (
        (discountedSub * (restaurant.paymentConfig.taxRatePercent || 0)) /
        100
      ).toFixed(2)
    );
    const safeDeliveryFee = Math.max(0, Number(body.deliveryFee) || 0);
    const safeTip = Math.max(0, Number(body.tip) || 0);
    const computedTotal = Number(
      (discountedSub + computedTax + safeDeliveryFee + safeTip).toFixed(2)
    );

    // 2.2 Verify requested fulfillment option is enabled by the restaurant owner
    const requestedOrderType = body.orderType || "pickup";
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
    if (
      requestedOrderType === "delivery" &&
      restaurant.features.deliveryMinOrderAmount &&
      Number(body.subtotal || 0) < restaurant.features.deliveryMinOrderAmount
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

    // 2.5 Verify per-time-slot order capacity when scheduledFor is provided
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
          const dayRule = restaurant.weeklySchedule.find(
            (d) => d.day === dayName
          );
          if (dayRule) {
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

    // 3. Verify payment gateway is enabled for this restaurant
    const platformIntegrations = getPlatformIntegrationsConfig();
    const intCfg =
      restaurant.integrationsConfig ||
      buildDefaultIntegrationsConfig(restaurant);

    const method: "stripe" | "paypal" | "square" | "clover" =
      body.paymentMethod === "paypal"
        ? "paypal"
        : body.paymentMethod === "square"
        ? "square"
        : body.paymentMethod === "clover"
        ? "clover"
        : "stripe";

    if (method === "stripe" && !restaurant.paymentConfig.stripe.enabled) {
      return NextResponse.json(
        { error: "Stripe payments are not enabled for this restaurant." },
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

    const randToken = Math.random().toString(36).slice(2, 9).toUpperCase();
    const slugShort = restaurant.slug.replace(/-/g, "").slice(0, 8);
    let paymentReference =
      method === "stripe"
        ? `pi_3Q9_${slugShort}_${randToken}`
        : method === "paypal"
        ? `PAYID-${slugShort.toUpperCase()}-${randToken}`
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

    const result = createOrder({
      restaurantId: restaurant.id,
      customerName: String(body.customerName || "Guest").slice(0, 120),
      customerEmail: String(body.customerEmail || "guest@example.com").slice(
        0,
        160
      ),
      customerPhone: String(body.customerPhone || "").slice(0, 40),
      orderType: body.orderType || "pickup",
      tableNumber: body.tableNumber,
      deliveryAddress: body.deliveryAddress,
      items: verifiedItems,
      subtotal: computedSubtotal,
      tax: computedTax,
      deliveryFee: safeDeliveryFee,
      tip: safeTip,
      discount: safeDiscount,
      total: computedTotal,
      paymentMethod: method,
      paymentStatus: "paid",
      paymentReference,
      status: "confirmed",
      specialInstructions: String(body.specialInstructions || "").slice(0, 500),
      scheduledFor: body.scheduledFor,
      deliveryTracking: preDispatchedDeliveryTracking,
      posSync: preSyncedPos,
    });

    await commitToTurso();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST order error:", error);
    return NextResponse.json(
      { error: "Failed to process order" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    const body = await req.json();
    if (!body.orderId || !body.status) {
      return NextResponse.json(
        { error: "orderId and status are required" },
        { status: 400 }
      );
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
