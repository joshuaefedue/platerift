import { NextRequest, NextResponse } from "next/server";
import {
  getRestaurantBySlugOrDomain,
  listMenuItems,
  listOrders,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import { MenuItem, OrderLineItem, OrderType } from "@/lib/types";

export interface AiConversationState {
  pendingItemId?: string | null;
  pendingQuantity?: number;
  selectedModifiers?: Record<
    string,
    { optionLabel: string; priceDelta: number }
  >;
  stage?:
    | "browsing"
    | "configuring_item"
    | "choosing_fulfillment"
    | "choosing_schedule"
    | "ready_for_checkout";
}

export interface AiCartAction {
  type: "add_item" | "remove_item" | "clear_cart";
  item?: MenuItem;
  quantity?: number;
  modifiers?: { groupName: string; optionLabel: string; priceDelta: number }[];
  menuItemId?: string;
}

export interface AiFulfillmentAction {
  orderType?: OrderType;
  timing?: "asap" | "scheduled";
  scheduledDate?: string;
  scheduledTime?: string;
  tableNumber?: string;
  deliveryAddress?: string;
  openCheckoutModal?: boolean;
}

function getDefaultBotPersona(
  slug: string,
  name: string,
  cuisine: string
): { botName: string; botRoleTitle: string } {
  if (slug.includes("bella")) {
    return {
      botName: "Chef Marco AI",
      botRoleTitle: "Wood-Fired Sommelier & Ordering Concierge",
    };
  }
  if (slug.includes("sakura")) {
    return {
      botName: "Sensei Kenji AI",
      botRoleTitle: "Omakase Master & Sushi Ordering Concierge",
    };
  }
  if (slug.includes("fuego")) {
    return {
      botName: "Mateo AI",
      botRoleTitle: "Taquero & Craft Agave Ordering Concierge",
    };
  }
  return {
    botName: `${name.split(" ")[0]} Concierge AI`,
    botRoleTitle: `${cuisine} Menu & Voice Ordering Assistant`,
  };
}

function matchModifierOptionsFromText(
  item: MenuItem,
  text: string
): Record<string, { optionLabel: string; priceDelta: number }> {
  const lower = text.toLowerCase();
  const matched: Record<string, { optionLabel: string; priceDelta: number }> =
    {};

  for (const group of item.modifiers || []) {
    for (const opt of group.options) {
      const optLower = opt.label.toLowerCase();
      // Match full option label or significant keywords (3+ chars)
      const keywords = optLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length >= 4 &&
            !["with", "option", "style", "crust", "sauce", "level"].includes(w)
        );

      if (
        lower.includes(optLower) ||
        keywords.some((kw) => lower.includes(kw))
      ) {
        matched[group.name] = {
          optionLabel: opt.label,
          priceDelta: opt.priceDelta,
        };
      }
    }
  }
  return matched;
}

function findMenuItemInText(
  menuItems: MenuItem[],
  text: string
): MenuItem | null {
  const lower = text.toLowerCase();

  // 1. Exact or substring dish name match (longest match first)
  const sorted = [...menuItems].sort((a, b) => b.name.length - a.name.length);
  for (const item of sorted) {
    if (lower.includes(item.name.toLowerCase())) {
      return item;
    }
  }

  // 2. Keyword score matching on dish name words
  let bestItem: MenuItem | null = null;
  let bestScore = 0;

  for (const item of menuItems) {
    const words = item.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !["the", "and", "with"].includes(w));

    let score = 0;
    for (const w of words) {
      if (lower.includes(w)) {
        score += w.length >= 5 ? 2 : 1;
      }
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
}

function parseQuantityFromText(text: string): number {
  const lower = text.toLowerCase();
  const wordNums: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const digitMatch = lower.match(/\b([1-9])\s+(?:x\s+)?[a-z]/i);
  if (digitMatch) {
    return Math.min(10, Math.max(1, Number(digitMatch[1]) || 1));
  }
  for (const [word, val] of Object.entries(wordNums)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
      return val;
    }
  }
  return 1;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const menuItems = listMenuItems(restaurant.id);
    const existingOrders = listOrders(restaurant.id);
    const availability = evaluateRestaurantAvailability(
      restaurant,
      existingOrders
    );

    const body = await req.json();
    const userMessage: string = String(body.message || "").trim();
    const lower = userMessage.toLowerCase();
    const cart: OrderLineItem[] = Array.isArray(body.cart) ? body.cart : [];
    const currentOrderType: OrderType = body.orderType || "pickup";
    const convState: AiConversationState = body.state || { stage: "browsing" };

    const defaultPersona = getDefaultBotPersona(
      restaurant.slug,
      restaurant.name,
      restaurant.cuisine
    );
    const botName =
      restaurant.features.aiAssistant?.botName || defaultPersona.botName;

    const categories = Array.from(new Set(menuItems.map((m) => m.category)));
    const availableItems = menuItems.filter((m) => m.available);
    const soldOutItems = menuItems.filter((m) => !m.available);

    const cartActions: AiCartAction[] = [];
    const fulfillmentActions: AiFulfillmentAction = {};
    let nextState: AiConversationState = { ...convState };
    let replyText = "";
    let speechText = "";
    let suggestedItems: MenuItem[] = [];
    let modifierPromptItem: MenuItem | null = null;
    let quickReplies: string[] = [];

    // Calculate current cart summary
    const cartSubtotal = cart.reduce((s, c) => s + c.itemTotal, 0);
    const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

    // -----------------------------------------------------------------------
    // 1. CHECK IF WE ARE CURRENTLY CONFIGURING AN ITEM'S MODIFIERS
    // -----------------------------------------------------------------------
    if (convState.pendingItemId) {
      const pendingItem = menuItems.find(
        (m) => m.id === convState.pendingItemId
      );
      if (pendingItem) {
        const isCancel =
          /\b(cancel|nevermind|never mind|skip|different|no thanks)\b/i.test(
            lower
          );
        const isDefault =
          /\b(default|standard|regular|classic|normal|none|no extra|as is|confirm|add it|done)\b/i.test(
            lower
          );

        const newlyMatched = matchModifierOptionsFromText(
          pendingItem,
          userMessage
        );
        const mergedMods = {
          ...(convState.selectedModifiers || {}),
          ...newlyMatched,
        };

        if (isCancel) {
          nextState = {
            stage: "browsing",
            pendingItemId: null,
            selectedModifiers: {},
          };
          replyText = `No problem! I cancelled adding **${pendingItem.name}**. What else from ${restaurant.name}'s ${restaurant.cuisine} menu can I help you explore?`;
          speechText = `No problem, I cancelled ${pendingItem.name}. What else can I get for you?`;
          quickReplies = [
            "Show Full Menu",
            "Popular Dishes",
            "Vegetarian Options",
          ];
        } else if (
          Object.keys(newlyMatched).length > 0 ||
          isDefault ||
          (pendingItem.modifiers || []).every((g) => mergedMods[g.name])
        ) {
          // Fill any remaining required modifier groups with their first default option
          const finalModArray: {
            groupName: string;
            optionLabel: string;
            priceDelta: number;
          }[] = [];

          for (const group of pendingItem.modifiers || []) {
            if (mergedMods[group.name]) {
              finalModArray.push({
                groupName: group.name,
                optionLabel: mergedMods[group.name].optionLabel,
                priceDelta: mergedMods[group.name].priceDelta,
              });
            } else if (group.required && group.options.length > 0) {
              finalModArray.push({
                groupName: group.name,
                optionLabel: group.options[0].label,
                priceDelta: group.options[0].priceDelta,
              });
            }
          }

          const qty = convState.pendingQuantity || 1;
          const modDelta = finalModArray.reduce(
            (s, m) => s + m.priceDelta,
            0
          );
          const unitTotal = (pendingItem.price + modDelta).toFixed(2);
          const modSummary =
            finalModArray.length > 0
              ? ` (${finalModArray.map((m) => m.optionLabel).join(", ")})`
              : "";

          cartActions.push({
            type: "add_item",
            item: pendingItem,
            quantity: qty,
            modifiers: finalModArray,
          });

          nextState = {
            stage: "choosing_fulfillment",
            pendingItemId: null,
            pendingQuantity: 1,
            selectedModifiers: {},
          };

          const enabledModes = [
            restaurant.features.pickup ? "Pickup" : null,
            restaurant.features.delivery ? "Delivery" : null,
            restaurant.features.dineInQr ? "Dine-In" : null,
          ].filter(Boolean);

          replyText = `✅ Added **${qty}× ${pendingItem.name}**${modSummary} ($${unitTotal} each) to your order!\n\nWould you like to add another dish, choose your fulfillment mode (${enabledModes.join(
            " / "
          )}), pick an advance pickup time slot, or proceed to checkout?`;
          speechText = `Added ${qty} ${pendingItem.name} ${
            finalModArray.length > 0
              ? `with ${finalModArray.map((m) => m.optionLabel).join(" and ")}`
              : ""
          } to your cart. Would you like anything else, or are you ready to choose ${enabledModes.join(
            " or "
          )} and checkout?`;

          quickReplies = [
            "Proceed to Checkout",
            ...(restaurant.features.pickup ? ["Switch to Pickup"] : []),
            ...(restaurant.features.delivery ? ["Switch to Delivery"] : []),
            "Schedule Advance Date/Time",
            "Show Desserts & Sides",
          ];

          return NextResponse.json({
            botName,
            replyText,
            speechText,
            cartActions,
            fulfillmentActions,
            state: nextState,
            suggestedItems,
            modifierPromptItem: null,
            quickReplies,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. CHECK FOR CART / CHECKOUT / FULFILLMENT / SCHEDULE COMMANDS
    // -----------------------------------------------------------------------
    if (
      /\b(checkout|pay now|complete order|finalize|place order|ready to order|proceed)\b/i.test(
        lower
      )
    ) {
      if (cart.length === 0) {
        replyText = `Your cart is currently empty! Tell me which dish you'd like to add first — for example, try one of our chef favorites below.`;
        speechText = `Your cart is empty right now. Tell me which dish you'd like to add first!`;
        suggestedItems = availableItems.filter((m) => m.popular).slice(0, 3);
        quickReplies = suggestedItems.map((m) => `Order ${m.name}`);
      } else {
        fulfillmentActions.openCheckoutModal = true;
        const minSpend = restaurant.minOrderAmount || 15;
        const meetsMin = cartSubtotal >= minSpend;
        replyText = meetsMin
          ? `🧾 Opening the **${restaurant.name} Direct Checkout** modal for your **${cartCount} item(s)** (Subtotal: **$${cartSubtotal.toFixed(
              2
            )}** • Mode: **${currentOrderType.toUpperCase()}**). You can review your scheduled time slot and complete payment with Stripe or PayPal!`
          : `⚠️ Your cart has **${cartCount} item(s)** ($${cartSubtotal.toFixed(
              2
            )}), which is **$${(minSpend - cartSubtotal).toFixed(
              2
            )} away** from ${restaurant.name}'s **$${minSpend} minimum order**. Would you like to add one more item first?`;
        speechText = meetsMin
          ? `Opening checkout for your ${cartCount} items, subtotal ${cartSubtotal.toFixed(
              2
            )} dollars for ${currentOrderType}.`
          : `Your subtotal is ${cartSubtotal.toFixed(
              2
            )} dollars, which is ${(minSpend - cartSubtotal).toFixed(
              2
            )} dollars below our ${minSpend} dollar minimum. What else can I add for you?`;
        if (!meetsMin) {
          fulfillmentActions.openCheckoutModal = false;
          suggestedItems = availableItems.slice(0, 3);
        }
        quickReplies = meetsMin
          ? ["Switch to Pickup", "Switch to Delivery", "Review Cart"]
          : suggestedItems.map((m) => `Add ${m.name}`);
      }
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    if (/\b(clear cart|empty cart|start over|remove everything)\b/i.test(lower)) {
      cartActions.push({ type: "clear_cart" });
      nextState = { stage: "browsing", pendingItemId: null };
      replyText = `🗑️ I've cleared your cart so we can start fresh. What are you in the mood for today at **${restaurant.name}**?`;
      speechText = `I've cleared your cart. What can I get started for you today?`;
      quickReplies = [
        "Show Full Menu",
        "Chef Specials",
        "Gluten-Free / Vegetarian",
      ];
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems: availableItems.slice(0, 3),
        modifierPromptItem: null,
        quickReplies,
      });
    }

    // Check for Fulfillment Mode switching (Pickup / Delivery / Dine-In)
    if (
      /\b(switch to pickup|for pickup|pick up|curbside|takeout|carryout)\b/i.test(
        lower
      ) &&
      !/what|when|hour|slot/i.test(lower)
    ) {
      if (!restaurant.features.pickup) {
        replyText = `⚠️ Sorry, **Pickup** is currently disabled by ${restaurant.name}. Available fulfillment options: ${[
          restaurant.features.delivery ? "🛵 Delivery" : null,
          restaurant.features.dineInQr ? "🍽️ Dine-In" : null,
        ]
          .filter(Boolean)
          .join(", ")}.`;
        speechText = `Sorry, pickup is currently disabled at ${restaurant.name}.`;
      } else {
        fulfillmentActions.orderType = "pickup";
        const pickupNote =
          restaurant.features.pickupInstructions ||
          "In-store counter and curbside pickup available ($0 fee).";
        replyText = `🛍️ Switched your order to **Pickup**! ${pickupNote}\n\n${
          restaurant.advanceNoticeDays > 0 || restaurant.advanceNoticeHours > 0
            ? `Note: ${restaurant.name} requires **${restaurant.advanceNoticeDays}d ${restaurant.advanceNoticeHours}h** advance notice.`
            : `Estimated prep time is **~${restaurant.prepTimeMinutes} mins**.`
        } Would you like to pick an advance pickup date/time slot or continue ordering?`;
        speechText = `Switched your order to pickup with zero delivery fee. Would you like to pick a pickup time slot or add more dishes?`;
        quickReplies = [
          "Available Pickup Time Slots",
          "Proceed to Checkout",
          "Show Menu",
        ];
      }
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    if (
      /\b(switch to delivery|for delivery|deliver to|delivery mode)\b/i.test(
        lower
      ) &&
      !/fee|how much|minimum/i.test(lower)
    ) {
      if (!restaurant.features.delivery) {
        replyText = `⚠️ Sorry, **Delivery** is currently disabled at ${restaurant.name}. We currently offer ${[
          restaurant.features.pickup ? "🛍️ Pickup" : null,
          restaurant.features.dineInQr ? "🍽️ Dine-In" : null,
        ]
          .filter(Boolean)
          .join(" and ")}.`;
        speechText = `Sorry, delivery is currently disabled at ${restaurant.name}.`;
      } else {
        fulfillmentActions.orderType = "delivery";
        replyText = `🛵 Switched your order to **Local Delivery**! Delivery fee is **$${restaurant.paymentConfig.deliveryFee.toFixed(
          2
        )}** (Free on orders over **$${restaurant.paymentConfig.freeDeliveryMin}**). ${
          restaurant.features.deliveryInstructions || ""
        }`;
        speechText = `Switched your order to delivery. Delivery fee is ${restaurant.paymentConfig.deliveryFee} dollars, or free over ${restaurant.paymentConfig.freeDeliveryMin} dollars.`;
        quickReplies = [
          "Proceed to Checkout",
          "Show Popular Dishes",
          "Switch to Pickup",
        ];
      }
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    if (/\b(switch to dine|dine-in|dine in|table number|at table)\b/i.test(lower)) {
      if (!restaurant.features.dineInQr) {
        replyText = `⚠️ Sorry, **Dine-In QR ordering** is currently disabled at ${restaurant.name}.`;
        speechText = `Sorry, dine-in ordering is currently disabled.`;
      } else {
        fulfillmentActions.orderType = "dine_in";
        const tableMatch = lower.match(/table\s+#?(\d+)/i);
        if (tableMatch) {
          fulfillmentActions.tableNumber = tableMatch[1];
        }
        replyText = `🍽️ Switched your order to **Dine-In Table Service**${
          tableMatch ? ` at **Table #${tableMatch[1]}**` : ""
        }! ${
          restaurant.features.dineInInstructions ||
          "Our servers will bring your dishes fresh to your table."
        }`;
        speechText = `Switched your order to dine in${
          tableMatch ? ` at table ${tableMatch[1]}` : ""
        }.`;
        quickReplies = ["Proceed to Checkout", "Show Menu", "Switch to Pickup"];
      }
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    // Check for Time Slot / Schedule / Hours / Advance Notice inquiries or booking
    const timeMatch = userMessage.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (
      timeMatch ||
      /\b(time slot|pickup time|schedule for|advance|hours|when are you open)\b/i.test(
        lower
      )
    ) {
      const todayDayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ] as const;
      const mentionedDay = todayDayNames.find((d) =>
        lower.includes(d.toLowerCase())
      );
      const targetDayName =
        mentionedDay || todayDayNames[new Date().getDay()] || "Friday";
      const dayRule =
        restaurant.weeklySchedule.find((d) => d.day === targetDayName) ||
        restaurant.weeklySchedule[0];

      if (timeMatch && dayRule) {
        const hhmm = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        fulfillmentActions.timing = "scheduled";
        fulfillmentActions.scheduledTime = hhmm;
        const maxCap =
          dayRule.pickupSlotCapacities?.[hhmm] ??
          dayRule.pickupSlotMaxOrders ??
          5;
        replyText = `📅 I've set your scheduled fulfillment time to **${hhmm}** (Slot capacity: up to **${maxCap} orders**). ${
          restaurant.advanceNoticeDays > 0 || restaurant.advanceNoticeHours > 0
            ? `Remember ${restaurant.name} requires **${restaurant.advanceNoticeDays}d ${restaurant.advanceNoticeHours}h** advance notice.`
            : ""
        } Ready to checkout or add more items?`;
        speechText = `I've set your scheduled time to ${hhmm}. Would you like to proceed to checkout or add more items?`;
        quickReplies = ["Proceed to Checkout", "Show Menu", "Review Cart"];
        return NextResponse.json({
          botName,
          replyText,
          speechText,
          cartActions,
          fulfillmentActions,
          state: nextState,
          suggestedItems,
          modifierPromptItem: null,
          quickReplies,
        });
      }

      const openDays = restaurant.weeklySchedule
        .filter((d) => d.enabled)
        .map(
          (d) =>
            `• **${d.day}**: Store ${d.openTime}–${d.closeTime} | Pickup ${
              d.pickupEnabled !== false
                ? `${d.pickupStartTime || d.openTime}–${
                    d.pickupEndTime || d.closeTime
                  } (up to ${d.pickupSlotMaxOrders ?? 5} orders/slot)`
                : "Closed"
            }`
        )
        .join("\n");

      const leadNotice =
        restaurant.advanceNoticeDays > 0 || restaurant.advanceNoticeHours > 0
          ? `⏳ **Required Advance Notice**: ${restaurant.advanceNoticeDays} day(s), ${restaurant.advanceNoticeHours} hour(s) (+${restaurant.prepTimeMinutes}m prep).`
          : `🔥 **Same-Day Prep Time**: ~${restaurant.prepTimeMinutes} minutes.`;

      replyText = `🕒 **${restaurant.name} Schedule & Pickup Time Slots**\n${leadNotice}\n\n${openDays}\n\nYou can tell me a time like *"Schedule pickup at 18:30"* or click a time slot directly!`;
      speechText = `${restaurant.name} is open ${
        restaurant.weeklySchedule.filter((d) => d.enabled).length
      } days a week. ${
        restaurant.advanceNoticeDays > 0 || restaurant.advanceNoticeHours > 0
          ? `Please note we require ${restaurant.advanceNoticeDays} days and ${restaurant.advanceNoticeHours} hours advance notice.`
          : `Our standard preparation time is ${restaurant.prepTimeMinutes} minutes.`
      } Tell me what time you'd like, such as schedule at 18:30.`;
      quickReplies = [
        "Schedule at 12:30",
        "Schedule at 18:00",
        "Schedule at 19:30",
        "Show Menu",
      ];
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    // -----------------------------------------------------------------------
    // 3. CHECK IF USER MENTIONS A SPECIFIC MENU ITEM (ORDERING OR DETAILS)
    // -----------------------------------------------------------------------
    const matchedItem = findMenuItemInText(menuItems, userMessage);
    if (matchedItem) {
      const isAskingQuestionOnly =
        /\b(what is|what's in|describe|tell me about|ingredients|options for|modifiers for|how much is)\b/i.test(
          lower
        ) && !/\b(add|order|want|get|buy|give me|like)\b/i.test(lower);

      if (!matchedItem.available) {
        const alternatives = availableItems.filter(
          (m) => m.category === matchedItem.category && m.id !== matchedItem.id
        );
        const fallbackList =
          alternatives.length > 0 ? alternatives : availableItems.slice(0, 3);
        replyText = `⚠️ **${matchedItem.name}** ($${matchedItem.price.toFixed(
          2
        )}) is currently **86'd / Unavailable** (${
          matchedItem.unavailableReason || "Sold out for this service"
        }).\n\nMay I recommend one of our available chef favorites instead?`;
        speechText = `Sorry, ${matchedItem.name} is currently unavailable because ${
          matchedItem.unavailableReason || "it is sold out for tonight"
        }. Here are some delicious available alternatives!`;
        suggestedItems = fallbackList;
        quickReplies = fallbackList.map((m) => `Order ${m.name}`);
        return NextResponse.json({
          botName,
          replyText,
          speechText,
          cartActions,
          fulfillmentActions,
          state: nextState,
          suggestedItems,
          modifierPromptItem: null,
          quickReplies,
        });
      }

      const qty = parseQuantityFromText(userMessage);
      const matchedMods = matchModifierOptionsFromText(
        matchedItem,
        userMessage
      );
      const hasModifierGroups =
        matchedItem.modifiers && matchedItem.modifiers.length > 0;

      if (isAskingQuestionOnly) {
        const modDetails = hasModifierGroups
          ? matchedItem.modifiers
              .map(
                (g) =>
                  `• **${g.name}** (${g.required ? "Required" : "Optional"}): ${g.options
                    .map(
                      (o) =>
                        `${o.label}${
                          o.priceDelta > 0
                            ? ` (+$${o.priceDelta.toFixed(2)})`
                            : " (Included)"
                        }`
                    )
                    .join(", ")}`
              )
              .join("\n")
          : "• No required modifiers — prepared in our signature house style.";

        replyText = `🍽️ **${matchedItem.name}** — **$${matchedItem.price.toFixed(
          2
        )}** *(${matchedItem.category})*\n${matchedItem.description}\n\n**Dietary Tags**: ${
          matchedItem.dietaryTags.join(", ") || "None"
        } • **Prep Time**: ~${matchedItem.prepTimeMinutes}m${
          matchedItem.currentStockCount !== null
            ? ` • **In Stock**: ${matchedItem.currentStockCount} left`
            : ""
        }\n\n**Available Customizations & Options**:\n${modDetails}\n\nWould you like me to add **${matchedItem.name}** to your order?`;
        speechText = `${matchedItem.name} is ${matchedItem.price.toFixed(
          2
        )} dollars. ${matchedItem.description}. ${
          hasModifierGroups
            ? `You can customize it with ${matchedItem.modifiers
                .map((g) => g.name)
                .join(" and ")}.`
            : ""
        } Would you like to order it?`;
        suggestedItems = [matchedItem];
        quickReplies = [
          `Order ${matchedItem.name}`,
          "Show Full Menu",
          "Popular Dishes",
        ];
        return NextResponse.json({
          botName,
          replyText,
          speechText,
          cartActions,
          fulfillmentActions,
          state: nextState,
          suggestedItems,
          modifierPromptItem: null,
          quickReplies,
        });
      }

      // If the item has modifiers and the user didn't specify all required ones yet, walk them through options!
      const allRequiredSatisfied = (matchedItem.modifiers || [])
        .filter((g) => g.required)
        .every((g) => Boolean(matchedMods[g.name]));

      if (
        hasModifierGroups &&
        Object.keys(matchedMods).length === 0 &&
        !allRequiredSatisfied
      ) {
        nextState = {
          stage: "configuring_item",
          pendingItemId: matchedItem.id,
          pendingQuantity: qty,
          selectedModifiers: matchedMods,
        };
        modifierPromptItem = matchedItem;

        const modBreakdown = matchedItem.modifiers
          .map(
            (g) =>
              `**${g.name}** *(${g.required ? "Required" : "Optional"})*:\n` +
              g.options
                .map(
                  (o) =>
                    `  ◦ **${o.label}** ${
                      o.priceDelta > 0
                        ? `(+$${o.priceDelta.toFixed(2)})`
                        : "(+$0.00)"
                    }`
                )
                .join("\n")
          )
          .join("\n\n");

        const firstGroupOptions =
          matchedItem.modifiers[0]?.options.map((o) => o.label) || [];

        replyText = `Great choice! Before I add **${qty}× ${matchedItem.name}** ($${matchedItem.price.toFixed(
          2
        )}) to your cart, how would you like to customize its options?\n\n${modBreakdown}\n\nClick an option below, tell me your choice by voice/text, or say **"Standard"** for the chef's default preparation!`;
        speechText = `Great choice! How would you like your ${
          matchedItem.name
        } prepared? For ${matchedItem.modifiers[0]?.name}, we have ${firstGroupOptions.join(
          ", or "
        )}. You can also say standard for chef's default.`;
        quickReplies = [
          ...firstGroupOptions,
          "Standard / Default Options",
          "Cancel",
        ];

        return NextResponse.json({
          botName,
          replyText,
          speechText,
          cartActions,
          fulfillmentActions,
          state: nextState,
          suggestedItems: [],
          modifierPromptItem,
          quickReplies,
        });
      }

      // Otherwise add the item immediately with matched + default required modifiers!
      const finalMods: {
        groupName: string;
        optionLabel: string;
        priceDelta: number;
      }[] = [];
      for (const group of matchedItem.modifiers || []) {
        if (matchedMods[group.name]) {
          finalMods.push({
            groupName: group.name,
            optionLabel: matchedMods[group.name].optionLabel,
            priceDelta: matchedMods[group.name].priceDelta,
          });
        } else if (group.required && group.options.length > 0) {
          finalMods.push({
            groupName: group.name,
            optionLabel: group.options[0].label,
            priceDelta: group.options[0].priceDelta,
          });
        }
      }

      const modDelta = finalMods.reduce((s, m) => s + m.priceDelta, 0);
      const unitPriceWithMods = (matchedItem.price + modDelta).toFixed(2);
      const modSummary =
        finalMods.length > 0
          ? ` with **${finalMods.map((m) => m.optionLabel).join(", ")}**`
          : "";

      cartActions.push({
        type: "add_item",
        item: matchedItem,
        quantity: qty,
        modifiers: finalMods,
      });

      nextState = {
        stage: "choosing_fulfillment",
        pendingItemId: null,
        pendingQuantity: 1,
        selectedModifiers: {},
      };

      replyText = `✅ I've added **${qty}× ${matchedItem.name}**${modSummary} ($${unitPriceWithMods} each) to your cart!\n\nWould you like to add anything else, switch between **${[
        restaurant.features.pickup ? "Pickup" : null,
        restaurant.features.delivery ? "Delivery" : null,
        restaurant.features.dineInQr ? "Dine-In" : null,
      ]
        .filter(Boolean)
        .join(" / ")}**, or proceed to checkout?`;
      speechText = `Added ${qty} ${matchedItem.name} to your cart! Would you like anything else, or are you ready to checkout?`;
      quickReplies = [
        "Proceed to Checkout",
        "Show Desserts & Starters",
        "Schedule Pickup Time",
        "Review Cart",
      ];

      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems: [],
        modifierPromptItem: null,
        quickReplies,
      });
    }

    // -----------------------------------------------------------------------
    // 4. DIETARY / CATEGORY / POPULAR / CART SUMMARY QUERIES
    // -----------------------------------------------------------------------
    if (
      /\b(vegetarian|vegan|gluten-free|gluten free|allergy|dietary|healthy|spicy)\b/i.test(
        lower
      )
    ) {
      const targetTag = lower.includes("gluten")
        ? "gluten"
        : lower.includes("vegan")
        ? "vegan"
        : lower.includes("vegetarian")
        ? "vegetarian"
        : "";

      const matching = availableItems.filter((m) =>
        targetTag
          ? m.dietaryTags.some((t) => t.toLowerCase().includes(targetTag)) ||
            m.modifiers.some((g) =>
              g.options.some((o) => o.label.toLowerCase().includes(targetTag))
            )
          : m.dietaryTags.length > 0
      );

      suggestedItems = matching.length > 0 ? matching : availableItems;
      const listStr = suggestedItems
        .map(
          (m) =>
            `• **${m.name}** ($${m.price.toFixed(2)}) — *${m.dietaryTags.join(
              ", "
            )}*${
              m.modifiers.length > 0
                ? ` [Options: ${m.modifiers
                    .map(
                      (g) =>
                        `${g.name}: ${g.options.map((o) => o.label).join("/")}`
                    )
                    .join("; ")}]`
                : ""
            }`
        )
        .join("\n");

      replyText = `🌿 Here are the **${
        targetTag ? targetTag.toUpperCase() : "Dietary-Friendly"
      }** dishes and modifier options at **${restaurant.name}**:\n\n${listStr}\n\nWhich one would you like to customize or add to your cart?`;
      speechText = `We have ${suggestedItems.length} matching dishes, including ${suggestedItems
        .slice(0, 3)
        .map((m) => m.name)
        .join(", ")}. Which one can I add for you?`;
      quickReplies = suggestedItems.slice(0, 4).map((m) => `Order ${m.name}`);

      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    if (/\b(cart|my order|basket|total|what did i order|review)\b/i.test(lower)) {
      if (cart.length === 0) {
        replyText = `🛒 Your cart at **${restaurant.name}** is currently empty. Tell me what you're craving or pick a popular dish below!`;
        speechText = `Your cart is currently empty. Here are some of our most popular dishes to get started.`;
        suggestedItems = availableItems.filter((m) => m.popular).slice(0, 3);
        quickReplies = suggestedItems.map((m) => `Order ${m.name}`);
      } else {
        const lines = cart
          .map(
            (c) =>
              `• **${c.quantity}× ${c.name}**${
                c.selectedModifiers.length > 0
                  ? ` (${c.selectedModifiers
                      .map((m) => m.optionLabel)
                      .join(", ")})`
                  : ""
              } — **$${c.itemTotal.toFixed(2)}**`
          )
          .join("\n");
        replyText = `🛒 **Your Current Order at ${restaurant.name}** (${currentOrderType.toUpperCase()}):\n\n${lines}\n\n**Subtotal**: **$${cartSubtotal.toFixed(
          2
        )}** (Min order: $${restaurant.minOrderAmount})\n\nSay **"Proceed to Checkout"** when you're ready to pay, or tell me another dish to add!`;
        speechText = `You have ${cartCount} items in your cart for ${currentOrderType}, with a subtotal of ${cartSubtotal.toFixed(
          2
        )} dollars. Say proceed to checkout whenever you're ready.`;
        quickReplies = [
          "Proceed to Checkout",
          "Switch to Pickup",
          "Switch to Delivery",
          "Clear Cart",
        ];
      }
      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    // Check if user asks for a specific category (e.g. pizza, pasta, sushi, ramen, tacos, dessert, starters)
    const matchedCategory = categories.find((cat) => {
      const catWords = cat
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3);
      return catWords.some((w) => lower.includes(w));
    });

    if (matchedCategory) {
      const catItems = menuItems.filter((m) => m.category === matchedCategory);
      suggestedItems = catItems.filter((m) => m.available);
      const breakdown = catItems
        .map(
          (m) =>
            `• **${m.name}** ($${m.price.toFixed(2)}) ${
              !m.available ? `— ❌ *[86'd: ${m.unavailableReason}]*` : ""
            }\n  _${m.description}_${
              m.modifiers.length > 0
                ? `\n  **Options**: ${m.modifiers
                    .map(
                      (g) =>
                        `${g.name} (${g.options
                          .map(
                            (o) =>
                              `${o.label}${
                                o.priceDelta > 0 ? ` +$${o.priceDelta}` : ""
                              }`
                          )
                          .join(", ")})`
                    )
                    .join(" | ")}`
                : ""
            }`
        )
        .join("\n\n");

      replyText = `🍴 **${matchedCategory} at ${restaurant.name}**:\n\n${breakdown}\n\nTell me which dish (and any options) you'd like to add!`;
      speechText = `In our ${matchedCategory} category, we have ${suggestedItems
        .map((m) => `${m.name} for ${m.price} dollars`)
        .join(", ")}. Which one would you like to try?`;
      quickReplies = suggestedItems.map((m) => `Order ${m.name}`);

      return NextResponse.json({
        botName,
        replyText,
        speechText,
        cartActions,
        fulfillmentActions,
        state: nextState,
        suggestedItems,
        modifierPromptItem: null,
        quickReplies,
      });
    }

    // -----------------------------------------------------------------------
    // 5. DEFAULT MENU OVERVIEW & CONCIERGE GUIDANCE
    // -----------------------------------------------------------------------
    suggestedItems = availableItems.filter((m) => m.popular).slice(0, 4);
    if (suggestedItems.length === 0) {
      suggestedItems = availableItems.slice(0, 4);
    }

    const categoryOverview = categories
      .map((cat) => {
        const itemsInCat = menuItems.filter((m) => m.category === cat);
        return `• **${cat}**: ${itemsInCat
          .map(
            (m) =>
              `${m.name} ($${m.price.toFixed(2)}${
                !m.available ? " - 86'd" : ""
              })`
          )
          .join(", ")}`;
      })
      .join("\n");

    const enabledFulfillmentList = [
      restaurant.features.pickup ? "🛍️ Pickup" : null,
      restaurant.features.delivery
        ? `🛵 Delivery ($${restaurant.paymentConfig.deliveryFee.toFixed(2)})`
        : null,
      restaurant.features.dineInQr ? "🍽️ Dine-In QR" : null,
    ]
      .filter(Boolean)
      .join(" • ");

    replyText = `👋 Welcome to **${restaurant.name}** (*${restaurant.tagline}*)! I'm **${botName}**, your voice & text ordering concierge.\n\n**Our Menu Categories (${availableItems.length} dishes available${
      soldOutItems.length > 0 ? `, ${soldOutItems.length} 86'd` : ""
    })**:\n${categoryOverview}\n\n**Active Fulfillment**: ${enabledFulfillmentList}\n${
      !availability.allowed
        ? `⚠️ *Note: ${availability.title} — ${availability.message}*`
        : ""
    }\n\nYou can ask about any dish's ingredients & modifier options, or tell me what you'd like to order by voice or text!`;

    speechText = `Welcome to ${restaurant.name}! I'm ${botName}. We have ${categories.join(
      ", "
    )} available today. Tell me what you'd like to order, or ask me about any dish and its customization options!`;

    quickReplies = [
      ...categories.map((c) => `Show ${c}`),
      "Gluten-Free & Vegetarian",
      "Pickup Hours & Time Slots",
      ...(cart.length > 0 ? ["Proceed to Checkout"] : []),
    ];

    return NextResponse.json({
      botName,
      replyText,
      speechText,
      cartActions,
      fulfillmentActions,
      state: nextState,
      suggestedItems,
      modifierPromptItem: null,
      quickReplies,
    });
  } catch (error) {
    console.error("POST /api/restaurants/[slug]/ai-assistant error:", error);
    return NextResponse.json(
      { error: "Failed to process AI assistant request" },
      { status: 500 }
    );
  }
}
