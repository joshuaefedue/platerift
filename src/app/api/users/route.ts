import { NextRequest, NextResponse } from "next/server";
import {
  createUserAccount,
  deleteUserAccount,
  getRestaurantBySlugOrDomain,
  listUsers,
  updateUserAccount,
} from "@/lib/db";
import type { UserRole, UserScope, UserStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") as UserScope | null;
    const restaurantSlugOrId = req.nextUrl.searchParams.get("restaurantId");

    if (restaurantSlugOrId) {
      const rest = getRestaurantBySlugOrDomain(restaurantSlugOrId);
      const users = listUsers({
        restaurantId: rest ? rest.id : restaurantSlugOrId,
      });
      return NextResponse.json({ users });
    }

    if (scope) {
      const users = listUsers({ scope });
      return NextResponse.json({ users });
    }

    const users = listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { error: "Name, email, and role are required." },
        { status: 400 }
      );
    }

    let resolvedRestaurantId: string | null = body.restaurantId || null;
    if (body.scope === "restaurant" && resolvedRestaurantId) {
      const rest = getRestaurantBySlugOrDomain(resolvedRestaurantId);
      if (rest) resolvedRestaurantId = rest.id;
    }

    const created = createUserAccount({
      scope: (body.scope as UserScope) || "restaurant",
      restaurantId: resolvedRestaurantId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role as UserRole,
      status: (body.status as UserStatus) || "active",
      title: body.title,
      pinCode: body.pinCode,
      permissions: body.permissions,
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to create user account" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...updates } = body;
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const updated = updateUserAccount(userId, updates);
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to update user account" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId query param is required" },
        { status: 400 }
      );
    }

    const deleted = deleteUserAccount(userId);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("DELETE /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to delete user account" },
      { status: 500 }
    );
  }
}
