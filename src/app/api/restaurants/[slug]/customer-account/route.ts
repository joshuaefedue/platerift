import { NextRequest, NextResponse } from "next/server";
import {
  authenticateOrRegisterCustomer,
  commitToTurso,
  createOrder,
  createScheduledReorder,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listCustomerOrders,
  listCustomers,
  listMenuItems,
  listOrders,
  listScheduledReorders,
  triggerScheduledReorderNow,
  updateCustomerProfile,
  updateScheduledReorderStatus,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import {
  attachSessionCookie,
  authorizeRestaurantStaff,
  clearSessionCookie,
  createSessionToken,
  getRawSessionToken,
  isStrictAuthEnforced,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";
import type { Customer } from "@/lib/types";

function redactDemoCustomers(allCustomers: Customer[]): Customer[] {
  return allCustomers.slice(0, 6).map((c) => ({
    ...c,
    phone: c.phone ? `${c.phone.slice(0, -4)}••••` : "",
    defaultAddress: c.defaultAddress ? "Saved on file" : "",
    notes: "",
  }));
}

function normalizePaymentMethod(
  val: unknown
): "stripe" | "paypal" | "square" | "clover" {
  if (
    val === "paypal" ||
    val === "square" ||
    val === "clover" ||
    val === "stripe"
  ) {
    return val;
  }
  return "stripe";
}

type MutationAuthResult =
  | {
      ok: true;
      mode: "staff" | "customer" | "demo";
      session: SessionPayload | null;
    }
  | { ok: false; status: 401 | 403; error: string };

function authorizeCustomerOrStaffMutation(
  req: NextRequest,
  restaurantId: string
): MutationAuthResult {
  const rawToken = getRawSessionToken(req);
  if (rawToken !== null) {
    const session = verifySessionToken(rawToken);
    if (!session) {
      return {
        ok: false,
        status: 401,
        error: "Invalid or expired session token. Please sign in again.",
      };
    }
    if (session.actor === "staff") {
      const staffAuthz = authorizeRestaurantStaff(req, restaurantId);
      if (!staffAuthz.ok) return staffAuthz;
      return { ok: true, mode: "staff", session };
    }
    if (session.restaurantId !== restaurantId) {
      return {
        ok: false,
        status: 403,
        error: "Cross-tenant customer session denied.",
      };
    }
    return { ok: true, mode: "customer", session };
  }

  if (isStrictAuthEnforced()) {
    return {
      ok: false,
      status: 401,
      error: "Customer authentication required.",
    };
  }

  return { ok: true, mode: "demo", session: null };
}

function sessionOwnsRecord(
  session: SessionPayload,
  recordCustomerId?: string | null,
  recordEmail?: string | null
): boolean {
  if (recordCustomerId && recordCustomerId === session.sub) return true;
  if (
    recordEmail &&
    session.email &&
    recordEmail.trim().toLowerCase() === session.email.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await hydrateFromTursoIfNeeded();
    const rawToken = getRawSessionToken(req);
    let session: SessionPayload | null = null;
    if (rawToken !== null) {
      session = verifySessionToken(rawToken);
      if (!session) {
        return NextResponse.json(
          { error: "Invalid or expired session token." },
          { status: 401 }
        );
      }
    }

    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    if (session?.actor === "staff") {
      const staffAuthz = authorizeRestaurantStaff(req, restaurant.id);
      if (!staffAuthz.ok) {
        return NextResponse.json(
          { error: staffAuthz.error },
          { status: staffAuthz.status }
        );
      }
    }

    const emailParam = req.nextUrl.searchParams.get("email") || "";
    const customerIdParam = req.nextUrl.searchParams.get("customerId") || "";
    const signedOutParam = Boolean(req.nextUrl.searchParams.get("signedOut"));

    if (session?.actor === "customer") {
      if (session.restaurantId !== restaurant.id) {
        if (emailParam || customerIdParam || isStrictAuthEnforced()) {
          return NextResponse.json(
            { error: "Cross-tenant customer session denied." },
            { status: 403 }
          );
        }
      } else if (isStrictAuthEnforced()) {
        if (
          (emailParam &&
            emailParam.trim().toLowerCase() !== session.email.toLowerCase()) ||
          (customerIdParam && customerIdParam !== session.sub)
        ) {
          return NextResponse.json(
            { error: "Cannot access another customer's account." },
            { status: 403 }
          );
        }
      }
    }

    if (!session && isStrictAuthEnforced()) {
      if (emailParam || customerIdParam) {
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }
      return NextResponse.json({
        customer: null,
        orders: [],
        scheduledReorders: [],
        demoCustomers: [],
      });
    }

    let allCustomers = listCustomers(restaurant.id);

    let activeCustomer: Customer | null = null;

    if (
      session?.actor === "customer" &&
      session.restaurantId === restaurant.id &&
      !signedOutParam &&
      !emailParam &&
      !customerIdParam
    ) {
      activeCustomer =
        allCustomers.find(
          (c) =>
            c.id === session.sub ||
            c.email.toLowerCase() === session.email.toLowerCase()
        ) || null;
    }

    if (!activeCustomer) {
      activeCustomer =
        allCustomers.find(
          (c) =>
            (customerIdParam && c.id === customerIdParam) ||
            (emailParam && c.email.toLowerCase() === emailParam.toLowerCase())
        ) || null;
    }

    if (!activeCustomer && emailParam) {
      activeCustomer = authenticateOrRegisterCustomer({
        restaurantId: restaurant.id,
        mode: "login",
        email: emailParam,
      });
      await commitToTurso();
      allCustomers = listCustomers(restaurant.id);
    }

    // Default to first VIP customer for immediate rich demo experience if none specified
    if (
      !activeCustomer &&
      allCustomers.length > 0 &&
      !signedOutParam &&
      !isStrictAuthEnforced()
    ) {
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
      demoCustomers: isStrictAuthEnforced()
        ? []
        : redactDemoCustomers(allCustomers),
    });
  } catch (error) {
    console.error("GET customer-account error:", error);
    return NextResponse.json(
      { error: "Failed to load customer account" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  return clearSessionCookie(res);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await hydrateFromTursoIfNeeded();
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));

    const body = await req.json();
    const action = body.action;

    if (action === "logout") {
      const res = NextResponse.json({ ok: true, authenticated: false });
      return clearSessionCookie(res);
    }

    if (action === "login" || action === "register") {
      if (!restaurant) {
        return NextResponse.json(
          { error: "Restaurant not found" },
          { status: 404 }
        );
      }
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

      const token = createSessionToken({
        sub: customer.id,
        actor: "customer",
        scope: "customer",
        role: "customer",
        email: customer.email,
        name: customer.name,
        restaurantId: restaurant.id,
      });

      await commitToTurso();
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
      const demoCustomers = isStrictAuthEnforced()
        ? []
        : redactDemoCustomers(listCustomers(restaurant.id));
      const res = NextResponse.json({
        customer,
        orders,
        scheduledReorders,
        demoCustomers,
      });
      return attachSessionCookie(res, token);
    }

    // Pre-check token validity / strict auth before returning 404 on unknown slug
    if (!restaurant) {
      const rawToken = getRawSessionToken(req);
      if (rawToken !== null) {
        const session = verifySessionToken(rawToken);
        if (!session) {
          return NextResponse.json(
            { error: "Invalid or expired session token. Please sign in again." },
            { status: 401 }
          );
        }
      } else if (isStrictAuthEnforced()) {
        return NextResponse.json(
          { error: "Customer authentication required." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const auth = authorizeCustomerOrStaffMutation(req, restaurant.id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (action === "update_profile") {
      const customerId = String(body.customerId || "");
      if (!customerId) {
        return NextResponse.json(
          { error: "customerId is required" },
          { status: 400 }
        );
      }
      const existingCustomer = listCustomers(restaurant.id).find(
        (c) => c.id === customerId
      );
      if (!existingCustomer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      if (
        auth.mode === "customer" &&
        auth.session &&
        !sessionOwnsRecord(
          auth.session,
          existingCustomer.id,
          existingCustomer.email
        )
      ) {
        return NextResponse.json(
          { error: "Cannot modify another customer's profile." },
          { status: 403 }
        );
      }

      const profileUpdates: Partial<Customer> = {};
      if (body.name !== undefined) profileUpdates.name = String(body.name);
      if (body.email !== undefined) profileUpdates.email = String(body.email);
      if (body.phone !== undefined) profileUpdates.phone = String(body.phone);
      if (body.defaultAddress !== undefined)
        profileUpdates.defaultAddress = String(body.defaultAddress);
      if (body.notes !== undefined) profileUpdates.notes = String(body.notes);
      if (body.smsOptIn !== undefined)
        profileUpdates.smsOptIn = Boolean(body.smsOptIn);
      if (body.emailOptIn !== undefined)
        profileUpdates.emailOptIn = Boolean(body.emailOptIn);

      const updated = updateCustomerProfile(customerId, profileUpdates);
      if (!updated) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      await commitToTurso();
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

      if (auth.mode === "customer" && auth.session) {
        if (
          !sessionOwnsRecord(
            auth.session,
            sourceOrder.customerId,
            sourceOrder.customerEmail
          )
        ) {
          return NextResponse.json(
            { error: "Order does not belong to your customer session." },
            { status: 403 }
          );
        }
        if (
          typeof body.customerEmail === "string" &&
          body.customerEmail.trim() &&
          body.customerEmail.trim().toLowerCase() !==
            auth.session.email.trim().toLowerCase()
        ) {
          return NextResponse.json(
            { error: "Customer email does not match authenticated session." },
            { status: 403 }
          );
        }
      }

      const reqEmail =
        typeof body.customerEmail === "string"
          ? body.customerEmail.trim().toLowerCase()
          : "";
      const reqCustId =
        typeof body.customerId === "string" ? body.customerId.trim() : "";

      if (reqEmail || reqCustId) {
        const idMatches = Boolean(
          reqCustId &&
            sourceOrder.customerId &&
            sourceOrder.customerId === reqCustId
        );
        const emailMatches = Boolean(
          reqEmail &&
            sourceOrder.customerEmail &&
            sourceOrder.customerEmail.trim().toLowerCase() === reqEmail
        );
        const idMismatch = Boolean(
          reqCustId &&
            sourceOrder.customerId &&
            sourceOrder.customerId !== reqCustId
        );
        const emailMismatch = Boolean(
          reqEmail &&
            sourceOrder.customerEmail &&
            sourceOrder.customerEmail.trim().toLowerCase() !== reqEmail
        );
        if ((!idMatches && !emailMatches) || idMismatch || emailMismatch) {
          return NextResponse.json(
            { error: "Order does not belong to this customer account." },
            { status: 403 }
          );
        }
      }

      const availability = evaluateRestaurantAvailability(
        restaurant,
        allOrders,
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

      const menuItems = listMenuItems(restaurant.id);
      for (const line of sourceOrder.items) {
        const mItem = menuItems.find((m) => m.id === line.menuItemId);
        if (mItem && !mItem.available) {
          return NextResponse.json(
            {
              error: `Cannot re-order: "${mItem.name}" is currently unavailable (${
                mItem.unavailableReason || "Sold out"
              }).`,
            },
            { status: 400 }
          );
        }
      }

      const method = normalizePaymentMethod(
        body.paymentMethod || sourceOrder.paymentMethod
      );
      const paymentReference = `${method.toUpperCase()}-REORDER-${Math.floor(
        100000 + Math.random() * 900000
      )}`;

      const resolvedEmail =
        auth.mode === "customer" && auth.session
          ? auth.session.email
          : body.customerEmail || sourceOrder.customerEmail;

      const { order, smsSent } = createOrder({
        restaurantId: restaurant.id,
        customerName: body.customerName || sourceOrder.customerName,
        customerEmail: resolvedEmail,
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
      await commitToTurso();
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
      if (auth.mode === "customer" && auth.session) {
        if (
          typeof body.customerId === "string" &&
          body.customerId.trim() &&
          body.customerId.trim() !== auth.session.sub
        ) {
          return NextResponse.json(
            { error: "Cannot schedule reorder for another customer." },
            { status: 403 }
          );
        }
        if (
          typeof body.customerEmail === "string" &&
          body.customerEmail.trim() &&
          body.customerEmail.trim().toLowerCase() !==
            auth.session.email.trim().toLowerCase()
        ) {
          return NextResponse.json(
            { error: "Cannot schedule reorder for another customer email." },
            { status: 403 }
          );
        }
      }

      const scheduled = createScheduledReorder({
        restaurantId: restaurant.id,
        customerId:
          auth.mode === "customer" && auth.session
            ? auth.session.sub
            : String(body.customerId || `cust_${Date.now()}`),
        customerName: String(
          body.customerName ||
            (auth.mode === "customer" && auth.session
              ? auth.session.name
              : "Valued Guest")
        ),
        customerEmail:
          auth.mode === "customer" && auth.session
            ? auth.session.email
            : String(body.customerEmail || "guest@example.com"),
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
        paymentMethod: normalizePaymentMethod(body.paymentMethod),
        frequency: body.frequency || "once",
        scheduledDate: String(body.scheduledDate),
        scheduledTime: String(body.scheduledTime || "18:30"),
        specialInstructions: String(body.specialInstructions || ""),
      });

      await commitToTurso();
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
      const scheduledId = String(body.scheduledId || "");
      if (!scheduledId) {
        return NextResponse.json(
          { error: "scheduledId is required" },
          { status: 400 }
        );
      }
      const existingScheduled = listScheduledReorders(restaurant.id).find(
        (s) => s.id === scheduledId
      );
      if (!existingScheduled) {
        return NextResponse.json(
          { error: "Scheduled order not found" },
          { status: 404 }
        );
      }
      if (
        auth.mode === "customer" &&
        auth.session &&
        !sessionOwnsRecord(
          auth.session,
          existingScheduled.customerId,
          existingScheduled.customerEmail
        )
      ) {
        return NextResponse.json(
          { error: "Cannot trigger another customer's scheduled order." },
          { status: 403 }
        );
      }

      const result = triggerScheduledReorderNow(scheduledId);
      const customer = authenticateOrRegisterCustomer({
        restaurantId: restaurant.id,
        mode: "login",
        email: result.order.customerEmail,
      });
      await commitToTurso();
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
      const scheduledId = String(body.scheduledId || "");
      if (!scheduledId) {
        return NextResponse.json(
          { error: "scheduledId is required" },
          { status: 400 }
        );
      }
      const existingScheduled = listScheduledReorders(restaurant.id).find(
        (s) => s.id === scheduledId
      );
      if (!existingScheduled) {
        return NextResponse.json(
          { error: "Scheduled order not found" },
          { status: 404 }
        );
      }
      if (
        auth.mode === "customer" &&
        auth.session &&
        !sessionOwnsRecord(
          auth.session,
          existingScheduled.customerId,
          existingScheduled.customerEmail
        )
      ) {
        return NextResponse.json(
          { error: "Cannot update another customer's scheduled order." },
          { status: 403 }
        );
      }

      const updated = updateScheduledReorderStatus(scheduledId, {
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
      await commitToTurso();
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
