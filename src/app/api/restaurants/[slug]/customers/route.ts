import { NextRequest, NextResponse } from "next/server";
import {
  createCustomerManual,
  getRestaurantBySlugOrDomain,
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
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: "Customer name and email are required" },
        { status: 400 }
      );
    }

    const customer = createCustomerManual({
      ...body,
      restaurantId: restaurant.id,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("POST customer error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
