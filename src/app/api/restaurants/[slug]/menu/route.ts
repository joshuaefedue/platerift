import { NextRequest, NextResponse } from "next/server";
import {
  createMenuItem,
  deleteMenuItem,
  getRestaurantBySlugOrDomain,
  updateMenuItem,
} from "@/lib/db";

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
    if (!body.name || !body.category || body.price === undefined) {
      return NextResponse.json(
        { error: "Item name, category, and price are required" },
        { status: 400 }
      );
    }

    const item = createMenuItem({
      ...body,
      restaurantId: restaurant.id,
      price: Number(body.price),
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST menu item error:", error);
    return NextResponse.json(
      { error: "Failed to create menu item" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, ...updates } = body;
    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    const updated = updateMenuItem(itemId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("PATCH menu item error:", error);
    return NextResponse.json(
      { error: "Failed to update menu item" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json(
        { error: "itemId query parameter is required" },
        { status: 400 }
      );
    }

    const deleted = deleteMenuItem(itemId);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("DELETE menu item error:", error);
    return NextResponse.json(
      { error: "Failed to delete menu item" },
      { status: 500 }
    );
  }
}
