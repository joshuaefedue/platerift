import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listMenuItems,
  listRestaurants,
  syncPlatformSettingFromTurso,
  updateMenuItem,
  updateRestaurantTenant,
} from "@/lib/db";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import { syncCloverInventoryAndModifiers } from "@/lib/squareCloverPosClient";
import type { IntegrationActivityLog } from "@/lib/types";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface CloverEventEntry {
  objectId?: string;
  type?: string;
  ts?: number;
  item_name?: string;
  name?: string;
  quantity?: number | string;
  stockCount?: number | string;
}

const EVENT_KEY_LABEL_MAP: Record<string, string> = {
  I: "I (Inventory Item Updated)",
  IC: "IC (Category Updated)",
  IG: "IG (Modifier Group Updated)",
  IM: "IM (Modifier Updated)",
  O: "O (Order Updated)",
  P: "P (Payment Updated)",
  item_stock: "I (Item Stock Updated)",
  items: "I (Inventory Item Updated)",
};

export async function GET() {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");
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
  } catch (error) {
    console.error("Clover webhook GET error:", error);
    return NextResponse.json(
      { error: "Failed to load Clover webhook status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");
    const body = await req.json();
    const platformConfig = getPlatformIntegrationsConfig();

    const cloverAuthHeader = req.headers.get("x-clover-auth");
    const expectedVerificationCode = (
      platformConfig.clover.webhookVerificationCode || ""
    ).trim();
    if (
      cloverAuthHeader !== null &&
      expectedVerificationCode &&
      !expectedVerificationCode.startsWith("clv_verify_master_")
    ) {
      if (
        !timingSafeEqualStrings(
          cloverAuthHeader.trim(),
          expectedVerificationCode
        )
      ) {
        return NextResponse.json(
          { error: "Invalid X-Clover-Auth verification header" },
          { status: 401 }
        );
      }
    }

    // Support Clover's verificationCode handshake when registering webhook URL in Clover Developer Dashboard
    if (body.verificationCode) {
      return NextResponse.json({
        verificationCode: body.verificationCode,
        verified: true,
      });
    }

    const restaurantSlug = String(body.restaurant_slug || "");
    const allRestaurants = listRestaurants();

    // Parse Clover's native { merchants: { [mId]: [{ objectId: "I:...", type: "UPDATE" }] } } format or direct payload
    const hasMerchantsMap =
      body.merchants &&
      typeof body.merchants === "object" &&
      !Array.isArray(body.merchants);

    const merchantBatches: Array<{
      merchantId: string;
      events: CloverEventEntry[];
    }> = [];

    if (hasMerchantsMap) {
      for (const [mId, rawEvents] of Object.entries(
        body.merchants as Record<string, unknown>
      )) {
        const events = Array.isArray(rawEvents)
          ? (rawEvents as CloverEventEntry[])
          : rawEvents && typeof rawEvents === "object"
          ? [rawEvents as CloverEventEntry]
          : [];
        if (events.length > 0) {
          merchantBatches.push({ merchantId: mId, events });
        }
      }
    } else {
      merchantBatches.push({
        merchantId: String(body.merchantId || ""),
        events: [
          {
            objectId: body.objectId ? String(body.objectId) : undefined,
            type: String(body.type || body.objectType || "I"),
            item_name: body.item_name,
            name: body.name,
            quantity: body.quantity,
            stockCount: body.stockCount,
          },
        ],
      });
    }

    if (merchantBatches.length === 0) {
      return NextResponse.json({
        received: true,
        eventKey: null,
        eventLabel: null,
        restaurant: null,
        updatedItem: null,
        detail: "No Clover merchant events in payload.",
        processedCount: 0,
        processedEvents: [],
      });
    }

    const now = new Date().toISOString();
    const processedResults: Array<{
      merchantId: string;
      restaurant: string;
      eventKey: string;
      eventLabel: string;
      updatedItem: string | null;
      detail: string;
    }> = [];
    let didMutate = false;

    for (let batchIdx = 0; batchIdx < merchantBatches.length; batchIdx++) {
      const batch = merchantBatches[batchIdx];
      const mId = batch.merchantId;

      const matchedRestaurant =
        (restaurantSlug
          ? getRestaurantBySlugOrDomain(restaurantSlug)
          : undefined) ||
        allRestaurants.find(
          (r) => mId && r.integrationsConfig?.clover?.merchantId === mId
        ) ||
        allRestaurants[0];

      if (!matchedRestaurant) {
        if (merchantBatches.length === 1) {
          return NextResponse.json(
            { error: "No matching restaurant tenant found" },
            { status: 404 }
          );
        }
        continue;
      }

      // Re-read fresh tenant state in case multiple merchant entries resolve to the same tenant
      const targetRestaurant =
        getRestaurantBySlugOrDomain(matchedRestaurant.id) || matchedRestaurant;
      const intCfg =
        targetRestaurant.integrationsConfig ||
        buildDefaultIntegrationsConfig(targetRestaurant);
      let menuItems = listMenuItems(targetRestaurant.id);
      let cachedFullSync: Awaited<
        ReturnType<typeof syncCloverInventoryAndModifiers>
      > | null = null;
      const newLogsForMerchant: IntegrationActivityLog[] = [];

      for (let evIdx = 0; evIdx < batch.events.length; evIdx++) {
        const ev = batch.events[evIdx];
        const rawEventKey = ev?.objectId
          ? String(ev.objectId).split(":")[0] || "I"
          : String(ev?.type || body.type || body.objectType || "I");
        const eventLabel = EVENT_KEY_LABEL_MAP[rawEventKey] || rawEventKey;

        let detailMessage = `Processed Clover webhook event [${eventLabel}].`;
        let updatedItemName: string | null = null;

        if (
          rawEventKey === "I" ||
          rawEventKey === "item_stock" ||
          rawEventKey === "items"
        ) {
          const itemName = String(
            ev?.item_name ?? ev?.name ?? body.item_name ?? body.name ?? ""
          );
          const rawQty =
            ev?.quantity !== undefined
              ? ev.quantity
              : ev?.stockCount !== undefined
              ? ev.stockCount
              : body.quantity !== undefined
              ? body.quantity
              : body.stockCount;
          const hasStockField = rawQty !== undefined;
          const stockCount = hasStockField ? Number(rawQty) : 0;

          if (hasStockField) {
            const targetItem =
              menuItems.find(
                (m) =>
                  itemName &&
                  m.name.toLowerCase().includes(itemName.toLowerCase())
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
              menuItems = listMenuItems(targetRestaurant.id);
              updatedItemName = targetItem.name;
              detailMessage =
                stockCount <= 0
                  ? `Clover event [I]: 0 stock for "${targetItem.name}" — auto-86'd on web storefront.`
                  : `Clover event [I]: updated "${targetItem.name}" stock to ${stockCount} — marked Available.`;
            }
          } else {
            if (!cachedFullSync) {
              cachedFullSync = await syncCloverInventoryAndModifiers({
                tenantCfg: intCfg.clover,
                platformCfg: platformConfig.clover,
                menuItemsFallback: menuItems,
              });
            }
            detailMessage = `Clover event [${eventLabel}]: ${cachedFullSync.summary}`;
          }
        } else if (
          rawEventKey === "IC" ||
          rawEventKey === "IG" ||
          rawEventKey === "IM"
        ) {
          if (!cachedFullSync) {
            cachedFullSync = await syncCloverInventoryAndModifiers({
              tenantCfg: intCfg.clover,
              platformCfg: platformConfig.clover,
              menuItemsFallback: menuItems,
            });
          }
          detailMessage = `Clover event [${eventLabel}]: ${cachedFullSync.summary}`;
        }

        newLogsForMerchant.unshift({
          id: `ilog_clv_wh_${Date.now()}_${batchIdx}_${evIdx}`,
          integration: "clover" as const,
          action: `Clover Webhook: ${eventLabel}`,
          status: "success" as const,
          summary: detailMessage,
          createdAt: now,
        });

        processedResults.push({
          merchantId: mId || intCfg.clover.merchantId,
          restaurant: targetRestaurant.slug,
          eventKey: rawEventKey,
          eventLabel,
          updatedItem: updatedItemName,
          detail: detailMessage,
        });
      }

      const nextLogs = [
        ...newLogsForMerchant,
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
      didMutate = true;
    }

    if (didMutate) {
      await commitToTurso();
    }

    const primary = processedResults[0];
    return NextResponse.json({
      received: true,
      eventKey: primary?.eventKey || null,
      eventLabel: primary?.eventLabel || null,
      restaurant: primary?.restaurant || null,
      updatedItem: primary?.updatedItem || null,
      detail: primary?.detail || "Processed Clover webhook.",
      processedCount: processedResults.length,
      processedEvents: processedResults,
    });
  } catch (error) {
    console.error("Clover webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process Clover webhook" },
      { status: 500 }
    );
  }
}
