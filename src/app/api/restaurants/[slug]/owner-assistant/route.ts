import { NextRequest, NextResponse } from "next/server";
import {
  createCustomerManual,
  createEmailCampaign,
  createMenuItem,
  createSmsLog,
  createUserAccount,
  deleteMenuItem,
  deleteUserAccount,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  listCustomers,
  listEmailCampaigns,
  listMenuItems,
  listOrders,
  listSmsLogs,
  listUsers,
  updateMenuItem,
  updateOrderStatus,
  updateRestaurantTenant,
  updateUserAccount,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import { buildDefaultVariantAndSideGroups } from "@/lib/menuVariantsAndSides";
import {
  InventoryItem,
  LayoutStyle,
  MenuItem,
  Order,
  PortalTabId,
  RestaurantRole,
  ROLE_DEFINITIONS,
} from "@/lib/types";

export interface OwnerAssistantState {
  pendingIntent?:
    | "add_dish"
    | "change_dish_price"
    | "send_sms"
    | "add_customer"
    | "add_staff"
    | null;
  lastDishId?: string | null;
  lastOrderId?: string | null;
  lastIngredientId?: string | null;
}

export interface OwnerUiAction {
  type:
    | "switch_tab"
    | "open_add_menu_modal"
    | "open_edit_menu_modal"
    | "filter_orders"
    | "refresh_portal";
  tab?: PortalTabId;
  menuItemId?: string;
  orderStatusFilter?: "ALL" | Order["status"];
  orderDatePreset?:
    | "all"
    | "today"
    | "yesterday"
    | "tomorrow"
    | "last7"
    | "last30"
    | "this_month";
  prefillNewDish?: {
    name?: string;
    price?: string;
    category?: string;
    description?: string;
  };
}

function findDishByName(menuItems: MenuItem[], text: string): MenuItem | null {
  const lower = text.toLowerCase();
  const sorted = [...menuItems].sort((a, b) => b.name.length - a.name.length);
  for (const item of sorted) {
    if (lower.includes(item.name.toLowerCase())) {
      return item;
    }
  }
  let best: MenuItem | null = null;
  let bestScore = 0;
  for (const item of sorted) {
    const words = item.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !["with", "and", "the", "for", "dish", "item", "menu", "price"].includes(w)
      );
    let score = 0;
    for (const w of words) {
      if (lower.includes(w)) {
        score += w.length >= 5 ? 2 : 1;
      }
    }
    if (score > bestScore && score >= 1) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

function findIngredientByName(
  items: InventoryItem[],
  text: string
): InventoryItem | null {
  const lower = text.toLowerCase();
  const sorted = [...items].sort((a, b) => b.name.length - a.name.length);
  for (const ing of sorted) {
    if (lower.includes(ing.name.toLowerCase())) {
      return ing;
    }
  }
  for (const ing of sorted) {
    const words = ing.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 4 &&
          !["fresh", "stock", "item", "bags", "crates", "liters", "bottles"].includes(
            w
          )
      );
    if (words.some((w) => lower.includes(w))) {
      return ing;
    }
  }
  return null;
}

const COLOR_MAP: Record<string, string> = {
  red: "#dc2626",
  crimson: "#e11d48",
  rose: "#f43f5e",
  orange: "#ea580c",
  amber: "#d97706",
  gold: "#ca8a04",
  green: "#16a34a",
  emerald: "#059669",
  teal: "#0d9488",
  blue: "#2563eb",
  indigo: "#4f46e5",
  purple: "#9333ea",
  violet: "#7c3aed",
};

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
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const message: string = String(body.message || "").trim();
    const lower = message.toLowerCase();
    const prevState: OwnerAssistantState = body.state || {};
    const nextState: OwnerAssistantState = { ...prevState };

    const menuItems = listMenuItems(restaurant.id);
    const orders = listOrders(restaurant.id);
    const customers = listCustomers(restaurant.id);
    const campaigns = listEmailCampaigns(restaurant.id);
    const smsLogs = listSmsLogs(restaurant.id);
    const staff = listUsers({ scope: "restaurant", restaurantId: restaurant.id });
    const availability = evaluateRestaurantAvailability(restaurant, orders);
    const platformIntegrations = getPlatformIntegrationsConfig();

    const uiActions: OwnerUiAction[] = [];
    const executedTasks: string[] = [];
    let replyText = "";
    let quickReplies: string[] = [];

    const activeOrders = orders.filter(
      (o) => o.status !== "completed" && o.status !== "cancelled"
    );
    const confirmedOrders = orders.filter((o) => o.status === "confirmed");
    const preparingOrders = orders.filter((o) => o.status === "preparing");
    const readyOrders = orders.filter((o) => o.status === "ready");
    const completedOrders = orders.filter((o) => o.status === "completed");
    const cancelledOrders = orders.filter((o) => o.status === "cancelled");
    const soldOutDishes = menuItems.filter((m) => !m.available);
    const inventoryItems = restaurant.inventoryConfig?.items || [];
    const lowStockItems = inventoryItems.filter(
      (i) => i.currentStock <= i.reorderPoint
    );

    const resolveTargetDish = (): MenuItem | null => {
      const explicit = findDishByName(menuItems, message);
      if (explicit) return explicit;
      if (
        prevState.lastDishId &&
        /\b(it|this|that|the dish|the item)\b/i.test(lower)
      ) {
        return menuItems.find((m) => m.id === prevState.lastDishId) || null;
      }
      return null;
    };

    const resolveTargetOrder = (): Order | null => {
      const orderNumMatch = message.match(
        /(?:#|ord-|order\s+#?)([a-z0-9-]{3,12})/i
      );
      if (orderNumMatch) {
        const token = orderNumMatch[1].toLowerCase();
        const found = orders.find(
          (o) =>
            o.orderNumber.toLowerCase().includes(token) ||
            o.id.toLowerCase().includes(token)
        );
        if (found) return found;
      }
      if (/\b(latest|last|newest|most recent|first)\s+order\b/i.test(lower)) {
        return activeOrders[0] || orders[0] || null;
      }
      if (
        prevState.lastOrderId &&
        /\b(it|that order|this order)\b/i.test(lower)
      ) {
        return orders.find((o) => o.id === prevState.lastOrderId) || null;
      }
      return null;
    };

    // =========================================================================
    // 0. MULTI-TURN PENDING INTENT RESOLUTION (When owner replies with details)
    // =========================================================================
    if (
      prevState.pendingIntent === "add_dish" &&
      !/\b(cancel|nevermind|stop|order|stock|inventory|sms|email)\b/i.test(lower)
    ) {
      const namePriceMatch = message.match(
        /^["']?([a-zA-Z0-9\s&'()-]{2,45}?)["']?(?:\s+(?:for|at|-|:)?\s*\$?(\d+(?:\.\d{1,2})?))?$/i
      );
      if (namePriceMatch && namePriceMatch[1].trim().length >= 2) {
        const dishName = namePriceMatch[1]
          .replace(/^(?:add|create|new|dish|item|menu)\s+/i, "")
          .trim();
        const dishPrice = namePriceMatch[2]
          ? parseFloat(namePriceMatch[2])
          : 16.5;
        const defaultCategory = menuItems[0]?.category || "Signature Mains";
        const created = createMenuItem({
          restaurantId: restaurant.id,
          name: dishName,
          category: defaultCategory,
          price: dishPrice,
          prepTimeMinutes: 15,
          dailyStockLimit: 40,
          currentStockCount: 40,
          description: `Chef-crafted ${dishName}, prepared fresh to order at ${restaurant.name}.`,
          imageUrl:
            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
          dietaryTags: ["Chef Special", "Popular"],
          modifiers: buildDefaultVariantAndSideGroups(
            defaultCategory,
            restaurant.slug
          ),
          popular: true,
          available: true,
        });
        nextState.pendingIntent = null;
        nextState.lastDishId = created.id;
        executedTasks.push(
          `Added "${created.name}" ($${created.price.toFixed(2)}) to ${created.category}`
        );
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🍽️ Created **${created.name}** at **$${created.price.toFixed(
          2
        )}** in **${created.category}** with variants & sides!`;
        quickReplies = [
          `Edit ${created.name}`,
          `Change price of ${created.name} to $19.99`,
          "Add another dish",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    // =========================================================================
    // 1. PAUSE OR RESUME ONLINE ORDERING
    // =========================================================================
    if (
      /\b(pause ordering|stop ordering|close kitchen|turn off ordering|pause online orders|pause kitchen|disable ordering)\b/i.test(
        lower
      )
    ) {
      updateRestaurantTenant(restaurant.id, {
        orderingEnabled: false,
        pauseReason:
          "Kitchen temporarily paused incoming online orders via Owner AI Assistant.",
      });
      nextState.pendingIntent = null;
      executedTasks.push("Paused online ordering immediately");
      uiActions.push({ type: "refresh_portal" });
      replyText = `⏸️ **Online Ordering is now PAUSED** for **${restaurant.name}**. Customers visiting your storefront will see your pause notice until you resume.`;
      quickReplies = ["Resume online ordering", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(resume ordering|start ordering|open kitchen|turn on ordering|enable ordering|unpause ordering|resume online ordering)\b/i.test(
        lower
      )
    ) {
      updateRestaurantTenant(restaurant.id, {
        orderingEnabled: true,
        pauseReason: "",
      });
      nextState.pendingIntent = null;
      executedTasks.push("Resumed live online ordering");
      uiActions.push({ type: "refresh_portal" });
      replyText = `✅ **Online Ordering is now LIVE** for **${restaurant.name}**! Customers can place orders immediately.`;
      quickReplies = ["Check active orders", "Pause online ordering"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 2. ORDER MANAGEMENT (SINGLE ORDER, BULK ACTIONS, QUERIES & FILTERS)
    // =========================================================================
    // Bulk order status updates first so they don't get confused with single order
    if (
      /\b(start preparing all|prepare all confirmed|cook all confirmed|accept all orders|prepare all orders)\b/i.test(
        lower
      )
    ) {
      if (confirmedOrders.length === 0) {
        replyText = `You currently have **0 confirmed orders** waiting to start. Right now you have **${preparingOrders.length} preparing** and **${readyOrders.length} ready** order(s).`;
      } else {
        for (const ord of confirmedOrders) {
          updateOrderStatus(ord.id, "preparing");
        }
        executedTasks.push(
          `Moved ${confirmedOrders.length} confirmed order(s) to PREPARING`
        );
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🔥 Started preparing **${confirmedOrders.length} confirmed order(s)**: ${confirmedOrders
          .map((o) => `**#${o.orderNumber}** (${o.customerName})`)
          .join(", ")}.`;
      }
      quickReplies = [
        "Mark all preparing orders ready",
        "Complete all ready orders",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(mark all preparing orders ready|mark preparing ready|all orders ready|ready all preparing)\b/i.test(
        lower
      )
    ) {
      if (preparingOrders.length === 0) {
        replyText = `You have **0 preparing orders** right now (${confirmedOrders.length} confirmed, ${readyOrders.length} ready).`;
      } else {
        for (const ord of preparingOrders) {
          updateOrderStatus(ord.id, "ready");
        }
        executedTasks.push(
          `Marked ${preparingOrders.length} preparing order(s) as READY`
        );
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `✅ Marked **${preparingOrders.length} order(s)** as **READY** for pickup/delivery: ${preparingOrders
          .map((o) => `**#${o.orderNumber}** (${o.customerName})`)
          .join(", ")}.`;
      }
      quickReplies = ["Complete all ready orders", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(complete all ready|finish all ready|clear ready orders|complete all orders)\b/i.test(
        lower
      )
    ) {
      const targets =
        readyOrders.length > 0
          ? readyOrders
          : /\b(complete all orders)\b/i.test(lower)
          ? activeOrders
          : [];
      if (targets.length === 0) {
        replyText = `There are currently **0 ready orders** waiting to be completed.`;
      } else {
        for (const ord of targets) {
          updateOrderStatus(ord.id, "completed");
        }
        executedTasks.push(`Completed ${targets.length} order(s)`);
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🎉 Marked **${targets.length} order(s)** (${targets
          .map((o) => `#${o.orderNumber}`)
          .join(", ")}) as **COMPLETED**!`;
      }
      quickReplies = ["Check active orders", "Show today's orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Single specific order status update (by #number, "latest order", or "it")
    const targetOrder = resolveTargetOrder();
    if (
      targetOrder &&
      /\b(confirm|prepare|preparing|cook|ready|complete|completed|cancel|cancelled)\b/i.test(
        lower
      ) &&
      !/\b(show|filter|list|how many|check)\b/i.test(lower)
    ) {
      let nextStatus: Order["status"] = targetOrder.status;
      if (/\b(prepare|preparing|cook|start)\b/i.test(lower))
        nextStatus = "preparing";
      else if (/\b(ready)\b/i.test(lower)) nextStatus = "ready";
      else if (/\b(complete|completed|done|finish)\b/i.test(lower))
        nextStatus = "completed";
      else if (/\b(cancel|cancelled)\b/i.test(lower))
        nextStatus = "cancelled";
      else if (/\b(confirm|confirmed)\b/i.test(lower))
        nextStatus = "confirmed";

      updateOrderStatus(targetOrder.id, nextStatus);
      nextState.lastOrderId = targetOrder.id;
      executedTasks.push(
        `Order #${targetOrder.orderNumber} (${targetOrder.customerName}) → ${nextStatus.toUpperCase()}`
      );
      uiActions.push({ type: "switch_tab", tab: "orders" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `✅ Updated **Order #${targetOrder.orderNumber}** (${targetOrder.customerName} • $${targetOrder.total.toFixed(
        2
      )}) to **${nextStatus.toUpperCase()}**.`;
      quickReplies = [
        ...(nextStatus === "confirmed"
          ? [`Start preparing order #${targetOrder.orderNumber}`]
          : []),
        ...(nextStatus === "preparing"
          ? [`Mark order #${targetOrder.orderNumber} ready`]
          : []),
        ...(nextStatus === "ready"
          ? [`Complete order #${targetOrder.orderNumber}`]
          : []),
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Specific Order Details Lookup (when user asks about a specific order # or "latest order")
    if (
      targetOrder &&
      /\b(order|details|what is|who|status|check|show)\b/i.test(lower)
    ) {
      nextState.lastOrderId = targetOrder.id;
      uiActions.push({ type: "switch_tab", tab: "orders" });
      const itemsList = targetOrder.items
        .map((i) => `${i.quantity}× ${i.name}`)
        .join(", ");
      replyText =
        `🧾 **Order #${targetOrder.orderNumber}** (${targetOrder.status.toUpperCase()}):\n` +
        `- **Customer**: ${targetOrder.customerName} (${targetOrder.customerPhone})\n` +
        `- **Type**: ${targetOrder.orderType.toUpperCase()} • **Total**: **$${targetOrder.total.toFixed(2)}** (${targetOrder.paymentMethod.toUpperCase()})\n` +
        `- **Items**: ${itemsList}`;
      quickReplies = [
        `Start preparing order #${targetOrder.orderNumber}`,
        `Mark order #${targetOrder.orderNumber} ready`,
        `Complete order #${targetOrder.orderNumber}`,
        `Cancel order #${targetOrder.orderNumber}`,
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Filter Orders by Date or Status
    if (
      /\b(today's orders|orders today|filter today|show today|yesterday's orders|last 7 days|last 30 days|this month orders)\b/i.test(
        lower
      )
    ) {
      let preset: OwnerUiAction["orderDatePreset"] = "today";
      let label = "Today";
      if (lower.includes("yesterday")) {
        preset = "yesterday";
        label = "Yesterday";
      } else if (lower.includes("7")) {
        preset = "last7";
        label = "Last 7 Days";
      } else if (lower.includes("30")) {
        preset = "last30";
        label = "Last 30 Days";
      } else if (lower.includes("month")) {
        preset = "this_month";
        label = "This Month";
      }
      uiActions.push({ type: "switch_tab", tab: "orders" });
      uiActions.push({
        type: "filter_orders",
        orderDatePreset: preset,
        orderStatusFilter: "ALL",
      });
      executedTasks.push(`Filtered orders to ${label}`);
      replyText = `📅 Switched to **1. Customer Orders** and set the Date Filter to **${label}**.`;
      quickReplies = [
        "Show all orders",
        "Start preparing all confirmed orders",
        "Mark all preparing orders ready",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Check / Show Active Orders or Filter by Status ("check active orders", "showall active orders", "how many orders", "pending orders")
    if (
      /\b(check active orders|show all active orders|active orders|pending orders|show orders|show all orders|what orders|how many orders|kitchen queue|confirmed orders|preparing orders|ready orders|completed orders|cancelled orders)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "orders" });
      let statusFilter: "ALL" | Order["status"] = "ALL";
      let listToShow = activeOrders;
      let heading = `Active Kitchen Orders (${activeOrders.length})`;

      if (/\b(confirmed)\b/i.test(lower)) {
        statusFilter = "confirmed";
        listToShow = confirmedOrders;
        heading = `Confirmed Orders (${confirmedOrders.length})`;
      } else if (/\b(preparing)\b/i.test(lower)) {
        statusFilter = "preparing";
        listToShow = preparingOrders;
        heading = `Preparing Orders (${preparingOrders.length})`;
      } else if (/\b(ready)\b/i.test(lower)) {
        statusFilter = "ready";
        listToShow = readyOrders;
        heading = `Ready Orders (${readyOrders.length})`;
      } else if (/\b(completed)\b/i.test(lower)) {
        statusFilter = "completed";
        listToShow = completedOrders;
        heading = `Completed Orders (${completedOrders.length})`;
      } else if (/\b(cancelled)\b/i.test(lower)) {
        statusFilter = "cancelled";
        listToShow = cancelledOrders;
        heading = `Cancelled Orders (${cancelledOrders.length})`;
      } else if (/\b(show all orders)\b/i.test(lower)) {
        listToShow = orders;
        heading = `All Orders (${orders.length})`;
      }

      uiActions.push({
        type: "filter_orders",
        orderDatePreset: "all",
        orderStatusFilter: statusFilter,
      });

      if (listToShow.length === 0) {
        replyText = `📋 **${heading}**: There are currently **0 orders** in this state.`;
      } else {
        nextState.lastOrderId = listToShow[0].id;
        const lines = listToShow.slice(0, 6).map(
          (o) =>
            `- **#${o.orderNumber}** (${o.customerName}) — **${o.status.toUpperCase()}** • ${o.orderType.toUpperCase()} • **$${o.total.toFixed(
              2
            )}** (${o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")})`
        );
        replyText = `📋 **${heading}**:\n${lines.join("\n")}${
          listToShow.length > 6
            ? `\n*...and ${listToShow.length - 6} more order(s) on your screen.*`
            : ""
        }`;
      }

      quickReplies = [
        ...(confirmedOrders.length > 0
          ? ["Start preparing all confirmed orders"]
          : []),
        ...(preparingOrders.length > 0
          ? ["Mark all preparing orders ready"]
          : []),
        ...(readyOrders.length > 0 ? ["Complete all ready orders"] : []),
        ...(listToShow[0]
          ? [`Mark order #${listToShow[0].orderNumber} ready`]
          : []),
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 3. MENU MANAGEMENT (ADD, DELETE, 86, RESTORE, PRICE, STOCK, PREP, QUERY)
    // =========================================================================
    if (
      /\b(make all dishes available|restore all sold out|un-86 all|make everything available|enable all dishes|restore sold-out)\b/i.test(
        lower
      )
    ) {
      if (soldOutDishes.length === 0) {
        replyText = `✅ All **${menuItems.length} dishes** on your menu are already **AVAILABLE**!`;
      } else {
        for (const item of soldOutDishes) {
          updateMenuItem(item.id, {
            available: true,
            unavailableReason: "",
          });
        }
        executedTasks.push(
          `Restored ${soldOutDishes.length} sold-out dish(es) back to AVAILABLE`
        );
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `✅ Restored **${soldOutDishes.length} dish(es)** (${soldOutDishes
          .map((d) => d.name)
          .join(", ")}) back to **AVAILABLE** on your storefront and synced with POS!`;
      }
      quickReplies = ["Show menu overview", "Open Add Menu modal"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Delete / Remove a dish from menu
    if (
      /\b(delete|remove)\b/i.test(lower) &&
      !/\b(staff|team|customer|blackout|order)\b/i.test(lower)
    ) {
      const dish = resolveTargetDish();
      if (dish) {
        deleteMenuItem(dish.id);
        nextState.lastDishId = null;
        executedTasks.push(`Deleted "${dish.name}" from the menu`);
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🗑️ Removed **${dish.name}** from **${restaurant.name}**'s menu.`;
        quickReplies = ["Show menu overview", "Open Add Menu modal"];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    // 86 / Mark dish Sold-Out
    if (
      /\b(86|sold out|sold-out|mark .* unavailable|disable .*|turn off .*|out of stock)\b/i.test(
        lower
      ) &&
      !/\b(show|which|list|what|how many|delivery|pickup|dine-in|ordering|doordash|square|clover|vapi|stripe|paypal)\b/i.test(
        lower
      )
    ) {
      const dish = resolveTargetDish();
      if (dish) {
        updateMenuItem(dish.id, {
          available: false,
          unavailableReason: "Temporarily sold out for today",
        });
        nextState.lastDishId = dish.id;
        executedTasks.push(`Marked "${dish.name}" as SOLD OUT (86'd)`);
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🚫 Marked **${dish.name}** as **SOLD OUT (86'd)** on your live storefront and synced with Square/Clover POS.`;
        quickReplies = [
          `Make ${dish.name} available`,
          "Make all dishes available",
          "Show sold-out dishes",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    // Make specific dish available
    if (
      /\b(make .* available|restore .*|enable .*|un-86 .*|back in stock)\b/i.test(
        lower
      ) &&
      !/\b(pickup|delivery|dine-in|ordering|doordash|square|clover|vapi|stripe|paypal)\b/i.test(
        lower
      )
    ) {
      const dish = resolveTargetDish();
      if (dish) {
        updateMenuItem(dish.id, {
          available: true,
          unavailableReason: "",
        });
        nextState.lastDishId = dish.id;
        executedTasks.push(`Marked "${dish.name}" as AVAILABLE`);
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `✅ **${dish.name}** is now **AVAILABLE** on your live storefront!`;
        quickReplies = [
          `Edit ${dish.name}`,
          `Mark ${dish.name} sold out`,
          "Show menu overview",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    // Update Dish Price (flexible phrasing: "change price of X to $20", "make X $20", "set X price 20")
    const dishForUpdate = resolveTargetDish();
    const dollarMatch = message.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
    const priceKeywordMatch = message.match(
      /(?:price|cost|make it|set to|change to)\s*(?:to|at|of)?\s*\$?(\d+(?:\.\d{1,2})?)/i
    );
    if (
      dishForUpdate &&
      (dollarMatch || priceKeywordMatch) &&
      !/\b(add|create|new|delivery fee|minimum|tax)\b/i.test(lower)
    ) {
      const rawNum = dollarMatch ? dollarMatch[1] : priceKeywordMatch![1];
      const newPrice = parseFloat(rawNum);
      if (!isNaN(newPrice) && newPrice > 0) {
        const oldPrice = dishForUpdate.price;
        updateMenuItem(dishForUpdate.id, { price: newPrice });
        nextState.lastDishId = dishForUpdate.id;
        nextState.pendingIntent = null;
        executedTasks.push(
          `Updated "${dishForUpdate.name}" price: $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)}`
        );
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `💲 Updated **${dishForUpdate.name}** from **$${oldPrice.toFixed(
          2
        )}** to **$${newPrice.toFixed(2)}** on your live menu!`;
        quickReplies = [
          `Edit ${dishForUpdate.name}`,
          `Mark ${dishForUpdate.name} sold out`,
          "Show menu overview",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    // Update Dish Stock Count ("set stock of Margherita to 30")
    const dishStockMatch = message.match(
      /(?:stock|limit|count).*?(\d+)/i
    );
    if (dishForUpdate && dishStockMatch && /\b(stock|daily limit)\b/i.test(lower)) {
      const count = parseInt(dishStockMatch[1], 10);
      updateMenuItem(dishForUpdate.id, {
        dailyStockLimit: count,
        currentStockCount: count,
        available: count > 0,
      });
      nextState.lastDishId = dishForUpdate.id;
      executedTasks.push(
        `Set daily stock of "${dishForUpdate.name}" to ${count} portions`
      );
      uiActions.push({ type: "switch_tab", tab: "menu" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `📊 Updated **${dishForUpdate.name}** daily stock count to **${count} portions**!`;
      quickReplies = [`Edit ${dishForUpdate.name}`, "Show menu overview"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Create / Add a New Dish (flexible phrasings: "add new dish X for $18", "add Jollof Rice $18.50", "add Suya Skewers to menu")
    const addDishFlexibleMatch = message.match(
      /(?:add|create|put)\s+(?:a\s+)?(?:new\s+)?(?:dish|item|menu item|food)?\s*(?:called\s+|named\s+)?["']?([a-zA-Z0-9\s&'()-]{2,40}?)["']?\s+(?:for\s+|at\s+|price\s+|\$)(\d+(?:\.\d{1,2})?)/i
    );
    if (
      addDishFlexibleMatch &&
      !/\b(customer|staff|inventory|stock|blackout|order)\b/i.test(lower)
    ) {
      const dishName = addDishFlexibleMatch[1]
        .replace(/^(?:called|named|dish|item|menu)\s+/i, "")
        .trim();
      const dishPrice = parseFloat(addDishFlexibleMatch[2]);
      if (dishName.length >= 2 && !isNaN(dishPrice)) {
        const defaultCategory = menuItems[0]?.category || "Signature Mains";
        const created = createMenuItem({
          restaurantId: restaurant.id,
          name: dishName,
          category: defaultCategory,
          price: dishPrice,
          prepTimeMinutes: 15,
          dailyStockLimit: 40,
          currentStockCount: 40,
          description: `Chef-crafted ${dishName}, prepared fresh to order at ${restaurant.name}.`,
          imageUrl:
            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
          dietaryTags: ["Chef Special", "Popular"],
          modifiers: buildDefaultVariantAndSideGroups(
            defaultCategory,
            restaurant.slug
          ),
          popular: true,
          available: true,
        });
        nextState.lastDishId = created.id;
        nextState.pendingIntent = null;
        executedTasks.push(
          `Added new dish "${created.name}" ($${created.price.toFixed(2)}) to ${created.category}`
        );
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🍽️ Added **${created.name}** (**$${created.price.toFixed(
          2
        )}**) to **${created.category}** with default variants & sides!`;
        quickReplies = [
          `Edit ${created.name}`,
          `Mark ${created.name} sold out`,
          "Open Add Menu modal",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    // Open Add Menu Modal (or "add another dish", "add dish", "add menu")
    if (
      /\b(open add menu|add a dish|add another dish|add menu item|new menu item|add new dish|create menu item|add menu|add dish|create dish)\b/i.test(
        lower
      )
    ) {
      nextState.pendingIntent = "add_dish";
      uiActions.push({ type: "switch_tab", tab: "menu" });
      uiActions.push({ type: "open_add_menu_modal" });
      executedTasks.push("Opened + Add Menu modal");
      replyText = `🍽️ I've opened the **+ Add Menu** popup modal on your screen! Or simply reply here with the **dish name and price** (for example: \`Smoky Jollof & Suya $18.50\`) and I'll create it immediately.`;
      quickReplies = [
        "Smoky Jollof & Suya $18.50",
        "Grilled Prawns & Plantain $22.00",
        "Show menu overview",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Edit a Dish Modal
    if (/\b(edit|modify|customize)\b/i.test(lower) && dishForUpdate) {
      nextState.lastDishId = dishForUpdate.id;
      uiActions.push({ type: "switch_tab", tab: "menu" });
      uiActions.push({
        type: "open_edit_menu_modal",
        menuItemId: dishForUpdate.id,
      });
      executedTasks.push(`Opened Edit modal for "${dishForUpdate.name}"`);
      replyText = `✏️ Opened the **Edit Dish** modal for **${dishForUpdate.name}** ($${dishForUpdate.price.toFixed(
        2
      )}).`;
      quickReplies = [
        `Change price of ${dishForUpdate.name} to $${(dishForUpdate.price + 2).toFixed(2)}`,
        dishForUpdate.available
          ? `Mark ${dishForUpdate.name} sold out`
          : `Make ${dishForUpdate.name} available`,
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Show Sold-Out Dishes
    if (/\b(sold-out|sold out|unavailable dishes|what is 86)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "menu" });
      if (soldOutDishes.length === 0) {
        replyText = `✅ You have **0 sold-out dishes** — all **${menuItems.length} dishes** on your menu are currently **AVAILABLE**!`;
      } else {
        replyText = `🚫 **Sold-Out (86'd) Dishes (${soldOutDishes.length})**:\n${soldOutDishes
          .map((d) => `- **${d.name}** ($${d.price.toFixed(2)}) — ${d.category}`)
          .join("\n")}`;
      }
      quickReplies = [
        ...(soldOutDishes.length > 0 ? ["Make all dishes available"] : []),
        "Show menu overview",
        "Open Add Menu modal",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Show Menu Overview / List Dishes
    if (
      /\b(show menu|menu overview|list dishes|what's on the menu|what is on my menu|my menu|food menu)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "menu" });
      const categories = Array.from(new Set(menuItems.map((m) => m.category)));
      const catBreakdown = categories
        .map((cat) => {
          const items = menuItems.filter((m) => m.category === cat);
          return `- **${cat}** (${items.length}): ${items
            .map(
              (i) =>
                `${i.name} ($${i.price.toFixed(2)}${
                  !i.available ? " • 🚫 86'd" : ""
                })`
            )
            .join(", ")}`;
        })
        .join("\n");
      replyText = `🍽️ **${restaurant.name} Menu (${menuItems.length} Dishes across ${categories.length} Categories)**:\n${catBreakdown}`;
      quickReplies = [
        "Open Add Menu modal",
        ...(soldOutDishes.length > 0
          ? ["Make all dishes available"]
          : [`Mark ${menuItems[0]?.name || "first dish"} sold out`]),
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 4. INVENTORY & STOCK MANAGEMENT (SPECIFIC INGREDIENT OR BULK RESTOCK)
    // =========================================================================
    const matchedIng = findIngredientByName(inventoryItems, message);
    if (
      matchedIng &&
      /\b(restock|refill|add|set|update|stock)\b/i.test(lower)
    ) {
      const qtyMatch = message.match(/\b(\d+)\b/);
      const isAdd = /\b(add|plus)\b/i.test(lower);
      const nextStock = qtyMatch
        ? isAdd
          ? matchedIng.currentStock + parseInt(qtyMatch[1], 10)
          : parseInt(qtyMatch[1], 10)
        : Math.max(matchedIng.parLevel, matchedIng.reorderPoint * 3, 25);

      const updatedItems = inventoryItems.map((i) =>
        i.id === matchedIng.id
          ? {
              ...i,
              currentStock: nextStock,
              lastRestockedAt: new Date().toISOString(),
            }
          : i
      );
      if (restaurant.inventoryConfig) {
        updateRestaurantTenant(restaurant.id, {
          inventoryConfig: {
            ...restaurant.inventoryConfig,
            items: updatedItems,
          },
        });
      }
      nextState.lastIngredientId = matchedIng.id;
      executedTasks.push(
        `Updated "${matchedIng.name}" stock: ${matchedIng.currentStock} → ${nextStock} ${matchedIng.unit}`
      );
      uiActions.push({ type: "switch_tab", tab: "inventory" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `📦 Updated **${matchedIng.name}** stock from **${matchedIng.currentStock} ${matchedIng.unit}** to **${nextStock} ${matchedIng.unit}**!`;
      quickReplies = ["Check inventory & profit", "Restock all low stock items"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(restock all|refill all|restock low|replenish stock|restock inventory)\b/i.test(
        lower
      )
    ) {
      if (!restaurant.inventoryConfig || lowStockItems.length === 0) {
        uiActions.push({ type: "switch_tab", tab: "inventory" });
        replyText = `✅ All **${inventoryItems.length} inventory items** are already stocked above their reorder points!`;
      } else {
        const updatedItems = inventoryItems.map((item) => {
          if (item.currentStock <= item.reorderPoint) {
            return {
              ...item,
              currentStock: Math.max(item.parLevel, item.reorderPoint * 3, 25),
              lastRestockedAt: new Date().toISOString(),
            };
          }
          return item;
        });
        updateRestaurantTenant(restaurant.id, {
          inventoryConfig: {
            ...restaurant.inventoryConfig,
            items: updatedItems,
          },
        });
        executedTasks.push(
          `Restocked ${lowStockItems.length} low-stock ingredient(s) to full par levels`
        );
        uiActions.push({ type: "switch_tab", tab: "inventory" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `📦 Restocked **${lowStockItems.length} low-stock ingredient(s)** (${lowStockItems
          .map((i) => i.name)
          .join(", ")}) back to full par levels!`;
      }
      quickReplies = ["Check inventory & profit", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(low stock|inventory|kitchen stock|stock level|profit margin|food cost|ingredients)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "inventory" });
      const totalStockValue = inventoryItems.reduce(
        (s, i) => s + i.currentStock * i.unitCost,
        0
      );
      const lowList =
        lowStockItems.length > 0
          ? lowStockItems
              .map(
                (i) =>
                  `- ⚠️ **${i.name}**: **${i.currentStock} ${i.unit}** left (Reorder alert at ${i.reorderPoint} ${i.unit})`
              )
              .join("\n")
          : `- ✅ All **${inventoryItems.length} ingredients** are above their low-stock alert threshold.`;
      replyText =
        `📦 **Kitchen Stock & Profit Summary**:\n` +
        `- **Tracked Ingredients**: ${inventoryItems.length} cards • **Stock Value**: **$${totalStockValue.toFixed(2)}**\n` +
        `${lowList}`;
      quickReplies = [
        ...(lowStockItems.length > 0 ? ["Restock all low stock items"] : []),
        ...(inventoryItems[0] ? [`Restock ${inventoryItems[0].name}`] : []),
        "Show menu overview",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 5. HOURS, SCHEDULE, PREP TIME, ORDER LIMITS & FULFILLMENT TOGGLES
    // =========================================================================
    const prepTimeMatch = message.match(
      /(?:prep time|preparation time).*?(\d+)\s*(?:min|minute|m\b)?/i
    );
    if (prepTimeMatch) {
      const mins = Math.max(5, Math.min(180, parseInt(prepTimeMatch[1], 10)));
      updateRestaurantTenant(restaurant.id, { prepTimeMinutes: mins });
      executedTasks.push(`Set kitchen prep time to ${mins} minutes`);
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `⏱️ Updated **${restaurant.name}**'s estimated prep time to **${mins} minutes**!`;
      quickReplies = ["Set max orders per hour to 25", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    const maxHourMatch = message.match(
      /(?:max orders per hour|hourly limit|orders per hour).*?(\d+)/i
    );
    if (maxHourMatch) {
      const cap = Math.max(1, Math.min(500, parseInt(maxHourMatch[1], 10)));
      updateRestaurantTenant(restaurant.id, { maxOrdersPerHour: cap });
      executedTasks.push(`Set max orders per hour to ${cap}`);
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🚦 Updated **Max Orders Per Hour** to **${cap} orders/hr**!`;
      quickReplies = ["Set prep time to 20 minutes", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    const minOrderMatch = message.match(
      /(?:minimum order|min order).*?\$?(\d+(?:\.\d{1,2})?)/i
    );
    if (minOrderMatch) {
      const minAmt = parseFloat(minOrderMatch[1]);
      updateRestaurantTenant(restaurant.id, { minOrderAmount: minAmt });
      executedTasks.push(`Set minimum order amount to $${minAmt.toFixed(2)}`);
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `💵 Updated **Minimum Order Amount** to **$${minAmt.toFixed(2)}**!`;
      quickReplies = ["Set delivery fee to $4.99", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Open / Close specific day of week ("close on Sunday", "open on Monday")
    const dayMatch = message.match(
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
    );
    if (dayMatch && /\b(close|open|hours|schedule)\b/i.test(lower)) {
      const targetDay =
        dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase();
      const timeRangeMatch = message.match(
        /(\d{1,2}:\d{2})\s*(?:to|-|until)\s*(\d{1,2}:\d{2})/i
      );
      const isClose = /\b(close|closed|turn off|disable)\b/i.test(lower);
      const nextSchedule = restaurant.weeklySchedule.map((d) => {
        if (d.day.toLowerCase() !== targetDay.toLowerCase()) return d;
        if (timeRangeMatch) {
          return {
            ...d,
            enabled: true,
            openTime: timeRangeMatch[1].padStart(5, "0"),
            closeTime: timeRangeMatch[2].padStart(5, "0"),
          };
        }
        return { ...d, enabled: !isClose };
      });
      updateRestaurantTenant(restaurant.id, { weeklySchedule: nextSchedule });
      const desc = timeRangeMatch
        ? `Set ${targetDay} hours to ${timeRangeMatch[1]} – ${timeRangeMatch[2]}`
        : `${isClose ? "Closed" : "Opened"} restaurant on ${targetDay}s`;
      executedTasks.push(desc);
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🗓️ **${desc}** on your weekly schedule!`;
      quickReplies = ["What are our hours?", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(what are our hours|show hours|opening hours|weekly schedule)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "limits" });
      const schedLines = restaurant.weeklySchedule
        .map(
          (d) =>
            `- **${d.day}**: ${
              d.enabled ? `${d.openTime} – ${d.closeTime}` : "🚫 Closed"
            }`
        )
        .join("\n");
      replyText = `🕒 **${restaurant.name} Weekly Operating Hours**:\n${schedLines}`;
      quickReplies = [
        "Set prep time to 25 minutes",
        "Close on Sunday",
        "Open on Sunday",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Fulfillment & Feature toggles
    if (
      /\b(enable|turn on|disable|turn off)\s+(pickup|delivery|dine-in|dine in|reservations|table reservations|loyalty|loyalty program|tipping|promo codes)\b/i.test(
        lower
      )
    ) {
      const isEnable = /\b(enable|turn on)\b/i.test(lower);
      const nextFeatures = { ...restaurant.features };
      let label = "";
      if (lower.includes("delivery")) {
        nextFeatures.delivery = isEnable;
        label = "Delivery";
      } else if (lower.includes("pickup")) {
        nextFeatures.pickup = isEnable;
        label = "Pickup";
      } else if (lower.includes("dine")) {
        nextFeatures.dineInQr = isEnable;
        label = "Dine-In QR";
      } else if (lower.includes("reservation")) {
        nextFeatures.tableReservations = isEnable;
        label = "Table Reservations";
      } else if (lower.includes("loyalty")) {
        nextFeatures.loyaltyProgram = isEnable;
        label = "VIP Loyalty Program";
      } else if (lower.includes("tipping")) {
        nextFeatures.tipping = isEnable;
        label = "Customer Tipping";
      } else if (lower.includes("promo")) {
        nextFeatures.promoCodes = isEnable;
        label = "Promo Codes";
      }
      updateRestaurantTenant(restaurant.id, { features: nextFeatures });
      executedTasks.push(
        `${isEnable ? "Enabled" : "Disabled"} ${label}`
      );
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `✅ **${label}** is now **${
        isEnable ? "ENABLED" : "DISABLED"
      }** for **${restaurant.name}**.`;
      quickReplies = ["What are our hours?", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 6. PAYMENTS, TAX, DELIVERY FEE & FREE DELIVERY THRESHOLD
    // =========================================================================
    const delivFeeMatch = message.match(
      /(?:delivery fee).*?\$?(\d+(?:\.\d{1,2})?)/i
    );
    if (delivFeeMatch) {
      const fee = parseFloat(delivFeeMatch[1]);
      updateRestaurantTenant(restaurant.id, {
        paymentConfig: {
          ...restaurant.paymentConfig,
          deliveryFee: fee,
        },
      });
      executedTasks.push(`Updated delivery fee to $${fee.toFixed(2)}`);
      uiActions.push({ type: "switch_tab", tab: "payments" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🛵 Updated your **Delivery Fee** to **$${fee.toFixed(2)}**!`;
      quickReplies = [
        "Set free delivery minimum to $45",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    const freeDelivMatch = message.match(
      /(?:free delivery).*?\$?(\d+(?:\.\d{1,2})?)/i
    );
    if (freeDelivMatch) {
      const minFree = parseFloat(freeDelivMatch[1]);
      updateRestaurantTenant(restaurant.id, {
        paymentConfig: {
          ...restaurant.paymentConfig,
          freeDeliveryMin: minFree,
        },
      });
      executedTasks.push(
        `Updated free delivery threshold to $${minFree.toFixed(2)}`
      );
      uiActions.push({ type: "switch_tab", tab: "payments" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🎁 Updated **Free Delivery Minimum** to **$${minFree.toFixed(
        2
      )}**!`;
      quickReplies = ["Set delivery fee to $4.99", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    const taxRateMatch = message.match(
      /(?:tax rate|sales tax).*?(\d+(?:\.\d{1,2})?)\s*%?/i
    );
    if (taxRateMatch) {
      const rate = parseFloat(taxRateMatch[1]);
      updateRestaurantTenant(restaurant.id, {
        paymentConfig: {
          ...restaurant.paymentConfig,
          taxRatePercent: rate,
        },
      });
      executedTasks.push(`Updated tax rate to ${rate}%`);
      uiActions.push({ type: "switch_tab", tab: "payments" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🧾 Updated **Sales Tax Rate** to **${rate}%**!`;
      quickReplies = ["Set delivery fee to $4.99", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(payment|stripe|paypal|receive money|tax rate)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "payments" });
      replyText =
        `💳 **Payment & Checkout Settings**:\n` +
        `- **Stripe**: ${restaurant.paymentConfig.stripe.enabled ? "✅ Enabled" : "🚫 Disabled"}\n` +
        `- **PayPal**: ${restaurant.paymentConfig.paypal.enabled ? "✅ Enabled" : "🚫 Disabled"}\n` +
        `- **Tax Rate**: ${restaurant.paymentConfig.taxRatePercent}% • **Delivery Fee**: $${restaurant.paymentConfig.deliveryFee.toFixed(2)} (Free over $${restaurant.paymentConfig.freeDeliveryMin})`;
      quickReplies = [
        "Set delivery fee to $3.99",
        "Set free delivery minimum to $40",
        "Set tax rate to 8.5%",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 7. SMS BROADCAST & PROMO EMAIL CAMPAIGNS
    // =========================================================================
    if (/\b(send sms|broadcast sms|text customers|sms blast)\b/i.test(lower)) {
      const customTextMatch = message.match(/:\s*(.+)$/);
      const smsBody = customTextMatch
        ? customTextMatch[1].trim()
        : `🔥 Special tonight at ${restaurant.name}! Order directly online for fresh chef specials and fast pickup or delivery.`;
      const optedIn = customers.filter((c) => c.smsOptIn);
      const targets = optedIn.length > 0 ? optedIn : customers.slice(0, 3);
      for (const cust of targets) {
        createSmsLog({
          restaurantId: restaurant.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          triggerType: "broadcast",
          message: smsBody,
          provider: "twilio_simulated",
        });
      }
      executedTasks.push(`Sent SMS broadcast to ${targets.length} customer(s)`);
      uiActions.push({ type: "switch_tab", tab: "sms" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `📲 Dispatched **SMS Broadcast** to **${targets.length} opted-in customer(s)**!\n\n> *"${smsBody}"*`;
      quickReplies = [
        "Show SMS logs",
        "Send 20% off weekend promo email",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(sms log|recent sms|text alerts)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "sms" });
      replyText = `📲 **Phone Text Alerts (SMS)**: **${smsLogs.length} message(s)** sent. Latest: ${
        smsLogs[0]
          ? `to **${smsLogs[0].customerName}** (${smsLogs[0].customerPhone}) — *"${smsLogs[0].message}"*`
          : "No SMS sent yet."
      }`;
      quickReplies = [
        "Send SMS broadcast: Flash special tonight 15% off!",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(send .* email|launch .* email|email campaign|promo email)\b/i.test(
        lower
      ) &&
      !/\b(show|list)\b/i.test(lower)
    ) {
      const discountMatch = message.match(/(\d+)\s*%/);
      const discount = discountMatch ? parseInt(discountMatch[1], 10) : 20;
      const code = `VIP${discount}`;
      const camp = createEmailCampaign({
        restaurantId: restaurant.id,
        name: `AI Assistant ${discount}% Off Promo Blast`,
        subject: `🍽️ Enjoy ${discount}% Off Your Next Order at ${restaurant.name}!`,
        segment: "all",
        promoCode: code,
        discountPercent: discount,
        bodyHtml: `<p>Order directly from <strong>${restaurant.name}</strong> and use promo code <strong>${code}</strong> at checkout for <strong>${discount}% off</strong>!</p>`,
      });
      executedTasks.push(
        `Launched "${camp.name}" (${code}) to ${camp.recipientCount} customers`
      );
      uiActions.push({ type: "switch_tab", tab: "email" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `📧 Launched **${camp.name}** with promo code **${code}** (${discount}% off) to **${camp.recipientCount} customers**!`;
      quickReplies = [
        "Show email campaigns",
        "Send SMS broadcast: Flash sale tonight 15% off!",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(show email campaigns|list email|campaigns)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "email" });
      replyText = `📧 **Email Campaigns (${campaigns.length})**:\n${
        campaigns.length > 0
          ? campaigns
              .slice(0, 5)
              .map(
                (c) =>
                  `- **${c.name}** (Code: \`${c.promoCode || "N/A"}\` • ${c.recipientCount} recipients • $${c.revenueGenerated.toFixed(2)} revenue)`
              )
              .join("\n")
          : "No email campaigns sent yet."
      }`;
      quickReplies = ["Send 20% off weekend promo email", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 8. CUSTOMERS & STAFF TEAM MANAGEMENT
    // =========================================================================
    const addCustomerMatch = message.match(
      /add\s+(?:vip\s+)?customer\s+([a-zA-Z\s]+?)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );
    if (addCustomerMatch) {
      const custName = addCustomerMatch[1].trim();
      const custEmail = addCustomerMatch[2].trim();
      const created = createCustomerManual({
        restaurantId: restaurant.id,
        name: custName,
        email: custEmail,
        phone: "+1 (555) 019-9942",
        vipStatus: true,
        notes: "Added via Owner AI Assistant",
        tags: ["VIP", "AI Added"],
      });
      executedTasks.push(`Added VIP customer ${created.name} (${created.email})`);
      uiActions.push({ type: "switch_tab", tab: "customers" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `👤 Added VIP Customer **${created.name}** (${created.email}) to your Customer CRM with +50 loyalty points!`;
      quickReplies = ["Show VIP customers", "Send SMS broadcast"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(vip|customer|customers|crm|top customer)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "customers" });
      const sortedCust = [...customers].sort(
        (a, b) => b.totalSpent - a.totalSpent
      );
      const topList = sortedCust
        .slice(0, 5)
        .map(
          (c) =>
            `- **${c.name}** (${c.email}) — **$${c.totalSpent.toFixed(2)}** spent • ${c.totalOrders} orders${
              c.vipStatus ? " • ⭐ VIP" : ""
            }`
        )
        .join("\n");
      replyText = `👥 **Customer CRM (${customers.length} Total Customers)**:\n${topList}`;
      quickReplies = [
        "Add VIP customer Amaka Okafor amaka@example.com",
        "Send SMS broadcast",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    const addStaffMatch = message.match(
      /add\s+staff\s+(?:member\s+)?([a-zA-Z\s]+?)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );
    if (addStaffMatch) {
      const sName = addStaffMatch[1].trim();
      const sEmail = addStaffMatch[2].trim();
      let role: RestaurantRole = "general_manager";
      if (/\b(chef|kitchen)\b/i.test(lower)) role = "kitchen_chef";
      else if (/\b(cashier|host)\b/i.test(lower)) role = "cashier_host";
      else if (/\b(marketing)\b/i.test(lower)) role = "marketing_manager";

      const created = createUserAccount({
        scope: "restaurant",
        restaurantId: restaurant.id,
        name: sName,
        email: sEmail,
        phone: "+1 (555) 014-2210",
        role,
        title: ROLE_DEFINITIONS[role].label,
        pinCode: "5588",
      });
      executedTasks.push(
        `Added staff ${created.name} as ${ROLE_DEFINITIONS[role].label} (PIN: 5588)`
      );
      uiActions.push({ type: "switch_tab", tab: "team" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🛡️ Added **${created.name}** (${created.email}) as **${ROLE_DEFINITIONS[role].label}** (PIN: \`5588\`)!`;
      quickReplies = ["List staff", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(suspend|activate|remove|delete)\s+staff\b/i.test(lower)) {
      const targetStaff = staff.find((s) =>
        lower.includes(s.name.toLowerCase()) ||
        s.name
          .toLowerCase()
          .split(/\s+/)
          .some((part) => part.length >= 3 && lower.includes(part))
      );
      if (targetStaff) {
        if (/\b(remove|delete)\b/i.test(lower)) {
          deleteUserAccount(targetStaff.id);
          executedTasks.push(`Removed staff member ${targetStaff.name}`);
          replyText = `🗑️ Removed **${targetStaff.name}** from your staff team.`;
        } else {
          const nextStatus = /\b(suspend)\b/i.test(lower)
            ? "suspended"
            : "active";
          updateUserAccount(targetStaff.id, { status: nextStatus });
          executedTasks.push(
            `Updated ${targetStaff.name} status to ${nextStatus.toUpperCase()}`
          );
          replyText = `✅ Updated **${targetStaff.name}**'s status to **${nextStatus.toUpperCase()}**.`;
        }
        uiActions.push({ type: "switch_tab", tab: "team" });
        uiActions.push({ type: "refresh_portal" });
        quickReplies = ["List staff", "Check active orders"];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
          state: nextState,
        });
      }
    }

    if (/\b(staff|team|cashier|chef|pin|list staff)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "team" });
      const staffLines = staff
        .map(
          (s) =>
            `- **${s.name}** (${s.title}) — PIN: \`${s.pinCode}\` • ${s.status.toUpperCase()}`
        )
        .join("\n");
      replyText = `👥 **Kitchen & Cashier Staff (${staff.length})**:\n${staffLines}`;
      quickReplies = [
        "Add staff Tunde Bakare tunde@platerift.app",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 9. WEBSITE, BRANDING, COLORS, LAYOUT & CUSTOM DOMAIN
    // =========================================================================
    const hexMatch = message.match(/#([0-9a-fA-F]{6})\b/);
    const namedColor = Object.keys(COLOR_MAP).find((c) =>
      new RegExp(`\\b${c}\\b`, "i").test(lower)
    );
    if (
      /\b(color|theme|brand)\b/i.test(lower) &&
      (hexMatch || namedColor)
    ) {
      const nextColor = hexMatch ? `#${hexMatch[1]}` : COLOR_MAP[namedColor!];
      updateRestaurantTenant(restaurant.id, { primaryColor: nextColor });
      executedTasks.push(`Updated storefront brand color to ${nextColor}`);
      uiActions.push({ type: "switch_tab", tab: "domain" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🎨 Updated **${restaurant.name}**'s primary brand color to **${nextColor}**!`;
      quickReplies = [
        "Change layout to modern-grid",
        "Open Website & Logo settings",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (
      /\b(layout)\b/i.test(lower) &&
      /\b(aura-luxury|luxury|modern-grid|grid|editorial-list|editorial|compact-bistro|bistro)\b/i.test(
        lower
      )
    ) {
      let nextLayout: LayoutStyle = "modern-grid";
      if (lower.includes("aura") || lower.includes("luxury"))
        nextLayout = "aura-luxury";
      else if (lower.includes("editorial")) nextLayout = "editorial-list";
      else if (lower.includes("bistro") || lower.includes("compact"))
        nextLayout = "compact-bistro";
      updateRestaurantTenant(restaurant.id, { layoutStyle: nextLayout });
      executedTasks.push(`Updated storefront layout style to ${nextLayout}`);
      uiActions.push({ type: "switch_tab", tab: "domain" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `✨ Updated your storefront layout style to **${nextLayout}**!`;
      quickReplies = ["Open Website & Logo settings", "Show menu overview"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    const taglineMatch = message.match(
      /(?:change|set|update)\s+tagline\s+to\s+["']?(.+?)["']?$/i
    );
    if (taglineMatch) {
      const nextTagline = taglineMatch[1].trim();
      updateRestaurantTenant(restaurant.id, { tagline: nextTagline });
      executedTasks.push(`Updated restaurant tagline to "${nextTagline}"`);
      uiActions.push({ type: "switch_tab", tab: "domain" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `✨ Updated **${restaurant.name}**'s tagline to: *"${nextTagline}"*!`;
      quickReplies = ["Open Website & Logo settings", "Check active orders"];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (/\b(website|logo|domain|about us)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "domain" });
      executedTasks.push("Opened 10. Website, Logo & About Us");
      replyText =
        `🌐 **Website, Logo & Domain Settings**:\n` +
        `- **Custom Domain**: \`${restaurant.customDomain}\` (${restaurant.domainVerified ? "✅ Verified" : "⏳ Pending DNS"})\n` +
        `- **Layout Style**: \`${restaurant.layoutStyle}\` • **Brand Color**: \`${restaurant.primaryColor}\`\n` +
        `- **Tagline**: *"${restaurant.tagline}"*`;
      quickReplies = [
        "Change brand color to gold",
        "Change layout to modern-grid",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 10. PLUG & PLAY INTEGRATIONS (DOORDASH, SQUARE, CLOVER, VAPI)
    // =========================================================================
    if (
      /\b(sync .* pos|sync .* square|sync .* clover|doordash|square|clover|vapi|plug & play|integrations)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "integrations" });
      if (
        /\b(enable|turn on|disable|turn off)\b/i.test(lower) &&
        restaurant.integrationsConfig
      ) {
        const isEnable = /\b(enable|turn on)\b/i.test(lower);
        const nextInt = { ...restaurant.integrationsConfig };
        let appName = "";
        if (lower.includes("doordash")) {
          nextInt.doordashDrive = { ...nextInt.doordashDrive, enabled: isEnable };
          appName = "DoorDash Drive";
        } else if (lower.includes("square")) {
          nextInt.square = { ...nextInt.square, enabled: isEnable };
          appName = "Square POS";
        } else if (lower.includes("clover")) {
          nextInt.clover = { ...nextInt.clover, enabled: isEnable };
          appName = "Clover POS";
        } else if (lower.includes("vapi")) {
          nextInt.vapi = { ...nextInt.vapi, enabled: isEnable };
          appName = "Vapi Voice AI";
        }
        if (appName) {
          updateRestaurantTenant(restaurant.id, { integrationsConfig: nextInt });
          executedTasks.push(
            `${isEnable ? "Enabled" : "Disabled"} ${appName} integration`
          );
          uiActions.push({ type: "refresh_portal" });
          replyText = `🔌 **${appName}** is now **${
            isEnable ? "ENABLED" : "DISABLED"
          }** for **${restaurant.name}**!`;
          quickReplies = [
            "Sync menu with Square and Clover",
            "Check active orders",
          ];
          return NextResponse.json({
            replyText,
            executedTasks,
            uiActions,
            quickReplies,
            state: nextState,
          });
        }
      }

      if (/\b(sync)\b/i.test(lower) && restaurant.integrationsConfig) {
        const nowIso = new Date().toISOString();
        const nextInt = {
          ...restaurant.integrationsConfig,
          square: {
            ...restaurant.integrationsConfig.square,
            lastSyncedAt: nowIso,
            mappedItemCount: menuItems.length,
          },
          clover: {
            ...restaurant.integrationsConfig.clover,
            lastSyncedAt: nowIso,
            mappedItemCount: menuItems.length,
          },
          activityLogs: [
            {
              id: `log_ai_${Date.now()}`,
              integration: "square" as const,
              action: "AI Assistant Full Catalog & 86 Sync",
              direction: "outbound" as const,
              status: "success" as const,
              summary: `Synced all ${menuItems.length} menu items (${soldOutDishes.length} 86'd) to Square & Clover POS via Owner AI Assistant.`,
              createdAt: nowIso,
            },
            ...(restaurant.integrationsConfig.activityLogs || []).slice(0, 29),
          ],
        };
        updateRestaurantTenant(restaurant.id, { integrationsConfig: nextInt });
        executedTasks.push(
          `Synced all ${menuItems.length} menu items with Square & Clover POS`
        );
        uiActions.push({ type: "refresh_portal" });
        replyText = `🔄 Synced all **${menuItems.length} menu dishes** (${soldOutDishes.length} sold-out) with **Square POS** and **Clover POS**!`;
      } else {
        const ddReady =
          platformIntegrations.doordashDrive.setupCompleted &&
          platformIntegrations.doordashDrive.availableToOwners &&
          (restaurant.integrationsConfig?.doordashDrive.enabled ?? true);
        const sqReady =
          platformIntegrations.square.setupCompleted &&
          platformIntegrations.square.availableToOwners &&
          (restaurant.integrationsConfig?.square.enabled ?? true);
        const clvReady =
          platformIntegrations.clover.setupCompleted &&
          platformIntegrations.clover.availableToOwners &&
          (restaurant.integrationsConfig?.clover.enabled ?? true);
        const vapiReady =
          platformIntegrations.vapi.setupCompleted &&
          platformIntegrations.vapi.availableToOwners &&
          (restaurant.integrationsConfig?.vapi.enabled ?? true);

        replyText = `🔌 **Plug & Play Apps Status**:\n- **🚗 DoorDash Drive**: ${
          ddReady ? "✅ Active" : "⏸️ Disabled"
        }\n- **⬛ Square POS**: ${
          sqReady ? "✅ Connected" : "⏸️ Disabled"
        }\n- **🍀 Clover POS**: ${
          clvReady ? "✅ Connected" : "⏸️ Disabled"
        }\n- **🎙️ Vapi Voice AI**: ${
          vapiReady ? "✅ 24/7 Phone Agent Live" : "⏸️ Disabled"
        }`;
      }
      quickReplies = [
        "Sync menu with Square and Clover",
        "Enable DoorDash Drive",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 11. SPECIFIC DISH OR INGREDIENT MENTION (When owner types just a dish or ingredient name)
    // =========================================================================
    if (dishForUpdate) {
      nextState.lastDishId = dishForUpdate.id;
      uiActions.push({ type: "switch_tab", tab: "menu" });
      replyText =
        `🍽️ **${dishForUpdate.name}** (${dishForUpdate.category}):\n` +
        `- **Price**: **$${dishForUpdate.price.toFixed(2)}** • **Prep Time**: ${dishForUpdate.prepTimeMinutes}m\n` +
        `- **Status**: ${dishForUpdate.available ? "✅ Available" : "🚫 Sold Out (86'd)"}\n` +
        `- **Stock**: ${
          dishForUpdate.currentStockCount !== null
            ? `${dishForUpdate.currentStockCount} portions left`
            : "Unlimited"
        }\n\nWhat would you like to do with **${dishForUpdate.name}**?`;
      quickReplies = [
        `Edit ${dishForUpdate.name}`,
        dishForUpdate.available
          ? `Mark ${dishForUpdate.name} sold out`
          : `Make ${dishForUpdate.name} available`,
        `Change price of ${dishForUpdate.name} to $${(dishForUpdate.price + 2).toFixed(2)}`,
        `Delete ${dishForUpdate.name}`,
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    if (matchedIng) {
      nextState.lastIngredientId = matchedIng.id;
      uiActions.push({ type: "switch_tab", tab: "inventory" });
      replyText =
        `📦 **${matchedIng.name}** (${matchedIng.category}):\n` +
        `- **Current Stock**: **${matchedIng.currentStock} ${matchedIng.unit}** (Alert at ${matchedIng.reorderPoint} ${matchedIng.unit}, Par: ${matchedIng.parLevel} ${matchedIng.unit})\n` +
        `- **Unit Cost**: $${matchedIng.unitCost.toFixed(2)} / ${matchedIng.unit}\n\nWould you like me to restock **${matchedIng.name}**?`;
      quickReplies = [
        `Restock ${matchedIng.name}`,
        `Add 20 to ${matchedIng.name}`,
        "Restock all low stock items",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // =========================================================================
    // 12. REVENUE / SALES / DAILY BRIEFING OR SPECIFIC CLARIFICATION
    // =========================================================================
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.total, 0);

    if (
      /\b(revenue|sales|earnings|how much did we make|daily summary|daily briefing|summary|report|status|overview)\b/i.test(
        lower
      )
    ) {
      replyText =
        `📊 **${restaurant.name} Live Snapshot**:\n` +
        `- **Revenue**: **$${totalRevenue.toFixed(2)}** across **${orders.length} total orders** (**${activeOrders.length} active**: ${confirmedOrders.length} confirmed, ${preparingOrders.length} preparing, ${readyOrders.length} ready)\n` +
        `- **Menu**: **${menuItems.length} dishes** (${soldOutDishes.length} sold-out)\n` +
        `- **Inventory**: **${lowStockItems.length} low-stock alert(s)** out of ${inventoryItems.length} items\n` +
        `- **Storefront**: **${
          restaurant.orderingEnabled && availability.allowed
            ? `LIVE (~${restaurant.prepTimeMinutes}m prep)`
            : "PAUSED / CLOSED"
        }**`;
      quickReplies = [
        "Check active orders",
        "Show menu overview",
        "Check inventory & profit",
        "Restock all low stock items",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
        state: nextState,
      });
    }

    // Specific, non-generic response when the owner types an unfamiliar phrase
    replyText =
      `I'm ready to execute that for **${restaurant.name}** — tell me the exact item or value so I can apply it immediately:\n` +
      `- **Menu**: *"Add [Dish Name] $18.50"*, *"86 [Dish Name]"*, *"Change [Dish Name] price to $20"*, or *"Delete [Dish Name]"*\n` +
      `- **Orders**: *"Mark order #${activeOrders[0]?.orderNumber || "1001"} ready"* or *"Start preparing all confirmed orders"*\n` +
      `- **Stock / Store**: *"Restock ${lowStockItems[0]?.name || "all low stock items"}"*, *"Set prep time to 25 mins"*, or *"Pause online ordering"*`;

    quickReplies = [
      "Check active orders",
      "Open Add Menu modal",
      "Restock all low stock items",
      "Show menu overview",
    ];

    return NextResponse.json({
      replyText,
      executedTasks,
      uiActions,
      quickReplies,
      state: nextState,
    });
  } catch (err) {
    console.error("Owner AI Assistant error:", err);
    return NextResponse.json(
      { error: "Failed to process owner assistant request" },
      { status: 500 }
    );
  }
}
