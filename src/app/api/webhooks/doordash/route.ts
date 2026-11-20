import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listOrders,
  listRestaurants,
  syncPlatformSettingFromTurso,
  updateOrderIntegrationFields,
  updateOrderStatus,
  updateRestaurantTenant,
} from "@/lib/db";
import {
  buildDefaultIntegrationsConfig,
  buildSimulatedDoorDashTracking,
} from "@/lib/integrationsDefaults";
import { resolveDoorDashCredentials } from "@/lib/doordashDriveClient";
import { OrderDeliveryTracking } from "@/lib/types";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET() {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");
    const platformConfig = getPlatformIntegrationsConfig();
    const creds = resolveDoorDashCredentials(
      undefined,
      platformConfig.doordashDrive
    );
    return NextResponse.json({
      endpoint: "https://platerift.com/api/webhooks/doordash",
      provider: "DoorDash Drive API v2",
      status: platformConfig.doordashDrive.setupCompleted
        ? "active"
        : "awaiting_admin_setup",
      mode: platformConfig.doordashDrive.mode,
      credentialsConfigured: creds.isRealKey,
      credentialSource: creds.source,
      supportedEvents: [
        "DASHER_CONFIRMED",
        "DASHER_CONFIRMED_STORE_ARRIVAL",
        "DELIVERY_PICKED_UP",
        "DELIVERY_DELIVERED",
        "DELIVERY_CANCELLED",
      ],
    });
  } catch (error) {
    console.error("DoorDash Drive webhook GET error:", error);
    return NextResponse.json(
      { error: "Failed to load DoorDash Drive webhook status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const envSecret = (process.env.DOORDASH_WEBHOOK_SECRET || "").trim();
    if (envSecret) {
      const authHeader = req.headers.get("authorization") || "";
      const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
      const headerSecret = (
        req.headers.get("x-doordash-webhook-secret") || ""
      ).trim();
      const validBearer = bearerToken
        ? timingSafeEqualStrings(bearerToken, envSecret)
        : false;
      const validHeader = headerSecret
        ? timingSafeEqualStrings(headerSecret, envSecret)
        : false;
      if (!validBearer && !validHeader) {
        return NextResponse.json(
          { error: "Unauthorized DoorDash webhook request" },
          { status: 401 }
        );
      }
    }

    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");

    const body = await req.json();
    const eventName = String(
      body.event_name || body.event_category || body.status || "DASHER_CONFIRMED"
    ).toUpperCase();
    const externalDeliveryId = String(body.external_delivery_id || "");
    const restaurantSlug = String(body.restaurant_slug || body.store_id || "");

    const stageMap: Record<
      string,
      | "quote_ready"
      | "created"
      | "dasher_confirmed"
      | "dasher_at_store"
      | "picked_up"
      | "delivered"
      | "cancelled"
    > = {
      CREATED: "created",
      QUOTE_CREATED: "quote_ready",
      DASHER_CONFIRMED: "dasher_confirmed",
      DASHER_CONFIRMED_STORE_ARRIVAL: "dasher_at_store",
      DASHER_AT_STORE: "dasher_at_store",
      DELIVERY_PICKED_UP: "picked_up",
      PICKED_UP: "picked_up",
      DELIVERY_DELIVERED: "delivered",
      DELIVERED: "delivered",
      DELIVERY_CANCELLED: "cancelled",
      CANCELLED: "cancelled",
    };

    const mappedStage = stageMap[eventName] || "dasher_confirmed";

    // Locate the target restaurant & order
    const allRestaurants = listRestaurants();
    const targetRestaurant =
      (restaurantSlug
        ? getRestaurantBySlugOrDomain(restaurantSlug)
        : undefined) ||
      allRestaurants.find((r) =>
        externalDeliveryId
          .toLowerCase()
          .includes(r.slug.replace(/-/g, "").slice(0, 6))
      ) ||
      allRestaurants[0];

    if (!targetRestaurant) {
      return NextResponse.json(
        { error: "No matching restaurant tenant found" },
        { status: 404 }
      );
    }

    const orders = listOrders(targetRestaurant.id);
    const matchingOrder =
      orders.find(
        (o) =>
          o.deliveryTracking?.externalDeliveryId === externalDeliveryId ||
          (body.order_id && o.id === body.order_id) ||
          (body.order_number && o.orderNumber === body.order_number)
      ) || orders.find((o) => o.orderType === "delivery");

    const intCfg =
      targetRestaurant.integrationsConfig ||
      buildDefaultIntegrationsConfig(targetRestaurant);

    let updatedTracking: OrderDeliveryTracking | undefined;
    if (matchingOrder) {
      const baseTracking = buildSimulatedDoorDashTracking({
        orderNumber: matchingOrder.orderNumber,
        orderSubtotal: matchingOrder.subtotal,
        config: intCfg.doordashDrive,
        stage: mappedStage,
      });

      updatedTracking = {
        ...baseTracking,
        externalDeliveryId:
          externalDeliveryId ||
          matchingOrder.deliveryTracking?.externalDeliveryId ||
          baseTracking.externalDeliveryId,
        dasherName:
          body.dasher_name ||
          matchingOrder.deliveryTracking?.dasherName ||
          baseTracking.dasherName,
        dasherPhone:
          body.dasher_phone_number ||
          matchingOrder.deliveryTracking?.dasherPhone ||
          baseTracking.dasherPhone,
        dasherVehicle:
          body.dasher_vehicle ||
          matchingOrder.deliveryTracking?.dasherVehicle ||
          baseTracking.dasherVehicle,
        trackingUrl:
          body.tracking_url ||
          matchingOrder.deliveryTracking?.trackingUrl ||
          baseTracking.trackingUrl,
        status: mappedStage,
        updatedAt: new Date().toISOString(),
      };

      updateOrderIntegrationFields(matchingOrder.id, {
        deliveryTracking: updatedTracking,
      });

      if (mappedStage === "picked_up") {
        updateOrderStatus(matchingOrder.id, "ready");
      } else if (mappedStage === "delivered") {
        updateOrderStatus(matchingOrder.id, "completed");
      }
    }

    const nextLogs = [
      {
        id: `ilog_dd_wh_${Date.now()}`,
        integration: "doordash_drive" as const,
        action: `DoorDash Webhook: ${eventName}`,
        status: "success" as const,
        summary: matchingOrder
          ? `Order ${matchingOrder.orderNumber} updated to "${mappedStage}" (${updatedTracking?.dasherName || "Dasher"}).`
          : `Processed DoorDash Drive webhook event ${eventName}.`,
        createdAt: new Date().toISOString(),
      },
      ...(intCfg.activityLogs || []),
    ].slice(0, 30);

    updateRestaurantTenant(targetRestaurant.id, {
      integrationsConfig: {
        ...intCfg,
        activityLogs: nextLogs,
      },
    });
    await commitToTurso();

    return NextResponse.json({
      received: true,
      event: eventName,
      mappedStage,
      orderNumber: matchingOrder?.orderNumber || null,
      deliveryTracking: updatedTracking || null,
    });
  } catch (error) {
    console.error("DoorDash Drive webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process DoorDash Drive webhook" },
      { status: 500 }
    );
  }
}
