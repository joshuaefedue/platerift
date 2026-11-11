import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  listMenuItems,
  listRestaurants,
  updateMenuItem,
  updateRestaurantTenant,
} from "@/lib/db";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";

export async function GET() {
  const platformConfig = getPlatformIntegrationsConfig();
  return NextResponse.json({
    endpoint: "/api/webhooks/square",
    provider: "Square POS & Commerce API",
    status: platformConfig.square.setupCompleted
      ? "active"
      : "awaiting_admin_setup",
    environment: platformConfig.square.environment,
    supportedEvents: [
      "inventory.count.updated",
      "catalog.version.updated",
      "order.updated",
      "payment.updated",
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = String(body.type || "inventory.count.updated");
    const locationId = String(body.location_id || body.merchant_id || "");
    const restaurantSlug = String(body.restaurant_slug || "");

    const allRestaurants = listRestaurants();
    const targetRestaurant =
      (restaurantSlug
        ? getRestaurantBySlugOrDomain(restaurantSlug)
        : undefined) ||
      allRestaurants.find(
        (r) =>
          locationId &&
          r.integrationsConfig?.square?.locationId === locationId
      ) ||
      allRestaurants[0];

    if (!targetRestaurant) {
      return NextResponse.json(
        { error: "No matching restaurant tenant found" },
        { status: 404 }
      );
    }

    const intCfg =
      targetRestaurant.integrationsConfig ||
      buildDefaultIntegrationsConfig(targetRestaurant);
    const menuItems = listMenuItems(targetRestaurant.id);
    const now = new Date().toISOString();

    let detailMessage = `Processed Square webhook event (${eventType}).`;
    let updatedItemName: string | null = null;

    if (eventType === "inventory.count.updated") {
      const itemName = String(
        body.data?.object?.item_name || body.item_name || ""
      );
      const quantity =
        body.data?.object?.quantity !== undefined
          ? Number(body.data.object.quantity)
          : body.quantity !== undefined
          ? Number(body.quantity)
          : 0;

      const targetItem =
        menuItems.find(
          (m) =>
            itemName && m.name.toLowerCase().includes(itemName.toLowerCase())
        ) || menuItems[0];

      if (targetItem && intCfg.square.autoSyncCatalogAndStock) {
        updateMenuItem(targetItem.id, {
          currentStockCount: quantity,
          available: quantity > 0,
          unavailableReason:
            quantity <= 0
              ? "Auto-86'd via Square POS Inventory Webhook (0 count at register)"
              : "",
        });
        updatedItemName = targetItem.name;
        detailMessage =
          quantity <= 0
            ? `Square Register reported 0 count for "${targetItem.name}" — auto-86'd on web storefront.`
            : `Square Register updated "${targetItem.name}" count to ${quantity} — marked Available on web storefront.`;
      }
    } else if (eventType === "catalog.version.updated") {
      detailMessage = `Synced ${menuItems.length} catalog items & modifier groups from Square Catalog API.`;
    }

    const nextLogs = [
      {
        id: `ilog_sq_wh_${Date.now()}`,
        integration: "square" as const,
        action: `Square Webhook: ${eventType}`,
        status: "success" as const,
        summary: detailMessage,
        createdAt: now,
      },
      ...(intCfg.activityLogs || []),
    ].slice(0, 30);

    updateRestaurantTenant(targetRestaurant.id, {
      integrationsConfig: {
        ...intCfg,
        square: {
          ...intCfg.square,
          lastSyncedAt: now,
        },
        activityLogs: nextLogs,
      },
    });

    return NextResponse.json({
      received: true,
      eventType,
      restaurant: targetRestaurant.slug,
      updatedItem: updatedItemName,
      detail: detailMessage,
    });
  } catch (error) {
    console.error("Square webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process Square webhook" },
      { status: 500 }
    );
  }
}
