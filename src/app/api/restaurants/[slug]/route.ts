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
  updateRestaurantTenant,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import {
  sanitizePlatformIntegrationsForClient,
  sanitizePlatformTwilioForClient,
  sanitizeRestaurantForPublicStorefront,
} from "@/lib/security";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
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

    const isPublicStorefrontView =
      req.nextUrl.searchParams.get("view") === "storefront";

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
    await hydrateFromTursoIfNeeded();
    const { slug } = await context.params;
    const decodedSlug = decodeURIComponent(slug);
    const body = await req.json();

    const updated = updateRestaurantTenant(decodedSlug, body);
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
