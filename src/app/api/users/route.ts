import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  createUserAccount,
  deleteUserAccount,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listUsers,
  updateUserAccount,
} from "@/lib/db";
import {
  authorizePlatformAdmin,
  authorizeRestaurantStaff,
  authorizeStaffSessionPrecheck,
  getSessionFromRequest,
} from "@/lib/session";
import { ROLE_DEFINITIONS, type UserRole, type UserScope, type UserStatus } from "@/lib/types";

const VALID_USER_STATUSES: readonly UserStatus[] = [
  "active",
  "invited",
  "suspended",
];

function isValidUserRole(role: unknown): role is UserRole {
  return (
    typeof role === "string" &&
    Object.prototype.hasOwnProperty.call(ROLE_DEFINITIONS, role)
  );
}

function isValidUserStatus(status: unknown): status is UserStatus {
  return (
    typeof status === "string" &&
    VALID_USER_STATUSES.includes(status as UserStatus)
  );
}

export async function GET(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    const scope = req.nextUrl.searchParams.get("scope") as UserScope | null;
    const restaurantSlugOrId = req.nextUrl.searchParams.get("restaurantId");

    if (restaurantSlugOrId) {
      const rest = getRestaurantBySlugOrDomain(restaurantSlugOrId);
      const resolvedRestaurantId = rest ? rest.id : restaurantSlugOrId;
      const authz = authorizeRestaurantStaff(req, resolvedRestaurantId, "team");
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }

      const users = listUsers({
        restaurantId: resolvedRestaurantId,
      });
      return NextResponse.json({ users });
    }

    const authz = authorizePlatformAdmin(req);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
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
    const preAuth = authorizeStaffSessionPrecheck(req);
    if (!preAuth.ok) {
      return NextResponse.json(
        { error: preAuth.error },
        { status: preAuth.status }
      );
    }

    await hydrateFromTursoIfNeeded();
    const body = await req.json();

    const targetScope: UserScope =
      body.scope === "platform" ? "platform" : "restaurant";

    let resolvedRestaurantId: string | null = body.restaurantId || null;
    if (targetScope === "restaurant" && resolvedRestaurantId) {
      const rest = getRestaurantBySlugOrDomain(String(resolvedRestaurantId));
      if (rest) resolvedRestaurantId = rest.id;
    }

    if (targetScope === "restaurant" && resolvedRestaurantId) {
      const authz = authorizeRestaurantStaff(
        req,
        String(resolvedRestaurantId),
        "team"
      );
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
      const requestedRole: unknown = body.role;
      if (
        authz.session?.scope === "restaurant" &&
        isValidUserRole(requestedRole) &&
        ROLE_DEFINITIONS[requestedRole].scope !== "restaurant"
      ) {
        return NextResponse.json(
          { error: "Restaurant staff cannot create platform-level accounts." },
          { status: 403 }
        );
      }
    } else {
      const authz = authorizePlatformAdmin(req);
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
    }

    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { error: "Name, email, and role are required." },
        { status: 400 }
      );
    }

    if (!isValidUserRole(body.role)) {
      return NextResponse.json(
        { error: `Invalid user role '${String(body.role)}'.` },
        { status: 400 }
      );
    }

    if (body.status !== undefined && !isValidUserStatus(body.status)) {
      return NextResponse.json(
        {
          error: `Invalid user status '${String(
            body.status
          )}'. Must be active, invited, or suspended.`,
        },
        { status: 400 }
      );
    }

    const created = createUserAccount({
      scope: targetScope,
      restaurantId: resolvedRestaurantId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      status: body.status || "active",
      title: body.title,
      pinCode: body.pinCode,
      permissions: body.permissions,
    });

    await commitToTurso();
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
    const preAuth = authorizeStaffSessionPrecheck(req);
    if (!preAuth.ok) {
      return NextResponse.json(
        { error: preAuth.error },
        { status: preAuth.status }
      );
    }

    await hydrateFromTursoIfNeeded();
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const {
      userId,
      id: _ignoredId,
      createdAt: _ignoredCreatedAt,
      ...updates
    } = body;
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const existingUser = listUsers().find((u) => u.id === String(userId));
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existingUser.scope === "restaurant" && existingUser.restaurantId) {
      const authz = authorizeRestaurantStaff(
        req,
        existingUser.restaurantId,
        "team"
      );
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
      if (authz.session?.scope === "restaurant") {
        if (
          (updates.scope !== undefined && updates.scope !== "restaurant") ||
          (updates.restaurantId !== undefined &&
            updates.restaurantId !== existingUser.restaurantId)
        ) {
          return NextResponse.json(
            { error: "Cannot transfer user scope or restaurant tenant." },
            { status: 403 }
          );
        }
        const requestedUpdateRole: unknown = updates.role;
        if (
          requestedUpdateRole !== undefined &&
          isValidUserRole(requestedUpdateRole) &&
          ROLE_DEFINITIONS[requestedUpdateRole].scope !== "restaurant"
        ) {
          return NextResponse.json(
            { error: "Restaurant staff cannot assign platform roles." },
            { status: 403 }
          );
        }
      }
    } else {
      const authz = authorizePlatformAdmin(req);
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
    }

    if (updates.role !== undefined && !isValidUserRole(updates.role)) {
      return NextResponse.json(
        { error: `Invalid user role '${String(updates.role)}'.` },
        { status: 400 }
      );
    }

    if (updates.status !== undefined && !isValidUserStatus(updates.status)) {
      return NextResponse.json(
        {
          error: `Invalid user status '${String(
            updates.status
          )}'. Must be active, invited, or suspended.`,
        },
        { status: 400 }
      );
    }

    const updated = updateUserAccount(userId, updates);
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await commitToTurso();
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
    const preAuth = authorizeStaffSessionPrecheck(req);
    if (!preAuth.ok) {
      return NextResponse.json(
        { error: preAuth.error },
        { status: preAuth.status }
      );
    }

    await hydrateFromTursoIfNeeded();
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId query param is required" },
        { status: 400 }
      );
    }

    const existingUser = listUsers().find((u) => u.id === userId);
    if (!existingUser) {
      const session = getSessionFromRequest(req);
      if (session && session.actor !== "staff") {
        return NextResponse.json(
          { error: "Staff authentication required." },
          { status: 403 }
        );
      }
      return NextResponse.json({ deleted: false });
    }

    if (existingUser.scope === "restaurant" && existingUser.restaurantId) {
      const authz = authorizeRestaurantStaff(
        req,
        existingUser.restaurantId,
        "team"
      );
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
    } else {
      const authz = authorizePlatformAdmin(req);
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
    }

    const deleted = deleteUserAccount(userId);
    await commitToTurso();
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("DELETE /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to delete user account" },
      { status: 500 }
    );
  }
}
