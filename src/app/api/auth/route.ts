import { NextRequest, NextResponse } from "next/server";
import {
  authenticateOrRegisterCustomer,
  authenticateStaffOrAdminUser,
  commitToTurso,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listCustomerOrders,
  listScheduledReorders,
} from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import {
  attachSessionCookie,
  clearSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  isStrictAuthEnforced,
} from "@/lib/session";
import type { UserScope } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  return NextResponse.json({
    authenticated: Boolean(session),
    strictAuthEnforced: isStrictAuthEnforced(),
    session,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  return clearSessionCookie(res);
}

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(req, "auth_attempt", 15, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many login attempts from this IP. Please wait 60 seconds and try again.",
        },
        { status: 429 }
      );
    }

    await hydrateFromTursoIfNeeded();

    const body = await req.json();
    const actor = body.actor || "customer";

    if (actor === "staff") {
      const requestedScope =
        body.scope === "platform" || body.scope === "restaurant"
          ? (body.scope as UserScope)
          : undefined;
      const requestedRestRaw = body.restaurantId || body.restaurantSlug;
      const resolvedRest = requestedRestRaw
        ? getRestaurantBySlugOrDomain(String(requestedRestRaw))
        : null;
      const resolvedRestaurantId = resolvedRest
        ? resolvedRest.id
        : requestedRestRaw
        ? String(requestedRestRaw)
        : undefined;

      const user = authenticateStaffOrAdminUser({
        emailOrPin: String(body.emailOrPin || ""),
        scope: requestedScope,
        restaurantId: resolvedRestaurantId,
      });

      if (!user) {
        return NextResponse.json(
          {
            error:
              "Invalid staff email or 4-digit PIN code. Try a seeded staff email or PIN (e.g., 1101 for Marco Rossi or 0001 for Super Admin).",
          },
          { status: 401 }
        );
      }

      if (user.status === "suspended") {
        return NextResponse.json(
          { error: "This staff account is currently suspended." },
          { status: 403 }
        );
      }

      if (requestedScope === "platform" && user.scope !== "platform") {
        return NextResponse.json(
          { error: "Platform administrator credentials are required." },
          { status: 403 }
        );
      }

      if (
        resolvedRestaurantId &&
        user.scope === "restaurant" &&
        user.restaurantId !== resolvedRestaurantId
      ) {
        return NextResponse.json(
          { error: "This staff account belongs to a different restaurant." },
          { status: 403 }
        );
      }

      const token = createSessionToken({
        sub: user.id,
        actor: "staff",
        scope: user.scope,
        role: user.role,
        email: user.email,
        name: user.name,
        restaurantId: user.restaurantId ?? null,
      });

      await commitToTurso();
      const res = NextResponse.json({ user });
      return attachSessionCookie(res, token);
    }

    // Customer Authentication / Registration
    const slugOrId = String(
      body.restaurantSlug || body.restaurantId || "bella-napoli"
    );
    const restaurant = getRestaurantBySlugOrDomain(slugOrId);
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const email = String(body.email || "").trim();
    if (!email) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    const customer = authenticateOrRegisterCustomer({
      restaurantId: restaurant.id,
      mode: body.mode === "register" ? "register" : "login",
      email,
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

    const res = NextResponse.json({
      customer,
      orders,
      scheduledReorders,
    });
    return attachSessionCookie(res, token);
  } catch (error) {
    console.error("POST /api/auth error:", error);
    return NextResponse.json(
      { error: "Authentication request failed" },
      { status: 500 }
    );
  }
}
