import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  listMenuItems,
  listOrders,
  listRestaurants,
  updateRestaurantTenant,
} from "@/lib/db";
import {
  buildDefaultIntegrationsConfig,
  buildSimulatedDoorDashTracking,
  buildVapiAssistantConfigPayload,
} from "@/lib/integrationsDefaults";

export async function GET() {
  const platformConfig = getPlatformIntegrationsConfig();
  return NextResponse.json({
    endpoint: "/api/webhooks/vapi",
    provider: "Vapi Voice AI Server Webhook",
    status: platformConfig.vapi.setupCompleted
      ? "active"
      : "awaiting_admin_setup",
    mode: platformConfig.vapi.mode,
    supportedMessages: [
      "assistant-request",
      "tool-calls (get_live_menu_and_stock, check_delivery_quote, place_voice_order, check_order_status)",
    ],
  });
}

/**
 * Vapi Server URL Webhook Endpoint (`/api/webhooks/vapi`)
 * Handles:
 * 1. `assistant-request`: Dynamically returns the tenant's live menu, 86'd items, variants, sides, and voice persona.
 * 2. `tool-calls`: Executes `get_live_menu_and_stock`, `check_delivery_quote`, `place_voice_order`, and `check_order_status`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message || body;
    const messageType = String(message.type || "assistant-request");

    const slugParam =
      req.nextUrl.searchParams.get("slug") ||
      body.restaurantSlug ||
      message?.call?.metadata?.restaurantSlug;

    const restaurant =
      (slugParam ? getRestaurantBySlugOrDomain(slugParam) : null) ||
      listRestaurants()[0];

    if (!restaurant) {
      return NextResponse.json(
        { error: "No restaurant tenant found for Vapi webhook" },
        { status: 404 }
      );
    }

    const menuItems = listMenuItems(restaurant.id);
    const integrations =
      restaurant.integrationsConfig || buildDefaultIntegrationsConfig(restaurant);

    // 1. Dynamic Assistant Configuration Request
    if (messageType === "assistant-request") {
      const assistantPayload = buildVapiAssistantConfigPayload({
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        cuisine: restaurant.cuisine,
        address: restaurant.address,
        phone: restaurant.phone,
        vapiConfig: integrations.vapi,
        menuItems,
      });
      return NextResponse.json(assistantPayload);
    }

    // 2. Vapi Tool Calls (Server Function Execution during a live phone/voice call)
    if (messageType === "tool-calls" || messageType === "function-call") {
      const toolCallList = message.toolCallList ||
        message.toolCalls || [
          {
            id: "call_default",
            function: message.functionCall || {
              name: body.toolName || "get_live_menu_and_stock",
              arguments: body.arguments || {},
            },
          },
        ];

      const results = [];

      for (const toolCall of toolCallList) {
        const fnName = toolCall.function?.name || toolCall.name;
        const rawArgs = toolCall.function?.arguments || toolCall.arguments || {};
        const args =
          typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : rawArgs;

        if (fnName === "get_live_menu_and_stock") {
          const categoryFilter = String(args.category || "").toLowerCase();
          const availableDishes = menuItems
            .filter(
              (m) =>
                m.available &&
                (!categoryFilter ||
                  m.category.toLowerCase().includes(categoryFilter))
            )
            .map((m) => ({
              id: m.id,
              name: m.name,
              category: m.category,
              price: m.price,
              modifiers: m.modifiers,
            }));

          const soldOutDishes = menuItems
            .filter((m) => !m.available)
            .map((m) => m.name);

          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify({
              restaurantName: restaurant.name,
              prepTimeMinutes: restaurant.prepTimeMinutes,
              availableDishes,
              soldOutDishes,
            }),
          });
        } else if (fnName === "check_delivery_quote") {
          const customerAddress = String(
            args.deliveryAddress || args.customerAddress || "Customer Address"
          );
          const quote = buildSimulatedDoorDashTracking({
            orderNumber: "QUOTE",
            orderSubtotal: Number(args.orderSubtotal || 35),
            config: integrations.doordashDrive,
            stage: "quote_ready",
          });

          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify({
              deliverable: restaurant.features.delivery,
              customerAddress,
              customerDeliveryFee: quote.customerFeeCharged,
              estimatedTotalMinutes:
                restaurant.prepTimeMinutes + quote.dropoffEtaMinutes,
              provider: integrations.doordashDrive.enabled
                ? "DoorDash Drive White-Label Dasher"
                : "In-House Delivery",
            }),
          });
        } else if (fnName === "place_voice_order") {
          const dish = menuItems[0] || {
            id: "voice_item",
            name: "Chef Signature Special",
            price: 18.99,
          };
          const orderType =
            args.orderType === "delivery" ? ("delivery" as const) : ("pickup" as const);
          const subtotal = dish.price;
          const tax = Number((subtotal * 0.085).toFixed(2));
          const deliveryFee =
            orderType === "delivery"
              ? integrations.doordashDrive.customerDeliveryFeeShare
              : 0;
          const total = Number((subtotal + tax + deliveryFee).toFixed(2));

          const { order: createdOrder } = createOrder({
            restaurantId: restaurant.id,
            customerName: String(args.customerName || "Phone Caller"),
            customerEmail: "voice-caller@orders.local",
            customerPhone: String(args.customerPhone || "+15550001234"),
            orderType,
            deliveryAddress: args.deliveryAddress
              ? String(args.deliveryAddress)
              : undefined,
            items: [
              {
                menuItemId: dish.id,
                name: dish.name,
                quantity: 1,
                unitPrice: dish.price,
                selectedModifiers: [],
                itemTotal: dish.price,
              },
            ],
            subtotal,
            tax,
            deliveryFee,
            tip: 0,
            discount: 0,
            total,
            paymentMethod: "stripe",
            paymentStatus: "paid",
            paymentReference: `vapi_${Date.now()}`,
            status: "confirmed",
            specialInstructions: `📞 Placed via Vapi Voice AI Webhook`,
            posSync: {
              sourceChannel: "vapi_voice_call",
            },
          });

          integrations.vapi.totalVoiceCallsHandled =
            (integrations.vapi.totalVoiceCallsHandled || 0) + 1;
          integrations.vapi.totalVoiceOrdersCreated =
            (integrations.vapi.totalVoiceOrdersCreated || 0) + 1;
          updateRestaurantTenant(restaurant.id, {
            integrationsConfig: integrations,
          });

          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify({
              orderNumber: createdOrder.orderNumber,
              total: createdOrder.total,
              prepTimeMinutes: restaurant.prepTimeMinutes,
              smsPaymentLinkSent: integrations.vapi.sendPaymentSmsAfterCall,
              deliveryTrackingUrl:
                createdOrder.deliveryTracking?.trackingUrl || null,
            }),
          });
        } else if (fnName === "check_order_status") {
          const orders = listOrders(restaurant.id);
          const match = orders.find(
            (o) =>
              (args.orderNumber &&
                o.orderNumber
                  .toLowerCase()
                  .includes(String(args.orderNumber).toLowerCase())) ||
              (args.customerPhone &&
                o.customerPhone.includes(String(args.customerPhone)))
          );

          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify(
              match
                ? {
                    found: true,
                    orderNumber: match.orderNumber,
                    status: match.status,
                    dasherStatus: match.deliveryTracking?.status || null,
                    dasherName: match.deliveryTracking?.dasherName || null,
                  }
                : {
                    found: false,
                    message: "No active order found matching that number or phone.",
                  }
            ),
          });
        }
      }

      return NextResponse.json({ results });
    }

    return NextResponse.json({ ok: true, receivedType: messageType });
  } catch (err) {
    console.error("Error in Vapi webhook:", err);
    return NextResponse.json(
      { error: "Failed to handle Vapi webhook request" },
      { status: 500 }
    );
  }
}
