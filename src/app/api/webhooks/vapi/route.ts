import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  createOrder,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listMenuItems,
  listOrders,
  listRestaurants,
  syncPlatformSettingFromTurso,
  updateRestaurantTenant,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import {
  buildDefaultIntegrationsConfig,
  buildSimulatedDoorDashTracking,
  buildVapiAssistantConfigPayload,
} from "@/lib/integrationsDefaults";
import type { MenuItem, OrderLineItem } from "@/lib/types";

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface RequestedVoiceItem {
  menuItemId?: string;
  name?: string;
  quantity: number;
}

function parseRequestedVoiceItems(
  args: Record<string, unknown>
): RequestedVoiceItem[] {
  const requested: RequestedVoiceItem[] = [];
  let rawItems = args.items;

  if (typeof rawItems === "string") {
    const trimmed = rawItems.trim();
    if (trimmed) {
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          rawItems = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          rawItems = [trimmed];
        }
      } else {
        rawItems = [trimmed];
      }
    }
  }

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    for (const entry of rawItems) {
      if (typeof entry === "string") {
        const cleanName = entry.trim();
        if (cleanName) {
          requested.push({ name: cleanName, quantity: 1 });
        }
      } else if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const menuItemId = obj.menuItemId
          ? String(obj.menuItemId).trim()
          : obj.id
          ? String(obj.id).trim()
          : obj.itemId
          ? String(obj.itemId).trim()
          : undefined;
        const name = obj.name
          ? String(obj.name).trim()
          : obj.dishName
          ? String(obj.dishName).trim()
          : obj.itemName
          ? String(obj.itemName).trim()
          : undefined;
        const qty = Math.min(
          99,
          Math.max(1, Math.round(Number(obj.quantity ?? obj.qty ?? 1) || 1))
        );
        if (menuItemId || name) {
          requested.push({ menuItemId, name, quantity: qty });
        }
      }
    }
  }

  if (
    requested.length === 0 &&
    (args.itemName || args.dishName || args.menuItemId)
  ) {
    const qty = Math.min(
      99,
      Math.max(1, Math.round(Number(args.quantity ?? args.qty ?? 1) || 1))
    );
    const singleName = args.itemName
      ? String(args.itemName).trim()
      : args.dishName
      ? String(args.dishName).trim()
      : undefined;
    const singleId = args.menuItemId
      ? String(args.menuItemId).trim()
      : undefined;
    if (singleId || singleName) {
      requested.push({
        menuItemId: singleId,
        name: singleName,
        quantity: qty,
      });
    }
  }

  return requested;
}

function findMatchingMenuItem(
  menuItems: MenuItem[],
  reqItem: { menuItemId?: string; name?: string }
): MenuItem | undefined {
  const reqId = reqItem.menuItemId?.trim().toLowerCase();
  const reqName = reqItem.name?.trim().toLowerCase();

  if (reqId) {
    const byId = menuItems.find((m) => m.id.toLowerCase() === reqId);
    if (byId) return byId;
  }

  if (!reqName) return undefined;

  const exact = menuItems.find(
    (m) => m.name.trim().toLowerCase() === reqName
  );
  if (exact) return exact;

  const substringMatches = menuItems.filter((m) => {
    const mName = m.name.trim().toLowerCase();
    return mName.includes(reqName) || reqName.includes(mName);
  });
  if (substringMatches.length > 0) {
    return substringMatches.find((m) => m.available) || substringMatches[0];
  }

  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2);
  const queryTokens = tokenize(reqName);
  if (queryTokens.length === 0) return undefined;

  let bestItem: MenuItem | undefined;
  let bestScore = 0;

  for (const m of menuItems) {
    const nameTokens = tokenize(m.name);
    if (nameTokens.length === 0) continue;
    const matchedCount = queryTokens.filter((qt) =>
      nameTokens.some((nt) => nt.includes(qt) || qt.includes(nt))
    ).length;
    const score = matchedCount / queryTokens.length;
    if (
      score >= 0.6 &&
      (score > bestScore ||
        (score === bestScore && m.available && !bestItem?.available))
    ) {
      bestScore = score;
      bestItem = m;
    }
  }

  return bestItem;
}

export async function GET() {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");
    const platformConfig = getPlatformIntegrationsConfig();
    return NextResponse.json({
      endpoint: "https://platerift.com/api/webhooks/vapi",
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
  } catch (err) {
    console.error("Error in Vapi webhook GET:", err);
    return NextResponse.json(
      { error: "Failed to load Vapi webhook status" },
      { status: 500 }
    );
  }
}

/**
 * Vapi Server URL Webhook Endpoint (`/api/webhooks/vapi`)
 * Handles:
 * 1. `assistant-request`: Dynamically returns the tenant's live menu, 86'd items, variants, sides, and voice persona.
 * 2. `tool-calls`: Executes `get_live_menu_and_stock`, `check_delivery_quote`, `place_voice_order`, and `check_order_status`.
 */
export async function POST(req: NextRequest) {
  try {
    const vapiSecret = (process.env.VAPI_WEBHOOK_SECRET || "").trim();
    if (vapiSecret) {
      const providedSecret = (req.headers.get("x-vapi-secret") || "").trim();
      if (
        !providedSecret ||
        !timingSafeEqualStrings(providedSecret, vapiSecret)
      ) {
        return NextResponse.json(
          { error: "Unauthorized Vapi webhook request" },
          { status: 401 }
        );
      }
    }

    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");

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
      let didMutate = false;

      for (const toolCall of toolCallList) {
        const fnName = toolCall.function?.name || toolCall.name;
        const rawArgs = toolCall.function?.arguments || toolCall.arguments || {};
        let args: Record<string, unknown> = {};
        if (typeof rawArgs === "string") {
          try {
            args = JSON.parse(rawArgs || "{}") || {};
          } catch {
            args = {};
          }
        } else if (rawArgs && typeof rawArgs === "object") {
          args = rawArgs as Record<string, unknown>;
        }

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
          const existingOrders = listOrders(restaurant.id);
          const availability = evaluateRestaurantAvailability(
            restaurant,
            existingOrders
          );
          if (!availability.allowed) {
            results.push({
              toolCallId: toolCall.id,
              result: JSON.stringify({
                success: false,
                reasonCode: availability.reasonCode,
                error: `${availability.title}: ${availability.message}`,
                message: `Sorry, ${restaurant.name} is currently closed or paused (${availability.title}: ${availability.message}).`,
              }),
            });
            continue;
          }

          const availableMenuItems = menuItems.filter((m) => m.available);
          const requestedItems = parseRequestedVoiceItems(args);
          const matchedLineItems: OrderLineItem[] = [];
          const skippedUnavailable: string[] = [];
          const unmatchedItems: string[] = [];

          if (requestedItems.length === 0) {
            if (menuItems.length > 0 && availableMenuItems.length === 0) {
              results.push({
                toolCallId: toolCall.id,
                result: JSON.stringify({
                  success: false,
                  error: `All items at ${restaurant.name} are currently 86'd / sold out.`,
                }),
              });
              continue;
            }
            const fallbackDish = availableMenuItems[0] || {
              id: "voice_item",
              name: "Chef Signature Special",
              price: 18.99,
            };
            matchedLineItems.push({
              menuItemId: fallbackDish.id,
              name: fallbackDish.name,
              quantity: 1,
              unitPrice: fallbackDish.price,
              selectedModifiers: [],
              itemTotal: fallbackDish.price,
            });
          } else {
            for (const reqItem of requestedItems) {
              const matched = findMatchingMenuItem(menuItems, reqItem);
              if (!matched) {
                unmatchedItems.push(
                  reqItem.name || reqItem.menuItemId || "Unknown item"
                );
                continue;
              }
              if (!matched.available) {
                skippedUnavailable.push(matched.name);
                continue;
              }
              const unitPrice = matched.price;
              const itemTotal = Number(
                (unitPrice * reqItem.quantity).toFixed(2)
              );
              matchedLineItems.push({
                menuItemId: matched.id,
                name: matched.name,
                quantity: reqItem.quantity,
                unitPrice,
                selectedModifiers: [],
                itemTotal,
              });
            }

            if (matchedLineItems.length === 0) {
              results.push({
                toolCallId: toolCall.id,
                result: JSON.stringify({
                  success: false,
                  error:
                    skippedUnavailable.length > 0
                      ? `Requested dish(es) are currently 86'd / unavailable: ${skippedUnavailable.join(
                          ", "
                        )}.`
                      : `Could not match requested dish(es) on ${restaurant.name}'s menu: ${unmatchedItems.join(
                          ", "
                        )}.`,
                  skippedUnavailableItems: skippedUnavailable,
                  unmatchedItems,
                  availableDishes: availableMenuItems.slice(0, 10).map((m) => ({
                    id: m.id,
                    name: m.name,
                    price: m.price,
                  })),
                }),
              });
              continue;
            }
          }

          const orderType =
            String(args.orderType || "").toLowerCase() === "delivery"
              ? ("delivery" as const)
              : ("pickup" as const);
          const subtotal = Number(
            matchedLineItems
              .reduce((sum, line) => sum + line.itemTotal, 0)
              .toFixed(2)
          );
          const taxRate = (restaurant.paymentConfig.taxRatePercent || 0) / 100;
          const tax = Number((subtotal * taxRate).toFixed(2));
          const ddCfg = integrations.doordashDrive;
          const isFreeDelivery =
            ddCfg.freeDeliveryThreshold > 0 &&
            subtotal >= ddCfg.freeDeliveryThreshold;
          const deliveryFee =
            orderType === "delivery"
              ? isFreeDelivery
                ? 0
                : Number((ddCfg.customerDeliveryFeeShare ?? 0).toFixed(2))
              : 0;
          const tip = Math.max(0, Number(args.tip) || 0);
          const total = Number((subtotal + tax + deliveryFee + tip).toFixed(2));

          const { order: createdOrder } = createOrder({
            restaurantId: restaurant.id,
            customerName: String(args.customerName || "Phone Caller"),
            customerEmail: "voice-caller@orders.local",
            customerPhone: String(args.customerPhone || "+15550001234"),
            orderType,
            deliveryAddress: args.deliveryAddress
              ? String(args.deliveryAddress)
              : undefined,
            items: matchedLineItems,
            subtotal,
            tax,
            deliveryFee,
            tip,
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

          const latestRestaurant =
            getRestaurantBySlugOrDomain(restaurant.id) || restaurant;
          const latestIntegrations =
            latestRestaurant.integrationsConfig || integrations;
          const updatedLogs = [
            {
              id: `ilog_vapi_wh_${Date.now()}`,
              integration: "vapi" as const,
              action: "Vapi Voice Order Created",
              status: "success" as const,
              summary: `Order #${createdOrder.orderNumber} ($${createdOrder.total.toFixed(
                2
              )}) via Vapi Voice AI (${matchedLineItems
                .map((i) => `${i.quantity}x ${i.name}`)
                .join(", ")}).`,
              createdAt: new Date().toISOString(),
            },
            ...(latestIntegrations.activityLogs || []),
          ].slice(0, 30);

          updateRestaurantTenant(restaurant.id, {
            integrationsConfig: {
              ...latestIntegrations,
              vapi: {
                ...latestIntegrations.vapi,
                totalVoiceCallsHandled:
                  (latestIntegrations.vapi.totalVoiceCallsHandled || 0) + 1,
                totalVoiceOrdersCreated:
                  (latestIntegrations.vapi.totalVoiceOrdersCreated || 0) + 1,
              },
              activityLogs: updatedLogs,
            },
          });
          didMutate = true;

          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify({
              success: true,
              orderNumber: createdOrder.orderNumber,
              subtotal: createdOrder.subtotal,
              tax: createdOrder.tax,
              deliveryFee: createdOrder.deliveryFee,
              total: createdOrder.total,
              items: createdOrder.items.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                itemTotal: i.itemTotal,
              })),
              prepTimeMinutes: restaurant.prepTimeMinutes,
              smsPaymentLinkSent: latestIntegrations.vapi.sendPaymentSmsAfterCall,
              deliveryTrackingUrl:
                createdOrder.deliveryTracking?.trackingUrl || null,
              ...(skippedUnavailable.length > 0
                ? { skippedUnavailableItems: skippedUnavailable }
                : {}),
              ...(unmatchedItems.length > 0 ? { unmatchedItems } : {}),
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

      if (didMutate) {
        await commitToTurso();
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
