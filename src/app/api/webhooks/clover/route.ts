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
import { syncCloverInventoryAndModifiers } from "@/lib/squareCloverPosClient";

export async function GET() {
  const platformConfig = getPlatformIntegrationsConfig();
  return NextResponse.json({
    endpoint: "https://platerift.com/api/webhooks/clover",
    provider: "Clover POS & Kitchen KDS API v3",
    status: platformConfig.clover.setupCompleted
      ? "active"
      : "awaiting_admin_setup",
    environment: platformConfig.clover.environment,
    supportedEventKeys: [
      "I (Inventory Items)",
      "IC (Inventory Categories)",
      "IG (Modifier Groups)",
      "IM (Modifiers)",
      "O (Orders)",
      "P (Payments)",
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    const body = await req.json();

    // Support Clover's verificationCode handshake when registering webhook URL in Clover Developer Dashboard
    if (body.verificationCode) {
      return NextResponse.json({
        verificationCode: body.verificationCode,
        verified: true,
      });
    }

    // Parse Clover's native { merchants: { [mId]: [{ objectId: "I:...", type: "UPDATE" }] } } format or direct payload
    let merchantId = String(body.merchantId || "");
    let rawEventKey = String(body.type || body.objectType || "I");

    if (body.merchants && typeof body.merchants === "object") {
      const mIds = Object.keys(body.merchants);
      if (mIds.length > 0) {
        merchantId = mIds[0];
        const firstEvent = Array.isArray(body.merchants[merchantId])
          ? body.merchants[merchantId][0]
          : null;
        if (firstEvent?.objectId) {
          rawEventKey = String(firstEvent.objectId).split(":")[0] || "I";
        }
      }
    }

    const restaurantSlug = String(body.restaurant_slug || "");
    const allRestaurants = listRestaurants();
    const platformConfig = getPlatformIntegrationsConfig();

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

    const eventKeyLabelMap: Record<string, string> = {
      I: "I (Inventory Item Updated)",
      IC: "IC (Category Updated)",
      IG: "IG (Modifier Group Updated)",
      IM: "IM (Modifier Updated)",
      item_stock: "I (Item Stock Updated)",
      items: "I (Inventory Item Updated)",
    };
    const eventLabel = eventKeyLabelMap[rawEventKey] || rawEventKey;

    let detailMessage = `Processed Clover webhook event [${eventLabel}].`;
    let updatedItemName: string | null = null;

    if (
      rawEventKey === "I" ||
      rawEventKey === "item_stock" ||
      rawEventKey === "items"
    ) {
      const itemName = String(body.item_name || body.name || "");
      const hasStockField =
        body.quantity !== undefined || body.stockCount !== undefined;
      const stockCount =
        body.quantity !== undefined
          ? Number(body.quantity)
          : body.stockCount !== undefined
          ? Number(body.stockCount)
          : 0;

      if (hasStockField) {
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
              ? `Clover event [I]: 0 stock for "${targetItem.name}" — auto-86'd on web storefront.`
              : `Clover event [I]: updated "${targetItem.name}" stock to ${stockCount} — marked Available.`;
        }
      } else {
        const syncRes = await syncCloverInventoryAndModifiers({
          tenantCfg: intCfg.clover,
          platformCfg: platformConfig.clover,
          menuItemsFallback: menuItems,
        });
        detailMessage = `Clover event [${eventLabel}]: ${syncRes.summary}`;
      }
    } else if (
      rawEventKey === "IC" ||
      rawEventKey === "IG" ||
      rawEventKey === "IM"
    ) {
      const syncRes = await syncCloverInventoryAndModifiers({
        tenantCfg: intCfg.clover,
        platformCfg: platformConfig.clover,
        menuItemsFallback: menuItems,
      });
      detailMessage = `Clover event [${eventLabel}]: ${syncRes.summary}`;
    }

    const nextLogs = [
      {
        id: `ilog_clv_wh_${Date.now()}`,
        integration: "clover" as const,
        action: `Clover Webhook: ${eventLabel}`,
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
    await commitToTurso();

    return NextResponse.json({
      received: true,
      eventKey: rawEventKey,
      eventLabel,
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
