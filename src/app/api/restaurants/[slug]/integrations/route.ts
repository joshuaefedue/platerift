import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getRestaurantBySlugOrDomain,
  listMenuItems,
  listOrders,
  updateOrderIntegrationFields,
  updateRestaurantTenant,
} from "@/lib/db";
import {
  buildDefaultIntegrationsConfig,
  buildSimulatedDoorDashTracking,
  buildVapiAssistantConfigPayload,
} from "@/lib/integrationsDefaults";
import { IntegrationActivityLog, OrderDeliveryTracking } from "@/lib/types";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const decodedSlug = decodeURIComponent(slug);
    const restaurant = getRestaurantBySlugOrDomain(decodedSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: `Restaurant '${decodedSlug}' not found` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const action = String(body.action || "");
    const now = new Date().toISOString();

    const currentConfig =
      restaurant.integrationsConfig || buildDefaultIntegrationsConfig(restaurant);

    const prependLog = (newLog: IntegrationActivityLog) => {
      currentConfig.activityLogs = [
        newLog,
        ...(currentConfig.activityLogs || []),
      ].slice(0, 30);
    };

    // 1. Save / Update Integrations Config
    if (action === "save_config") {
      const nextConfig = body.integrationsConfig || currentConfig;
      const updated = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: nextConfig,
      });
      return NextResponse.json({
        ok: true,
        integrationsConfig: updated?.integrationsConfig,
        restaurant: updated,
      });
    }

    // 2. Quote or Dispatch a DoorDash Drive Driver (for a specific order or a test quote)
    if (action === "dispatch_doordash") {
      const orderId = body.orderId as string | undefined;
      const orders = listOrders(restaurant.id);
      const targetOrder = orderId
        ? orders.find((o) => o.id === orderId)
        : orders.find((o) => o.orderType === "delivery") || orders[0];

      const orderNumber =
        targetOrder?.orderNumber ||
        `DD-${Math.floor(1000 + Math.random() * 9000)}`;
      const tracking = buildSimulatedDoorDashTracking({
        orderNumber,
        orderSubtotal: targetOrder?.subtotal || 35,
        config: currentConfig.doordashDrive,
        stage: "dasher_confirmed",
      });

      let updatedOrder = null;
      if (targetOrder) {
        updatedOrder = updateOrderIntegrationFields(targetOrder.id, {
          deliveryTracking: tracking,
        });
      }

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "doordash_drive",
        action: "Dasher Dispatched",
        status: "success",
        summary: `Dispatched DoorDash Driver (${tracking.dasherName}) for Order #${orderNumber} • Drive ID: ${tracking.externalDeliveryId} • Quoted Fee: $${tracking.feeTotal.toFixed(
          2
        )} (Customer paid $${tracking.customerFeeCharged.toFixed(
          2
        )}, Kitchen subsidy $${tracking.restaurantSubsidy.toFixed(2)}).`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
      });

      return NextResponse.json({
        ok: true,
        tracking,
        updatedOrder,
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        orders: listOrders(restaurant.id),
      });
    }

    // 3. Advance DoorDash Driver Live Status on an Order
    if (action === "advance_doordash_status") {
      const orderId = String(body.orderId || "");
      const orders = listOrders(restaurant.id);
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const existing =
        targetOrder.deliveryTracking ||
        buildSimulatedDoorDashTracking({
          orderNumber: targetOrder.orderNumber,
          orderSubtotal: targetOrder.subtotal,
          config: currentConfig.doordashDrive,
          stage: "quote_ready",
        });

      const statusSequence: OrderDeliveryTracking["status"][] = [
        "quote_ready",
        "created",
        "dasher_confirmed",
        "dasher_at_store",
        "picked_up",
        "delivered",
      ];
      const currentIdx = statusSequence.indexOf(existing.status);
      const nextStatus =
        statusSequence[Math.min(currentIdx + 1, statusSequence.length - 1)];

      const updatedTracking: OrderDeliveryTracking = {
        ...existing,
        status: nextStatus,
        updatedAt: now,
      };

      const updatedOrder = updateOrderIntegrationFields(targetOrder.id, {
        deliveryTracking: updatedTracking,
      });

      const statusLabels: Record<OrderDeliveryTracking["status"], string> = {
        quote_ready: "Delivery Quote Created",
        created: "Delivery Created",
        dasher_confirmed: "Dasher Assigned & Driving to Kitchen",
        dasher_at_store: "Dasher Arrived at Kitchen Pickup Counter",
        picked_up: "Dasher Picked Up Food & Heading to Customer",
        delivered: "Delivered to Customer Doorstep",
        cancelled: "Delivery Cancelled",
      };

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "doordash_drive",
        action: `Webhook: ${statusLabels[nextStatus]}`,
        status: "success",
        summary: `Order #${targetOrder.orderNumber} → ${statusLabels[nextStatus]} (Driver: ${updatedTracking.dasherName} • ${updatedTracking.dasherPhone}).`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
      });

      return NextResponse.json({
        ok: true,
        updatedOrder,
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        orders: listOrders(restaurant.id),
      });
    }

    // 4. Square POS 2-Way Menu + Inventory Sync
    if (action === "sync_square") {
      const menuItems = listMenuItems(restaurant.id);
      const soldOutItems = menuItems.filter((m) => !m.available).length;
      const totalVariantsAndSides = menuItems.reduce(
        (sum, item) => sum + (item.modifiers?.length || 0),
        0
      );

      currentConfig.square.lastSyncedAt = now;

      const nextPaymentConfig = {
        ...restaurant.paymentConfig,
        square: {
          enabled:
            currentConfig.square.enabled &&
            currentConfig.square.acceptSquareCheckout,
          applicationId: currentConfig.square.applicationId,
          locationId: currentConfig.square.locationId,
          accessToken: currentConfig.square.accessToken,
        },
      };

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "square",
        action: "Catalog & Stock Sync",
        status: "success",
        summary: `Square POS Sync Complete: ${menuItems.length} dishes, ${totalVariantsAndSides} size/side groups & ${soldOutItems} Sold-Out flags synced at Location ${currentConfig.square.locationId}.`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
        paymentConfig: nextPaymentConfig,
      });

      return NextResponse.json({
        ok: true,
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        restaurant: updatedRestaurant,
      });
    }

    // 5. Push Specific Order to Square POS Register / Kitchen Display
    if (action === "push_order_square") {
      const orderId = String(body.orderId || "");
      const orders = listOrders(restaurant.id);
      const targetOrder = orders.find((o) => o.id === orderId) || orders[0];

      const squareOrderId = `sq_ord_${
        targetOrder?.orderNumber || Math.floor(1000 + Math.random() * 9000)
      }`;
      if (targetOrder) {
        updateOrderIntegrationFields(targetOrder.id, {
          posSync: {
            ...targetOrder.posSync,
            squareOrderId,
            squareSyncedAt: now,
            sourceChannel:
              targetOrder.posSync?.sourceChannel || "web_storefront",
          },
        });
      }

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "square",
        action: "POS Order Push",
        status: "success",
        summary: `Pushed Order #${
          targetOrder?.orderNumber || "DEMO"
        } (${squareOrderId}) to Square POS & Kitchen Display at Location ${
          currentConfig.square.locationId
        }.`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
      });

      return NextResponse.json({
        ok: true,
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        orders: listOrders(restaurant.id),
      });
    }

    // 6. Clover POS 2-Way Menu + Stock Sync
    if (action === "sync_clover") {
      const menuItems = listMenuItems(restaurant.id);
      const soldOutItems = menuItems.filter((m) => !m.available).length;
      const totalModifiers = menuItems.reduce(
        (sum, item) => sum + (item.modifiers?.length || 0),
        0
      );

      currentConfig.clover.lastSyncedAt = now;

      const nextPaymentConfig = {
        ...restaurant.paymentConfig,
        clover: {
          enabled:
            currentConfig.clover.enabled &&
            currentConfig.clover.acceptCloverCheckout,
          merchantId: currentConfig.clover.merchantId,
          publicKey: currentConfig.clover.publicKey,
          privateToken: currentConfig.clover.privateToken,
        },
      };

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "clover",
        action: "Menu & Stock Sync",
        status: "success",
        summary: `Clover POS Sync Complete: ${menuItems.length} dishes, ${totalModifiers} modifier groups & ${soldOutItems} Sold-Out flags synced (Merchant ${currentConfig.clover.merchantId}).`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
        paymentConfig: nextPaymentConfig,
      });

      return NextResponse.json({
        ok: true,
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        restaurant: updatedRestaurant,
      });
    }

    // 7. Push Specific Order to Clover POS & Kitchen Printer
    if (action === "push_order_clover") {
      const orderId = String(body.orderId || "");
      const orders = listOrders(restaurant.id);
      const targetOrder = orders.find((o) => o.id === orderId) || orders[0];

      const cloverOrderId = `clv_ord_${
        targetOrder?.orderNumber || Math.floor(1000 + Math.random() * 9000)
      }`;
      if (targetOrder) {
        updateOrderIntegrationFields(targetOrder.id, {
          posSync: {
            ...targetOrder.posSync,
            cloverOrderId,
            cloverSyncedAt: now,
            sourceChannel:
              targetOrder.posSync?.sourceChannel || "web_storefront",
          },
        });
      }

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "clover",
        action: "Kitchen Printer KDS Push",
        status: "success",
        summary: `Pushed Order #${
          targetOrder?.orderNumber || "DEMO"
        } (${cloverOrderId}) to Clover POS & Kitchen Printer (Merchant ${
          currentConfig.clover.merchantId
        }).`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
      });

      return NextResponse.json({
        ok: true,
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        orders: listOrders(restaurant.id),
      });
    }

    // 8. Simulate an Inbound Vapi AI Phone Call Order (creates a real Order in the kitchen!)
    if (action === "simulate_vapi_phone_order") {
      const menuItems = listMenuItems(restaurant.id).filter((m) => m.available);
      const firstDish = menuItems[0] || {
        id: "voice_dish_1",
        name: "Smoky Party Jollof Rice & Peppered Asun Combo",
        price: 22.5,
      };
      const secondDish = menuItems[1] || menuItems[0] || {
        id: "voice_dish_2",
        name: "Sweet Fried Plantain (Dodo) & Beef Suya Skewers",
        price: 14.0,
      };

      const callerNames = [
        "Chinedu Okafor (Phone Call)",
        "Amina Bello (Phone Call)",
        "Tunde Adeyemi (Phone Call)",
        "Marcus Vance (Phone Call)",
      ];
      const callerName =
        callerNames[Math.floor(Math.random() * callerNames.length)];
      const orderType =
        body.orderType === "pickup" ? ("pickup" as const) : ("delivery" as const);

      const subtotal = Number((firstDish.price + secondDish.price).toFixed(2));
      const tax = Number(
        ((subtotal * (restaurant.paymentConfig.taxRatePercent || 8.5)) / 100).toFixed(2)
      );
      const deliveryFee =
        orderType === "delivery"
          ? currentConfig.doordashDrive.customerDeliveryFeeShare || 4.99
          : 0;
      const tip = 4.5;
      const total = Number((subtotal + tax + deliveryFee + tip).toFixed(2));

      const vapiCallId = `vapi_call_${Math.floor(100000 + Math.random() * 900000)}`;

      const { order: createdOrder } = createOrder({
        restaurantId: restaurant.id,
        customerName: callerName,
        customerEmail: "phone-caller@voiceorder.ai",
        customerPhone: "+1 (555) 742-8891",
        orderType,
        deliveryAddress:
          orderType === "delivery"
            ? "742 Evergreen Terrace, Apt 4B"
            : undefined,
        items: [
          {
            menuItemId: firstDish.id,
            name: firstDish.name,
            quantity: 1,
            unitPrice: firstDish.price,
            selectedModifiers: [
              {
                groupName: "Portion / Variant Size",
                optionLabel: "Large Hearty Bowl",
                priceDelta: 0,
              },
              {
                groupName: "Choose a Side Option",
                optionLabel: "Sweet Fried Plantain (Dodo)",
                priceDelta: 0,
              },
            ],
            itemTotal: firstDish.price,
          },
          {
            menuItemId: secondDish.id,
            name: secondDish.name,
            quantity: 1,
            unitPrice: secondDish.price,
            selectedModifiers: [
              {
                groupName: "Spice Level",
                optionLabel: "Extra Spicy Pepper Sauce",
                priceDelta: 0,
              },
            ],
            itemTotal: secondDish.price,
          },
        ],
        subtotal,
        tax,
        deliveryFee,
        tip,
        discount: 0,
        total,
        paymentMethod: "stripe",
        paymentStatus: "paid",
        paymentReference: vapiCallId,
        status: "confirmed",
        specialInstructions: `📞 Placed via Vapi AI Phone Receptionist (Call ID: ${vapiCallId}). SMS payment receipt confirmed.`,
        posSync: {
          sourceChannel: "vapi_voice_call",
        },
      });

      currentConfig.vapi.totalVoiceCallsHandled =
        (currentConfig.vapi.totalVoiceCallsHandled || 0) + 1;
      currentConfig.vapi.totalVoiceOrdersCreated =
        (currentConfig.vapi.totalVoiceOrdersCreated || 0) + 1;

      prependLog({
        id: `intlog_${Date.now()}`,
        integration: "vapi",
        action: "Inbound Phone Order Created",
        status: "success",
        summary: `📞 Vapi AI Phone Order #${
          createdOrder.orderNumber
        } created for ${callerName} ($${createdOrder.total.toFixed(
          2
        )}) • Added ${firstDish.name} + ${
          secondDish.name
        } & texted SMS checkout receipt.`,
        createdAt: now,
      });

      const updatedRestaurant = updateRestaurantTenant(restaurant.id, {
        integrationsConfig: currentConfig,
      });

      return NextResponse.json({
        ok: true,
        createdOrder,
        vapiAssistantPayload: buildVapiAssistantConfigPayload({
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
          cuisine: restaurant.cuisine,
          address: restaurant.address,
          phone: restaurant.phone,
          vapiConfig: currentConfig.vapi,
          menuItems,
        }),
        integrationsConfig: updatedRestaurant?.integrationsConfig,
        orders: listOrders(restaurant.id),
      });
    }

    return NextResponse.json(
      { error: `Unsupported integration action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("Error in integrations API:", err);
    return NextResponse.json(
      { error: "Failed to process integration action" },
      { status: 500 }
    );
  }
}
