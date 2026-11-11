import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  listMenuItems,
  listOrders,
  updateOrderStatus,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
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

    // 2. Verify all items are currently available
    const menuItems = listMenuItems(restaurant.id);
    for (const line of body.items || []) {
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
    }

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
    const paymentReference =
      method === "stripe"
        ? `pi_3Q9_${slugShort}_${randToken}`
        : method === "paypal"
        ? `PAYID-${slugShort.toUpperCase()}-${randToken}`
        : method === "square"
        ? `sq_pay_${slugShort}_${randToken}`
        : `clv_pay_${slugShort}_${randToken}`;

    const result = createOrder({
      restaurantId: restaurant.id,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      orderType: body.orderType || "pickup",
      tableNumber: body.tableNumber,
      deliveryAddress: body.deliveryAddress,
      items: body.items,
      subtotal: Number(body.subtotal),
      tax: Number(body.tax),
      deliveryFee: Number(body.deliveryFee || 0),
      tip: Number(body.tip || 0),
      discount: Number(body.discount || 0),
      total: Number(body.total),
      paymentMethod: method,
      paymentStatus: "paid",
      paymentReference,
      status: "confirmed",
      specialInstructions: body.specialInstructions || "",
      scheduledFor: body.scheduledFor,
    });

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

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH order status error:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
