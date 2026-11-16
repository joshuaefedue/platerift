import { NextRequest, NextResponse } from "next/server";
import {
  authenticateOrRegisterCustomer,
  authenticateStaffOrAdminUser,
  getRestaurantBySlugOrDomain,
  listCustomerOrders,
  listScheduledReorders,
} from "@/lib/db";
import { checkRateLimit } from "@/lib/security";

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

    const body = await req.json();
    const actor = body.actor || "customer";

    if (actor === "staff") {
      const user = authenticateStaffOrAdminUser({
        emailOrPin: String(body.emailOrPin || ""),
        scope: body.scope,
        restaurantId: body.restaurantId,
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

      return NextResponse.json({ user });
    }

    // Customer Authentication / Registration
    const slugOrId = String(body.restaurantSlug || body.restaurantId || "bella-napoli");
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
      customer,
      orders,
      scheduledReorders,
    });
  } catch (error) {
    console.error("POST /api/auth error:", error);
    return NextResponse.json(
      { error: "Authentication request failed" },
      { status: 500 }
    );
  }
}
