import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  listOrders,
  listRestaurants,
  updateOrderIntegrationFields,
  updateOrderStatus,
  updateRestaurantTenant,
} from "@/lib/db";
import {
  buildDefaultIntegrationsConfig,
  buildSimulatedDoorDashTracking,
} from "@/lib/integrationsDefaults";
import { OrderDeliveryTracking } from "@/lib/types";

export async function GET() {
  const platformConfig = getPlatformIntegrationsConfig();
  return NextResponse.json({
    endpoint: "/api/webhooks/doordash",
    provider: "DoorDash Drive API v2",
    status: platformConfig.doordashDrive.setupCompleted
      ? "active"
      : "awaiting_admin_setup",
    mode: platformConfig.doordashDrive.mode,
    supportedEvents: [
      "DASHER_CONFIRMED",
      "DASHER_CONFIRMED_STORE_ARRIVAL",
      "DELIVERY_PICKED_UP",
      "DELIVERY_DELIVERED",
      "DELIVERY_CANCELLED",
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
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
