import { NextRequest, NextResponse } from "next/server";
import {
  createRestaurantTenant,
  listCustomers,
  listMenuItems,
  listOrders,
  listRestaurants,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";

export async function GET() {
  try {
    const restaurants = listRestaurants();
    const enriched = restaurants.map((r) => {
      const orders = listOrders(r.id);
      const menuItems = listMenuItems(r.id);
      const customers = listCustomers(r.id);
      const availability = evaluateRestaurantAvailability(r, orders);
      const totalRevenue = orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + o.total, 0);

      return {
        ...r,
        stats: {
          totalOrders: orders.length,
          activeOrders: orders.filter(
            (o) => o.status === "confirmed" || o.status === "preparing"
          ).length,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          menuItemCount: menuItems.length,
          unavailableItemCount: menuItems.filter((m) => !m.available).length,
          customerCount: customers.length,
        },
        availability,
      };
    });

    return NextResponse.json({ restaurants: enriched });
  } catch (error) {
    console.error("GET /api/restaurants error:", error);
    return NextResponse.json(
      { error: "Failed to load restaurants" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.ownerName || !body.ownerEmail) {
      return NextResponse.json(
        { error: "Restaurant name, owner name, and owner email are required." },
        { status: 400 }
      );
    }

    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const created = createRestaurantTenant({
      ...body,
      slug,
    });

    return NextResponse.json({ restaurant: created }, { status: 201 });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to create restaurant";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
