import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  getPlatformIntegrationsConfig,
  getPlatformTwilioConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listCustomers,
  listEmailCampaigns,
  listMenuItems,
  listOrders,
  listScheduledReorders,
  listSmsLogs,
  listUsers,
  syncPlatformSettingFromTurso,
  updateRestaurantTenant,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import {
  sanitizePlatformIntegrationsForClient,
  sanitizePlatformTwilioForClient,
  sanitizeRestaurantForPublicStorefront,
} from "@/lib/security";
import {
  authorizeRestaurantStaff,
  authorizeStaffSessionPrecheck,
} from "@/lib/session";
import type { PortalTabId } from "@/lib/types";

function getRequiredTabsForPatch(
  updates: Record<string, unknown>
): PortalTabId[] {
  const tabs = new Set<PortalTabId>();
  for (const key of Object.keys(updates)) {
    if (key === "paymentConfig") {
      tabs.add("payments");
    } else if (key === "integrationsConfig") {
      tabs.add("integrations");
    } else if (key === "inventoryConfig") {
      tabs.add("inventory");
    } else if (key === "commsConfig") {
      tabs.add("email");
    } else if (
      key === "orderingEnabled" ||
      key === "pauseReason" ||
      key === "maxOrdersPerHour" ||
      key === "maxOrdersPerDay" ||
      key === "minOrderAmount" ||
      key === "maxOrderAmount" ||
      key === "prepTimeMinutes" ||
      key === "advanceNoticeDays" ||
      key === "advanceNoticeHours" ||
      key === "advanceNoticeNote" ||
      key === "autoPauseOnLimit" ||
      key === "weeklySchedule" ||
      key === "blackoutWindows" ||
      key === "features"
    ) {
      tabs.add("limits");
    } else {
      tabs.add("domain");
    }
  }
  return tabs.size > 0 ? Array.from(tabs) : ["domain"];
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const isPublicStorefrontView =
      req.nextUrl.searchParams.get("view") === "storefront";

    if (!isPublicStorefrontView) {
      const preAuth = authorizeStaffSessionPrecheck(req);
      if (!preAuth.ok) {
        return NextResponse.json(
          { error: preAuth.error },
          { status: preAuth.status }
        );
      }
    }

    await hydrateFromTursoIfNeeded();
    const { slug } = await context.params;
    const decodedSlug = decodeURIComponent(slug);
    const restaurant = getRestaurantBySlugOrDomain(decodedSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: `Restaurant '${decodedSlug}' not found` },
        { status: 404 }
      );
    }

    if (!isPublicStorefrontView) {
      const authz = authorizeRestaurantStaff(req, restaurant.id);
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
    }

    await syncPlatformSettingFromTurso("platform_integrations");
    await syncPlatformSettingFromTurso("twilio_gateway");

    const menuItems = listMenuItems(restaurant.id);
    const orders = listOrders(restaurant.id);
    const platformIntegrations = sanitizePlatformIntegrationsForClient(
      getPlatformIntegrationsConfig()
    );

    const simDay = req.nextUrl.searchParams.get("simDay") || undefined;
    const simTime = req.nextUrl.searchParams.get("simTime") || undefined;
    const simDate = req.nextUrl.searchParams.get("simDate") || undefined;

    const availability = evaluateRestaurantAvailability(
      restaurant,
      orders,
      simDay,
      simTime,
      simDate
    );

    if (isPublicStorefrontView) {
      // Strip private API keys, OAuth tokens, customer CRM PII, SMS logs, and staff PINs on the public storefront
      const publicOrders = orders.map((o) => ({
        ...o,
        customerEmail: "",
        customerPhone: "",
        deliveryAddress: "",
      }));
      return NextResponse.json({
        restaurant: sanitizeRestaurantForPublicStorefront(restaurant),
        menuItems,
        orders: publicOrders,
        platformIntegrations,
        availability,
      });
    }

    const customers = listCustomers(restaurant.id);
    const smsLogs = listSmsLogs(restaurant.id);
    const emailCampaigns = listEmailCampaigns(restaurant.id);
    const teamMembers = listUsers({ restaurantId: restaurant.id });
    const scheduledReorders = listScheduledReorders(restaurant.id);
    const platformTwilio = sanitizePlatformTwilioForClient(
      getPlatformTwilioConfig()
    );

    return NextResponse.json({
      restaurant,
      menuItems,
      orders,
      customers,
      smsLogs,
      emailCampaigns,
      teamMembers,
      scheduledReorders,
      platformTwilio,
      platformIntegrations,
      availability,
    });
  } catch (error) {
    console.error("GET /api/restaurants/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurant details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const decodedSlug = decodeURIComponent(slug);
    const existing = getRestaurantBySlugOrDomain(decodedSlug);
    if (!existing) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const {
      id: _ignoredId,
      slug: _ignoredSlug,
      createdAt: _ignoredCreatedAt,
      ...safeUpdates
    } = body as Record<string, unknown>;

    const requiredTabs = getRequiredTabsForPatch(safeUpdates);
    for (const tab of requiredTabs) {
      const authz = authorizeRestaurantStaff(req, existing.id, tab);
      if (!authz.ok) {
        return NextResponse.json(
          { error: authz.error },
          { status: authz.status }
        );
      }
    }

    const updated = updateRestaurantTenant(existing.id, safeUpdates);
    if (!updated) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    await commitToTurso();
    const orders = listOrders(updated.id);
    const availability = evaluateRestaurantAvailability(updated, orders);

    return NextResponse.json({
      restaurant: updated,
      availability,
    });
  } catch (error) {
    console.error("PATCH /api/restaurants/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to update restaurant settings" },
      { status: 500 }
    );
  }
}
