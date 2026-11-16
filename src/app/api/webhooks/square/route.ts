import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listMenuItems,
  listRestaurants,
  updateMenuItem,
  updateRestaurantTenant,
} from "@/lib/db";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import { verifySquareWebhookSignature } from "@/lib/security";
import { searchSquareCatalogObjects } from "@/lib/squareCloverPosClient";

export async function GET() {
  const platformConfig = getPlatformIntegrationsConfig();
  return NextResponse.json({
    endpoint: "https://platerift.com/api/webhooks/square",
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
    await hydrateFromTursoIfNeeded();
    const rawBody = await req.text();
    const body = JSON.parse(rawBody || "{}");
    const platformConfig = getPlatformIntegrationsConfig();
    const sigHeader = req.headers.get("x-square-hmacsha256-signature");

    if (
      !verifySquareWebhookSignature({
        rawBody,
        signatureHeader: sigHeader,
        signatureKey: platformConfig.square.webhookSignatureKey,
        notificationUrl: platformConfig.square.webhookUrl,
      })
    ) {
      return NextResponse.json(
        { error: "Invalid Square HMAC-SHA256 webhook signature" },
        { status: 401 }
      );
    }

    const eventType = String(body.type || "inventory.count.updated");
    const locationId = String(body.location_id || body.merchant_id || "");
    const restaurantSlug = String(body.restaurant_slug || "");
    const beginTime = String(
      body.data?.object?.catalog_version?.updated_at ||
        body.begin_time ||
        ""
    );

    const allRestaurants = listRestaurants();
    const targetRestaurant =
      (restaurantSlug
        ? getRestaurantBySlugOrDomain(restaurantSlug)
        : undefined) ||
      allRestaurants.find(
        (r) =>
          locationId &&
          (r.integrationsConfig?.square?.locationId === locationId ||
            r.integrationsConfig?.square?.merchantId === locationId)
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
    let nextCursorTime =
      beginTime || intCfg.square.lastCatalogCursorTimestamp || now;

    if (eventType === "inventory.count.updated") {
      const counts = Array.isArray(body.data?.object?.inventory_counts)
        ? body.data.object.inventory_counts[0]
        : body.data?.object || body;
      const itemName = String(
        counts?.item_name || body.data?.object?.item_name || body.item_name || ""
      );
      const quantity =
        counts?.quantity !== undefined
          ? Number(counts.quantity)
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
      const deltaSync = await searchSquareCatalogObjects({
        tenantCfg: intCfg.square,
        platformCfg: platformConfig.square,
        beginTime:
          beginTime || intCfg.square.lastCatalogCursorTimestamp || null,
        menuItemsFallback: menuItems,
      });
      nextCursorTime = deltaSync.latestTime;
      detailMessage = deltaSync.summary;
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
          lastCatalogCursorTimestamp: nextCursorTime,
          lastSyncedAt: now,
        },
        activityLogs: nextLogs,
      },
    });
    await commitToTurso();

    return NextResponse.json({
      received: true,
      eventType,
      restaurant: targetRestaurant.slug,
      updatedItem: updatedItemName,
      beginTimeUsed: beginTime || null,
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
