import { NextRequest, NextResponse } from "next/server";
import {
  authenticateOrRegisterCustomer,
  createOrder,
  createScheduledReorder,
  getRestaurantBySlugOrDomain,
  listCustomerOrders,
  listCustomers,
  listOrders,
  listScheduledReorders,
  triggerScheduledReorderNow,
  updateCustomerProfile,
  updateScheduledReorderStatus,
} from "@/lib/db";

export async function GET(
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

    const allCustomers = listCustomers(restaurant.id);
    const emailParam = req.nextUrl.searchParams.get("email") || "";
    const customerIdParam = req.nextUrl.searchParams.get("customerId") || "";

    let activeCustomer =
      allCustomers.find(
        (c) =>
          (customerIdParam && c.id === customerIdParam) ||
          (emailParam && c.email.toLowerCase() === emailParam.toLowerCase())
      ) || null;

    if (!activeCustomer && emailParam) {
      activeCustomer = authenticateOrRegisterCustomer({
        restaurantId: restaurant.id,
        mode: "login",
        email: emailParam,
      });
    }

    // Default to first VIP customer for immediate rich demo experience if none specified
    if (!activeCustomer && allCustomers.length > 0 && !req.nextUrl.searchParams.get("signedOut")) {
      activeCustomer = allCustomers[0];
    }

    const orders = activeCustomer
      ? listCustomerOrders(
          restaurant.id,
          activeCustomer.id,
          activeCustomer.email
        )
      : [];

    const scheduledReorders = activeCustomer
      ? listScheduledReorders(
          restaurant.id,
          activeCustomer.id,
          activeCustomer.email
        )
      : [];

    return NextResponse.json({
      customer: activeCustomer,
      orders,
      scheduledReorders,
      demoCustomers: allCustomers,
    });
  } catch (error) {
    console.error("GET customer-account error:", error);
    return NextResponse.json(
      { error: "Failed to load customer account" },
      { status: 500 }
    );
  }
}

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
    const action = body.action;

    if (action === "login" || action === "register") {
      if (!body.email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }
      const customer = authenticateOrRegisterCustomer({
        restaurantId: restaurant.id,
        mode: action,
        email: String(body.email),
        name: body.name,
        phone: body.phone,
        defaultAddress: body.defaultAddress,
        notes: body.notes,
      });
      const orders = listCustomerOrders(
        restaurant.id,
        customer.id,
        customer.email
      );
      const scheduledReorders = listScheduledReorders(
        restaurant.id,
        customer.id,
        customer.email
      );
      const demoCustomers = listCustomers(restaurant.id);
      return NextResponse.json({
        customer,
        orders,
        scheduledReorders,
        demoCustomers,
      });
    }

    if (action === "update_profile") {
      const updated = updateCustomerProfile(String(body.customerId), {
        name: body.name,
        email: body.email,
        phone: body.phone,
        defaultAddress: body.defaultAddress,
        notes: body.notes,
        smsOptIn: body.smsOptIn,
        emailOptIn: body.emailOptIn,
      });
      if (!updated) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      const orders = listCustomerOrders(
        restaurant.id,
        updated.id,
        updated.email
      );
      const scheduledReorders = listScheduledReorders(
        restaurant.id,
        updated.id,
        updated.email
      );
      return NextResponse.json({
        customer: updated,
        orders,
        scheduledReorders,
      });
    }

    if (action === "reorder_now") {
      // Places an immediate re-order from a past order ID
      const allOrders = listOrders(restaurant.id);
      const sourceOrder = allOrders.find((o) => o.id === body.orderId);
      if (!sourceOrder) {
        return NextResponse.json(
          { error: "Original order not found" },
          { status: 404 }
        );
      }

      const method =
        body.paymentMethod || sourceOrder.paymentMethod || "stripe";
      const paymentReference = `${method.toUpperCase()}-REORDER-${Math.floor(
        100000 + Math.random() * 900000
      )}`;

      const { order, smsSent } = createOrder({
        restaurantId: restaurant.id,
        customerName: body.customerName || sourceOrder.customerName,
        customerEmail: body.customerEmail || sourceOrder.customerEmail,
        customerPhone: body.customerPhone || sourceOrder.customerPhone,
        orderType: body.orderType || sourceOrder.orderType,
        tableNumber: sourceOrder.tableNumber,
        deliveryAddress:
          body.deliveryAddress || sourceOrder.deliveryAddress,
        items: sourceOrder.items,
        subtotal: sourceOrder.subtotal,
        tax: sourceOrder.tax,
        deliveryFee: sourceOrder.deliveryFee,
        tip: sourceOrder.tip,
        discount: sourceOrder.discount,
        total: sourceOrder.total,
        paymentMethod: method,
        paymentStatus: "paid",
        paymentReference,
        status: "confirmed",
        specialInstructions: `↻ 1-Click Re-Order of #${sourceOrder.orderNumber}${
          sourceOrder.specialInstructions
            ? ` • ${sourceOrder.specialInstructions}`
            : ""
        }`,
      });

      const customer = authenticateOrRegisterCustomer({
        restaurantId: restaurant.id,
        mode: "login",
        email: order.customerEmail,
      });
      const orders = listCustomerOrders(
        restaurant.id,
        customer.id,
        customer.email
      );
      const scheduledReorders = listScheduledReorders(
        restaurant.id,
        customer.id,
        customer.email
      );

      return NextResponse.json({
        order,
        smsSent,
        customer,
        orders,
        scheduledReorders,
      });
    }

    if (action === "schedule_reorder") {
      // Creates a scheduled/recurring re-order (and optionally queues it in orders if requested)
      const scheduled = createScheduledReorder({
        restaurantId: restaurant.id,
        customerId: String(body.customerId || `cust_${Date.now()}`),
        customerName: String(body.customerName || "Valued Guest"),
        customerEmail: String(body.customerEmail || "guest@example.com"),
        customerPhone: String(body.customerPhone || "+1 (312) 555-0199"),
        sourceOrderNumber: String(body.sourceOrderNumber || "CUSTOM"),
        title: String(
          body.title || `Scheduled Order (${body.scheduledDate})`
        ),
        orderType: body.orderType || "pickup",
        deliveryAddress: body.deliveryAddress,
        tableNumber: body.tableNumber,
        items: body.items || [],
        subtotal: Number(body.subtotal || 0),
        tax: Number(body.tax || 0),
        deliveryFee: Number(body.deliveryFee || 0),
        tip: Number(body.tip || 0),
        total: Number(body.total || 0),
        paymentMethod: body.paymentMethod === "paypal" ? "paypal" : "stripe",
        frequency: body.frequency || "once",
        scheduledDate: String(body.scheduledDate),
        scheduledTime: String(body.scheduledTime || "18:30"),
        specialInstructions: String(body.specialInstructions || ""),
      });

      const scheduledReorders = listScheduledReorders(
        restaurant.id,
        scheduled.customerId,
        scheduled.customerEmail
      );

      return NextResponse.json({
        scheduled,
        scheduledReorders,
      });
    }

    if (action === "trigger_scheduled") {
      const result = triggerScheduledReorderNow(String(body.scheduledId));
      const customer = authenticateOrRegisterCustomer({
        restaurantId: restaurant.id,
        mode: "login",
        email: result.order.customerEmail,
      });
      const orders = listCustomerOrders(
        restaurant.id,
        customer.id,
        customer.email
      );
      const scheduledReorders = listScheduledReorders(
        restaurant.id,
        customer.id,
        customer.email
      );

      return NextResponse.json({
        ...result,
        customer,
        orders,
        scheduledReorders,
      });
    }

    if (action === "update_scheduled") {
      const updated = updateScheduledReorderStatus(String(body.scheduledId), {
        status: body.status,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        frequency: body.frequency,
      });
      if (!updated) {
        return NextResponse.json(
          { error: "Scheduled order not found" },
          { status: 404 }
        );
      }
      const scheduledReorders = listScheduledReorders(
        restaurant.id,
        updated.customerId,
        updated.customerEmail
      );
      return NextResponse.json({
        scheduled: updated,
        scheduledReorders,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST customer-account error:", error);
    return NextResponse.json(
      { error: "Failed to process customer account action" },
      { status: 500 }
    );
  }
}
