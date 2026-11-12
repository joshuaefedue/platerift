import { NextRequest, NextResponse } from "next/server";
import {
  createCustomerManual,
  createEmailCampaign,
  createMenuItem,
  createSmsLog,
  createUserAccount,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  listCustomers,
  listEmailCampaigns,
  listMenuItems,
  listOrders,
  listUsers,
  updateMenuItem,
  updateOrderStatus,
  updateRestaurantTenant,
} from "@/lib/db";
import { evaluateRestaurantAvailability } from "@/lib/availability";
import { buildDefaultVariantAndSideGroups } from "@/lib/menuVariantsAndSides";
import {
  MenuItem,
  Order,
  PortalTabId,
  ROLE_DEFINITIONS,
} from "@/lib/types";

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
  for (const item of sorted) {
    const words = item.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !["with", "and", "the"].includes(w));
    if (words.some((w) => lower.includes(w))) {
      return item;
    }
  }
  return null;
}

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

    const menuItems = listMenuItems(restaurant.id);
    const orders = listOrders(restaurant.id);
    const customers = listCustomers(restaurant.id);
    const campaigns = listEmailCampaigns(restaurant.id);
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
    const soldOutDishes = menuItems.filter((m) => !m.available);
    const inventoryItems = restaurant.inventoryConfig?.items || [];
    const lowStockItems = inventoryItems.filter(
      (i) => i.currentStock <= i.reorderPoint
    );

    // =========================================================================
    // 1. PAUSE OR RESUME ONLINE ORDERING
    // =========================================================================
    if (
      /\b(pause ordering|stop ordering|close kitchen|turn off ordering|pause online orders|pause kitchen)\b/i.test(
        lower
      )
    ) {
      updateRestaurantTenant(restaurant.id, {
        orderingEnabled: false,
        pauseReason: "Kitchen temporarily paused incoming online orders via Owner AI Assistant.",
      });
      executedTasks.push("Paused online ordering immediately");
      uiActions.push({ type: "refresh_portal" });
      replyText = `⏸️ **Online Ordering is now PAUSED** for **${restaurant.name}**. Customers visiting your storefront will see your pause message until you resume ordering.`;
      quickReplies = [
        "Resume online ordering",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(resume ordering|start ordering|open kitchen|turn on ordering|enable ordering|unpause ordering)\b/i.test(
        lower
      )
    ) {
      updateRestaurantTenant(restaurant.id, {
        orderingEnabled: true,
        pauseReason: "",
      });
      executedTasks.push("Resumed live online ordering");
      uiActions.push({ type: "refresh_portal" });
      replyText = `✅ **Online Ordering is now LIVE** for **${restaurant.name}**! Customers can place Pickup, Delivery, and Dine-In orders immediately.`;
      quickReplies = [
        "Check active orders",
        "Check low stock items",
        "Show sold-out dishes",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 2. ORDER MANAGEMENT (ADVANCE, MARK READY, COMPLETE, CANCEL, FILTER)
    // =========================================================================
    const orderNumMatch = message.match(/(?:#|ord-|order\s+)([a-z0-9-]{3,12})/i);
    if (
      orderNumMatch &&
      /\b(confirm|prepare|preparing|cook|ready|complete|completed|cancel|cancelled)\b/i.test(
        lower
      )
    ) {
      const token = orderNumMatch[1].toLowerCase();
      const targetOrder = orders.find(
        (o) =>
          o.orderNumber.toLowerCase().includes(token) ||
          o.id.toLowerCase().includes(token)
      );
      if (targetOrder) {
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
        executedTasks.push(
          `Updated Order #${targetOrder.orderNumber} (${targetOrder.customerName}) → ${nextStatus.toUpperCase()}`
        );
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `✅ Updated **Order #${targetOrder.orderNumber}** for **${targetOrder.customerName}** to **${nextStatus.toUpperCase()}**. Automated customer notifications have been triggered.`;
        quickReplies = [
          "Show all active orders",
          "Start preparing all confirmed orders",
          "Mark all preparing orders ready",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
        });
      }
    }

    // Bulk order status actions
    if (
      /\b(start preparing all|prepare all confirmed|cook all confirmed|accept all orders)\b/i.test(
        lower
      )
    ) {
      if (confirmedOrders.length === 0) {
        replyText = `There are currently **0 confirmed orders** waiting to enter the kitchen. You have **${preparingOrders.length} preparing** and **${readyOrders.length} ready** orders.`;
      } else {
        for (const ord of confirmedOrders) {
          updateOrderStatus(ord.id, "preparing");
        }
        executedTasks.push(
          `Moved ${confirmedOrders.length} confirmed order(s) to PREPARING`
        );
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🔥 Started preparing **${confirmedOrders.length} confirmed order(s)** (${confirmedOrders
          .map((o) => `#${o.orderNumber}`)
          .join(", ")})!`;
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
      });
    }

    if (
      /\b(mark all preparing orders ready|mark preparing ready|all orders ready)\b/i.test(
        lower
      )
    ) {
      if (preparingOrders.length === 0) {
        replyText = `There are currently **0 preparing orders** in the kitchen.`;
      } else {
        for (const ord of preparingOrders) {
          updateOrderStatus(ord.id, "ready");
        }
        executedTasks.push(
          `Marked ${preparingOrders.length} preparing order(s) as READY`
        );
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `✅ Marked **${preparingOrders.length} order(s)** (${preparingOrders
          .map((o) => `#${o.orderNumber}`)
          .join(", ")}) as **READY** for pickup/delivery!`;
      }
      quickReplies = [
        "Complete all ready orders",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(complete all ready|finish all ready|clear ready orders)\b/i.test(
        lower
      )
    ) {
      if (readyOrders.length === 0) {
        replyText = `There are currently **0 ready orders** waiting to be completed.`;
      } else {
        for (const ord of readyOrders) {
          updateOrderStatus(ord.id, "completed");
        }
        executedTasks.push(
          `Completed ${readyOrders.length} ready order(s)`
        );
        uiActions.push({ type: "switch_tab", tab: "orders" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `🎉 Completed **${readyOrders.length} ready order(s)** (${readyOrders
          .map((o) => `#${o.orderNumber}`)
          .join(", ")})!`;
      }
      quickReplies = [
        "Show today's orders",
        "Show daily summary",
        "Check low stock items",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(show today's orders|filter today|orders today|today orders)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "orders" });
      uiActions.push({
        type: "filter_orders",
        orderDatePreset: "today",
        orderStatusFilter: "ALL",
      });
      executedTasks.push("Filtered Live Kitchen Orders to Today");
      replyText = `📅 Switched to **Customer Orders** and set the Date Filter to **Today**. You currently have **${activeOrders.length} active kitchen order(s)**.`;
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
      });
    }

    if (/\b(show all orders|reset order filter)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "orders" });
      uiActions.push({
        type: "filter_orders",
        orderDatePreset: "all",
        orderStatusFilter: "ALL",
      });
      executedTasks.push("Reset order filters to show all orders");
      replyText = `📋 Showing all **${orders.length} order(s)** in your Live Kitchen queue.`;
      quickReplies = [
        "Start preparing all confirmed orders",
        "Mark all preparing orders ready",
        "Open Add Menu modal",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 3. MENU MANAGEMENT (86 / SOLD-OUT, MAKE AVAILABLE, PRICE UPDATE, ADD/EDIT)
    // =========================================================================
    if (
      /\b(make all dishes available|restore all sold out|un-86 all|make everything available|enable all dishes)\b/i.test(
        lower
      )
    ) {
      if (soldOutDishes.length === 0) {
        replyText = `✅ All **${menuItems.length} dishes** on your menu are already marked **AVAILABLE**!`;
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
          .join(", ")}) back to **AVAILABLE** on your live storefront and synced with POS!`;
      }
      quickReplies = [
        "Open Add Menu modal",
        "Show sold-out dishes",
        "Check low stock items",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(86|sold out|mark .* unavailable|disable dish|turn off dish|out of stock)\b/i.test(
        lower
      ) &&
      !/\b(show|which|list|what)\b/i.test(lower)
    ) {
      const dish = findDishByName(menuItems, message);
      if (dish) {
        updateMenuItem(dish.id, {
          available: false,
          unavailableReason: "Temporarily sold out for today",
        });
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
        });
      }
    }

    if (
      /\b(make .* available|restore .*|enable .*|back in stock)\b/i.test(lower)
    ) {
      const dish = findDishByName(menuItems, message);
      if (dish) {
        updateMenuItem(dish.id, {
          available: true,
          unavailableReason: "",
        });
        executedTasks.push(`Marked "${dish.name}" as AVAILABLE`);
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `✅ **${dish.name}** is now **AVAILABLE** on your live storefront!`;
        quickReplies = [
          `Edit ${dish.name}`,
          "Open Add Menu modal",
          "Check active orders",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
        });
      }
    }

    const priceUpdateMatch = message.match(
      /(?:price|cost|set|change).*?\$?(\d+(?:\.\d{1,2})?)/i
    );
    if (
      priceUpdateMatch &&
      /\b(price|cost)\b/i.test(lower) &&
      !/\b(delivery fee|minimum|tax|add new|create)\b/i.test(lower)
    ) {
      const dish = findDishByName(menuItems, message);
      const newPrice = parseFloat(priceUpdateMatch[1]);
      if (dish && !isNaN(newPrice) && newPrice > 0) {
        updateMenuItem(dish.id, { price: newPrice });
        executedTasks.push(
          `Updated price of "${dish.name}" from $${dish.price.toFixed(2)} to $${newPrice.toFixed(2)}`
        );
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `💲 Updated the price of **${dish.name}** to **$${newPrice.toFixed(
          2
        )}** on your live menu!`;
        quickReplies = [
          `Edit ${dish.name}`,
          "Open Add Menu modal",
          "Show menu overview",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
        });
      }
    }

    const addDishDirectMatch = message.match(
      /(?:add|create)\s+(?:a\s+)?(?:new\s+)?(?:dish|item|menu item)\s+(?:called\s+|named\s+)?["']?([^$"'\n]+?)["']?\s+(?:for|at|price)\s+\$?(\d+(?:\.\d{1,2})?)/i
    );
    if (addDishDirectMatch) {
      const dishName = addDishDirectMatch[1].trim();
      const dishPrice = parseFloat(addDishDirectMatch[2]);
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
      executedTasks.push(
        `Created new menu dish "${created.name}" ($${created.price.toFixed(2)}) in ${created.category}`
      );
      uiActions.push({ type: "switch_tab", tab: "menu" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🍽️ Added **${created.name}** (**$${created.price.toFixed(
        2
      )}**) to **${created.category}** with default variants & sides! You can click **Edit** on its card anytime to customize photos or options.`;
      quickReplies = [
        `Edit ${created.name}`,
        "Open Add Menu modal",
        "Show menu overview",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(open add menu|add a dish|add menu item|new menu item|add new dish|create menu item)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "menu" });
      uiActions.push({ type: "open_add_menu_modal" });
      executedTasks.push("Opened the + Add Menu Item modal");
      replyText = `🍽️ I switched to **2. Food Menu & Sold-Out** and opened the **+ Add Menu** popup modal for you! You can also tell me directly: *"Add a new dish called Suya Beef Skewers for $16.50"*.`;
      quickReplies = [
        "Add a new dish called Suya Beef Skewers for $16.50",
        "Show sold-out dishes",
        "Make all dishes available",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (/\b(edit)\b/i.test(lower)) {
      const dish = findDishByName(menuItems, message);
      if (dish) {
        uiActions.push({ type: "switch_tab", tab: "menu" });
        uiActions.push({ type: "open_edit_menu_modal", menuItemId: dish.id });
        executedTasks.push(`Opened Edit Dish modal for "${dish.name}"`);
        replyText = `✏️ Opened the **Edit Menu Item** modal for **${dish.name}** ($${dish.price.toFixed(
          2
        )}).`;
        quickReplies = [
          `Mark ${dish.name} sold out`,
          "Open Add Menu modal",
          "Show menu overview",
        ];
        return NextResponse.json({
          replyText,
          executedTasks,
          uiActions,
          quickReplies,
        });
      }
    }

    // =========================================================================
    // 4. INVENTORY & STOCK MANAGEMENT (RESTOCK LOW ITEMS, CHECK STOCK)
    // =========================================================================
    if (
      /\b(restock all|refill all|restock low|replenish stock|restock inventory)\b/i.test(
        lower
      )
    ) {
      if (!restaurant.inventoryConfig) {
        replyText = `Your inventory configuration is ready in **3. Kitchen Stock & Profit**.`;
      } else if (lowStockItems.length === 0) {
        replyText = `✅ All **${inventoryItems.length} inventory items** are well above their reorder points! No restock needed right now.`;
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
          `Restocked ${lowStockItems.length} low-stock ingredient(s) back to full par levels`
        );
        uiActions.push({ type: "switch_tab", tab: "inventory" });
        uiActions.push({ type: "refresh_portal" });
        replyText = `📦 Restocked **${lowStockItems.length} low-stock item(s)** (${lowStockItems
          .map((i) => i.name)
          .join(", ")}) back to their full par levels!`;
      }
      quickReplies = [
        "Check inventory & profit",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(low stock|inventory|kitchen stock|stock level|profit margin)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "inventory" });
      const lowSummary =
        lowStockItems.length > 0
          ? `⚠️ **${lowStockItems.length} item(s) need restocking**: ${lowStockItems
              .map((i) => `**${i.name}** (${i.currentStock} ${i.unit} left)`)
              .join(", ")}.`
          : `✅ All **${inventoryItems.length} inventory cards** are well-stocked above their alert levels.`;
      replyText = `📦 Opened **3. Kitchen Stock & Profit**.\n\n${lowSummary}\n\nWant me to automatically restock all low-stock items to their full par levels?`;
      quickReplies = [
        "Restock all low stock items",
        "Check active orders",
        "Open Add Menu modal",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 5. FULFILLMENT, PREP TIME, ORDER LIMITS & DELIVERY FEES
    // =========================================================================
    const prepTimeMatch = message.match(
      /(?:prep time|preparation time).*?(\d+)\s*(?:min|minute|m\b)/i
    );
    if (prepTimeMatch) {
      const mins = Math.max(5, Math.min(180, parseInt(prepTimeMatch[1], 10)));
      updateRestaurantTenant(restaurant.id, { prepTimeMinutes: mins });
      executedTasks.push(`Updated kitchen prep time to ${mins} minutes`);
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `⏱️ Updated **${restaurant.name}**'s estimated prep time to **${mins} minutes**!`;
      quickReplies = [
        "Set max orders per hour to 25",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    const maxHourMatch = message.match(
      /(?:max orders per hour|hourly limit|orders per hour).*?(\d+)/i
    );
    if (maxHourMatch) {
      const cap = Math.max(1, Math.min(500, parseInt(maxHourMatch[1], 10)));
      updateRestaurantTenant(restaurant.id, { maxOrdersPerHour: cap });
      executedTasks.push(`Updated hourly order cap to ${cap} orders/hour`);
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🚦 Updated **Max Orders Per Hour** to **${cap} orders/hr**!`;
      quickReplies = [
        "Set prep time to 20 minutes",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

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
        "Check active orders",
        "Open Plug & Play Apps",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(enable delivery|turn on delivery|disable delivery|turn off delivery|enable pickup|disable pickup|enable dine-in|disable dine-in)\b/i.test(
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
      } else {
        nextFeatures.dineInQr = isEnable;
        label = "Dine-In QR";
      }
      updateRestaurantTenant(restaurant.id, { features: nextFeatures });
      executedTasks.push(
        `${isEnable ? "Enabled" : "Disabled"} ${label} fulfillment`
      );
      uiActions.push({ type: "switch_tab", tab: "limits" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `✅ **${label}** fulfillment is now **${
        isEnable ? "ENABLED" : "DISABLED"
      }** for **${restaurant.name}**.`;
      quickReplies = [
        "Set prep time to 25 minutes",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 6. SMS BROADCAST & PROMO EMAIL CAMPAIGNS
    // =========================================================================
    if (
      /\b(send sms|broadcast sms|text customers|sms blast)\b/i.test(lower)
    ) {
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
      executedTasks.push(
        `Sent SMS broadcast to ${targets.length} customer(s)`
      );
      uiActions.push({ type: "switch_tab", tab: "sms" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `📲 Dispatched **SMS Broadcast** to **${targets.length} opted-in customer(s)**!\n\n> *"${smsBody}"*`;
      quickReplies = [
        "Send 20% off weekend promo email",
        "Show VIP customers",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (
      /\b(send .* email|launch .* email|email campaign|promo email)\b/i.test(
        lower
      )
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
        "Send SMS broadcast: Flash sale tonight 15% off!",
        "Show VIP customers",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 7. ADD CUSTOMER OR STAFF MEMBER
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
      quickReplies = [
        "Send SMS broadcast",
        "Send 20% off weekend promo email",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    const addStaffMatch = message.match(
      /add\s+staff\s+([a-zA-Z\s]+?)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    );
    if (addStaffMatch) {
      const sName = addStaffMatch[1].trim();
      const sEmail = addStaffMatch[2].trim();
      const created = createUserAccount({
        scope: "restaurant",
        restaurantId: restaurant.id,
        name: sName,
        email: sEmail,
        phone: "+1 (555) 014-2210",
        role: "general_manager",
        title: ROLE_DEFINITIONS.general_manager.label,
        pinCode: "5588",
      });
      executedTasks.push(`Added staff member ${created.name} (PIN: 5588)`);
      uiActions.push({ type: "switch_tab", tab: "team" });
      uiActions.push({ type: "refresh_portal" });
      replyText = `🛡️ Added **${created.name}** (${created.email}) to your Kitchen & Cashier Staff as **General Manager** (PIN: \`5588\`)!`;
      quickReplies = [
        "Open Staff & Team tab",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 8. PLUG & PLAY INTEGRATIONS (DOORDASH, SQUARE, CLOVER, VAPI)
    // =========================================================================
    if (
      /\b(sync .* pos|sync .* square|sync .* clover|doordash|vapi|plug & play|integrations)\b/i.test(
        lower
      )
    ) {
      uiActions.push({ type: "switch_tab", tab: "integrations" });
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
        replyText = `🔄 Synced all **${menuItems.length} menu dishes** (${soldOutDishes.length} sold-out) with **Square POS** and **Clover POS**, and opened **9. Plug & Play Apps**!`;
      } else {
        const ddReady =
          platformIntegrations.doordashDrive.setupCompleted &&
          platformIntegrations.doordashDrive.availableToOwners;
        const sqReady =
          platformIntegrations.square.setupCompleted &&
          platformIntegrations.square.availableToOwners;
        const clvReady =
          platformIntegrations.clover.setupCompleted &&
          platformIntegrations.clover.availableToOwners;
        const vapiReady =
          platformIntegrations.vapi.setupCompleted &&
          platformIntegrations.vapi.availableToOwners;

        replyText = `🔌 Opened **9. Plug & Play Apps** for **${restaurant.name}**:\n- **🚗 DoorDash Drive**: ${
          ddReady ? "Ready & Active" : "Pending Super Admin"
        }\n- **⬛ Square POS**: ${
          sqReady ? "Connected" : "Pending Super Admin"
        }\n- **🍀 Clover POS**: ${
          clvReady ? "Connected" : "Pending Super Admin"
        }\n- **🎙️ Vapi Voice AI**: ${
          vapiReady ? "24/7 Phone Agent Live" : "Pending Super Admin"
        }`;
      }
      quickReplies = [
        "Sync menu with Square and Clover",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 9. NAVIGATION TO ANY TAB
    // =========================================================================
    if (/\b(website|logo|domain|about us)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "domain" });
      executedTasks.push("Navigated to 10. Website, Logo & About Us");
      replyText = `🌐 Opened **10. Website, Logo & About Us** so you can customize your logo, brand colors, custom domain (\`${restaurant.customDomain}\`), and storefront pages.`;
      quickReplies = [
        "Show daily summary",
        "Open Add Menu modal",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (/\b(staff|team|cashier|chef|pin)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "team" });
      executedTasks.push("Navigated to 11. Kitchen & Cashier Staff");
      replyText = `👥 Opened **11. Kitchen & Cashier Staff**. You currently have **${staff.length} team member(s)**. You can also tell me: *"Add staff Tunde Bakare tunde@platerift.app"*.`;
      quickReplies = [
        "Add staff Tunde Bakare tunde@platerift.app",
        "Check active orders",
        "Show daily summary",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (/\b(sold-out|sold out|unavailable dishes)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "menu" });
      if (soldOutDishes.length === 0) {
        replyText = `✅ You currently have **0 sold-out dishes** — all **${menuItems.length} dishes** are available on your live menu!`;
      } else {
        replyText = `🚫 You currently have **${soldOutDishes.length} sold-out (86'd) dish(es)**:\n${soldOutDishes
          .map((d) => `- **${d.name}** ($${d.price.toFixed(2)})`)
          .join("\n")}\n\nWant me to make all of them available again?`;
      }
      quickReplies = [
        "Make all dishes available",
        "Open Add Menu modal",
        "Check active orders",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    if (/\b(vip|customer|crm)\b/i.test(lower)) {
      uiActions.push({ type: "switch_tab", tab: "customers" });
      const vips = customers.filter((c) => c.vipStatus);
      replyText = `👥 Opened **5. Customer List**. You have **${customers.length} total customers** (**${vips.length} VIPs**). You can add a customer anytime by saying: *"Add VIP customer Amaka Okafor amaka@example.com"*.`;
      quickReplies = [
        "Add VIP customer Amaka Okafor amaka@example.com",
        "Send SMS broadcast",
        "Send 20% off weekend promo email",
      ];
      return NextResponse.json({
        replyText,
        executedTasks,
        uiActions,
        quickReplies,
      });
    }

    // =========================================================================
    // 10. DEFAULT: FULL DAILY DASHBOARD BRIEFING & TASK CO-PILOT
    // =========================================================================
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.total, 0);

    replyText =
      `👋 **${restaurant.name} Owner AI Co-Pilot Report**:\n\n` +
      `- **🔥 Kitchen Orders**: **${activeOrders.length} active** (${confirmedOrders.length} confirmed, ${preparingOrders.length} preparing, ${readyOrders.length} ready) • Total Revenue: **$${totalRevenue.toFixed(2)}**\n` +
      `- **🍽️ Food Menu**: **${menuItems.length} dishes** (${soldOutDishes.length} sold-out / 86'd)\n` +
      `- **📦 Kitchen Stock**: **${inventoryItems.length} tracked ingredients** (${lowStockItems.length} low stock alerts)\n` +
      `- **🟢 Store Status**: **${
        restaurant.orderingEnabled && availability.allowed
          ? `LIVE (~${restaurant.prepTimeMinutes}m prep)`
          : "PAUSED / CLOSED"
      }**\n` +
      `- **📣 CRM & Marketing**: **${customers.length} customers**, **${campaigns.length} email campaigns**\n\n` +
      `Tell me any task you want done — I can update orders, add or 86 menu dishes, restock inventory, pause/resume ordering, sync POS, or send SMS/email blasts!`;

    quickReplies = [
      "Start preparing all confirmed orders",
      "Mark all preparing orders ready",
      "Open Add Menu modal",
      "Restock all low stock items",
      "Sync menu with Square and Clover",
      "Send 20% off weekend promo email",
    ];

    return NextResponse.json({
      replyText,
      executedTasks,
      uiActions,
      quickReplies,
    });
  } catch (err) {
    console.error("Owner AI Assistant error:", err);
    return NextResponse.json(
      { error: "Failed to process owner assistant request" },
      { status: 500 }
    );
  }
}
