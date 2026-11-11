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
    endpoint: "/api/webhooks/clover",
    provider: "Clover POS & Kitchen KDS API v3",
    status: platformConfig.clover.setupCompleted
      ? "active"
      : "awaiting_admin_setup",
    environment: platformConfig.clover.environment,
    supportedEvents: ["item_stock", "items", "orders", "payments"],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = String(body.type || body.objectType || "item_stock");
    const merchantId = String(body.merchantId || "");
    const restaurantSlug = String(body.restaurant_slug || "");

    const allRestaurants = listRestaurants();
    const targetRestaurant =
      (restaurantSlug
        ? getRestaurantBySlugOrDomain(restaurantSlug)
        : undefined) ||
      allRestaurants.find(
        (r) =>
          merchantId &&
          r.integrationsConfig?.clover?.merchantId === merchantId
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

    let detailMessage = `Processed Clover webhook event (${eventType}).`;
    let updatedItemName: string | null = null;

    if (eventType === "item_stock" || eventType === "items") {
      const itemName = String(body.item_name || body.name || "");
      const stockCount =
        body.quantity !== undefined
          ? Number(body.quantity)
          : body.stockCount !== undefined
          ? Number(body.stockCount)
          : 0;

      const targetItem =
        menuItems.find(
          (m) =>
            itemName && m.name.toLowerCase().includes(itemName.toLowerCase())
        ) || menuItems[0];

      if (targetItem && intCfg.clover.autoSyncMenuAndStock) {
        updateMenuItem(targetItem.id, {
          currentStockCount: stockCount,
          available: stockCount > 0,
          unavailableReason:
            stockCount <= 0
              ? "Auto-86'd via Clover Station Item Stock Webhook (0 stock)"
              : "",
        });
        updatedItemName = targetItem.name;
        detailMessage =
          stockCount <= 0
            ? `Clover Station reported 0 stock for "${targetItem.name}" — auto-86'd on web storefront.`
            : `Clover Station updated "${targetItem.name}" stock to ${stockCount} — marked Available on web storefront.`;
      }
    }

    const nextLogs = [
      {
        id: `ilog_clv_wh_${Date.now()}`,
        integration: "clover" as const,
        action: `Clover Webhook: ${eventType}`,
        status: "success" as const,
        summary: detailMessage,
        createdAt: now,
      },
      ...(intCfg.activityLogs || []),
    ].slice(0, 30);

    updateRestaurantTenant(targetRestaurant.id, {
      integrationsConfig: {
        ...intCfg,
        clover: {
          ...intCfg.clover,
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
    console.error("Clover webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process Clover webhook" },
      { status: 500 }
    );
  }
}
