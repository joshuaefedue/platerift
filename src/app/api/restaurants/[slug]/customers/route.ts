import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  createCustomerManual,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
} from "@/lib/db";
import {
  authorizeRestaurantStaff,
  authorizeStaffSessionPrecheck,
} from "@/lib/session";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const preAuth = authorizeStaffSessionPrecheck(req);
    if (!preAuth.ok) {
      return NextResponse.json(
        { error: preAuth.error },
        { status: preAuth.status }
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

    const authz = authorizeRestaurantStaff(req, restaurant.id, "customers");
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
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
      phone: body.phone ? String(body.phone) : "",
      restaurantId: restaurant.id,
    });

    await commitToTurso();
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("POST customer error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
