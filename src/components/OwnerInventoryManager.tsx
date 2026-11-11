"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Flame,
  HelpCircle,
  Package,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  TrendingUp,
  Trash2,
  Truck,
  Utensils,
} from "lucide-react";
import {
  InventoryCategory,
  InventoryItem,
  InventoryStorageLocation,
  MenuItem,
  RestaurantInventoryConfig,
  RestaurantTenant,
  ScheduledReorder,
  ShiftLoadoutCheckItem,
  WasteLogEntry,
} from "@/lib/types";
import {
  buildDefaultInventoryConfig,
  buildNigerianAfricanInventoryConfig,
} from "@/lib/inventoryDefaults";

export interface OwnerInventoryManagerProps {
  restaurant: RestaurantTenant;
  menuItems: MenuItem[];
  scheduledReorders: ScheduledReorder[];
  slug: string;
  onChangeRestaurant: (next: RestaurantTenant) => void;
  onSavePatch: (
    patch: Partial<RestaurantTenant>,
    successMsg: string
  ) => Promise<void>;
  onReloadPortal: () => Promise<void>;
  notify: (msg: string) => void;
}

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  "Protein & Seafood": "🥩 Meat, Goat (Asun), Suya & Fish",
  "Produce & Dairy": "🍌🥬 Plantain (Dodo), Yam & Fresh Veg",
  "Dough, Grains & Dry": "🍚🌾 Jollof Rice, Semovita, Garri & Flour",
  "Sauces & Prep Batches": "🍲🌶️ Egusi, Efo Riro, Stew & Moi-Moi",
  "Packaging & Disposables": "📦 Takeaway Packs, Foil & Soup Bowls",
  "Truck Fuel & Supplies": "⛽ Cooking Gas (LPG), Charcoal & Gen Fuel",
};

const STORAGE_LABELS: Record<InventoryStorageLocation, string> = {
  "Line Prep Station": "🍳 Kitchen Serving Line / Pot",
  "Walk-In / Commissary": "❄️ Deep Freezer / Main Store",
  "On-Truck Cooler": "🚚 Food Truck / Bukka Cooler",
  "Dry Storage": "🥫 Dry Store (Rice, Oil & Packs)",
};

const NIGERIAN_QUICK_TEMPLATES: Array<{
  name: string;
  sku: string;
  category: InventoryCategory;
  storageLocation: InventoryStorageLocation;
  unit: string;
  parLevel: number;
  commissaryStock: number;
  reorderPoint: number;
  unitCost: number;
  shelfLifeHours: number;
  supplierName: string;
  exampleNote: string;
}> = [
  {
    name: "Smoky Party Jollof Rice Base (Firewood Style)",
    sku: "NG-JOL-POT",
    category: "Dough, Grains & Dry",
    storageLocation: "Line Prep Station",
    unit: "portions (scoops)",
    parLevel: 90,
    commissaryStock: 180,
    reorderPoint: 20,
    unitCost: 1.35,
    shelfLifeHours: 36,
    supplierName: "Mile 12 Market Bulk Rice & Ata Rodo",
    exampleNote: "Shared across Jollof Rice combos, Specials & Party Trays",
  },
  {
    name: "Peppered Goat Meat (Asun) & Assorted Orishirishi",
    sku: "NG-MEAT-ASUN",
    category: "Protein & Seafood",
    storageLocation: "Line Prep Station",
    unit: "meat portions",
    parLevel: 60,
    commissaryStock: 80,
    reorderPoint: 15,
    unitCost: 3.4,
    shelfLifeHours: 48,
    supplierName: "Lagos Abattoir Fresh Butcher",
    exampleNote: "Used for Asun Peppered Goat, Jollof + Goat & Soup Protein",
  },
  {
    name: "Egusi (Melon) & Efo Riro Vegetable Soup Pot",
    sku: "NG-SOUP-EGU",
    category: "Sauces & Prep Batches",
    storageLocation: "Line Prep Station",
    unit: "soup bowls",
    parLevel: 50,
    commissaryStock: 70,
    reorderPoint: 12,
    unitCost: 2.8,
    shelfLifeHours: 36,
    supplierName: "Oyingbo Fresh Ugwu & Melon Seed",
    exampleNote: "Served with Pounded Yam, Amala, Eba or Semovita",
  },
  {
    name: "Beef Suya Skewers & Yaji Groundnut Spice",
    sku: "NG-SUYA-BEEF",
    category: "Protein & Seafood",
    storageLocation: "On-Truck Cooler",
    unit: "skewers",
    parLevel: 70,
    commissaryStock: 120,
    reorderPoint: 15,
    unitCost: 2.5,
    shelfLifeHours: 36,
    supplierName: "Arewa Mai-Suya Grill Prep",
    exampleNote: "Night grill & food-truck favorite with sliced onions/cabbage",
  },
  {
    name: "Ripe Sweet Plantain (Dodo) & Pounded Yam Wraps",
    sku: "NG-SIDE-DODO",
    category: "Produce & Dairy",
    storageLocation: "Walk-In / Commissary",
    unit: "portions",
    parLevel: 65,
    commissaryStock: 100,
    reorderPoint: 15,
    unitCost: 0.95,
    shelfLifeHours: 48,
    supplierName: "Benue Yam & Plantain Farm Direct",
    exampleNote: "Side for Jollof Rice, Beans (Ewa Agoyin) & Swallow",
  },
  {
    name: "12.5kg Cooking Gas Cylinder, Charcoal & Gen Diesel",
    sku: "NG-GAS-12KG",
    category: "Truck Fuel & Supplies",
    storageLocation: "On-Truck Cooler",
    unit: "cylinders / kegs",
    parLevel: 5,
    commissaryStock: 8,
    reorderPoint: 2,
    unitCost: 18.0,
    shelfLifeHours: 8760,
    supplierName: "NaijaGas & Bukka Power Supply",
    exampleNote: "Prevents cooking gas or generator fuel finishing mid-rush",
  },
];

export function OwnerInventoryManager({
  restaurant,
  menuItems,
  scheduledReorders,
  slug,
  onChangeRestaurant,
  onSavePatch,
  onReloadPortal,
  notify,
}: OwnerInventoryManagerProps) {
  const config: RestaurantInventoryConfig = useMemo(
    () =>
      restaurant.inventoryConfig || buildDefaultInventoryConfig(restaurant),
    [restaurant]
  );

  const [subTab, setSubTab] = useState<
    "ingredients" | "batches" | "cogs" | "waste_checklist"
  >("ingredients");

  const [categoryFilter, setCategoryFilter] = useState<
    InventoryCategory | "ALL"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSimpleGuide, setShowSimpleGuide] = useState(true);

  // New inventory item form state
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState(
    "Mile 12 / Oyingbo Market Supplier"
  );
  const [newItemCategory, setNewItemCategory] =
    useState<InventoryCategory>("Protein & Seafood");
  const [newItemLocation, setNewItemLocation] =
    useState<InventoryStorageLocation>(
      config.operationType === "food_truck_commissary"
        ? "On-Truck Cooler"
        : "Line Prep Station"
    );
  const [newItemUnit, setNewItemUnit] = useState("portions (scoops)");
  const [newItemCurrentStock, setNewItemCurrentStock] = useState(45);
  const [newItemParLevel, setNewItemParLevel] = useState(60);
  const [newItemCommissaryStock, setNewItemCommissaryStock] = useState(100);
  const [newItemReorderPoint, setNewItemReorderPoint] = useState(15);
  const [newItemUnitCost, setNewItemUnitCost] = useState(2.25);
  const [newItemShelfLifeHours, setNewItemShelfLifeHours] = useState(36);
  const [newItemAuto86, setNewItemAuto86] = useState(true);
  const [newItemLinkedMenuIds, setNewItemLinkedMenuIds] = useState<string[]>(
    []
  );

  // Waste log form state
  const [wasteItemId, setWasteItemId] = useState<string>(
    config.items[0]?.id || ""
  );
  const [wasteQty, setWasteQty] = useState<number>(2);
  const [wasteReason, setWasteReason] = useState<WasteLogEntry["reason"]>(
    "Expired / Spoilage (FIFO)"
  );
  const [wasteLoggedBy, setWasteLoggedBy] = useState<string>(
    restaurant.ownerName || "Chef Tunde"
  );

  // New shift checklist item state
  const [newCheckLabel, setNewCheckLabel] = useState("");
  const [newCheckCategory, setNewCheckCategory] =
    useState<ShiftLoadoutCheckItem["category"]>("Kitchen Prep");

  const persistInventoryConfig = async (
    nextConfig: RestaurantInventoryConfig,
    toastMessage: string
  ) => {
    setSaving(true);
    try {
      onChangeRestaurant({
        ...restaurant,
        inventoryConfig: nextConfig,
      });
      await onSavePatch({ inventoryConfig: nextConfig }, toastMessage);
    } finally {
      setSaving(false);
    }
  };

  // Load the Nigerian / African Kitchen sample pack in 1 click
  const handleLoadNigerianSamplePack = async () => {
    const dishIds = menuItems.map((m) => m.id);
    const ngConfig = buildNigerianAfricanInventoryConfig(dishIds);
    await persistInventoryConfig(
      ngConfig,
      "🇳🇬 Loaded Nigerian / African Kitchen stock cards (Jollof Base, Asun Goat Meat, Egusi Pot, Suya, Dodo, Moi-Moi & Cooking Gas)!"
    );
  };

  // Add a single Nigerian quick-template card with 1 click
  const handleQuickAddTemplate = async (
    tpl: (typeof NIGERIAN_QUICK_TEMPLATES)[number]
  ) => {
    const newItem: InventoryItem = {
      id: `inv-ng-${Date.now()}`,
      name: tpl.name,
      sku: tpl.sku,
      category: tpl.category,
      storageLocation: tpl.storageLocation,
      unit: tpl.unit,
      currentStock: tpl.parLevel,
      parLevel: tpl.parLevel,
      commissaryStock: tpl.commissaryStock,
      reorderPoint: tpl.reorderPoint,
      unitCost: tpl.unitCost,
      shelfLifeHours: tpl.shelfLifeHours,
      supplierName: tpl.supplierName,
      linkedMenuItemIds: menuItems.slice(0, 2).map((m) => m.id),
      auto86LinkedDishes: true,
      wasteCountToday: 0,
      lastRestockedAt: new Date().toISOString(),
    };
    await persistInventoryConfig(
      { ...config, items: [newItem, ...config.items] },
      `➕ Added "${tpl.name}" card to your kitchen stock!`
    );
  };

  // Sync linked menu items' availability when an ingredient hits 0 or is restocked
  const syncLinkedMenuAvailability = async (
    item: InventoryItem,
    nextStock: number
  ) => {
    if (!item.auto86LinkedDishes || item.linkedMenuItemIds.length === 0) return;

    const shouldBeAvailable = nextStock > 0;
    for (const menuId of item.linkedMenuItemIds) {
      const dish = menuItems.find((m) => m.id === menuId);
      if (!dish) continue;
      if (!shouldBeAvailable && dish.available) {
        await fetch(`/api/restaurants/${slug}/menu`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: dish.id,
            available: false,
            unavailableReason: `Auto-86'd: Shared ingredient "${item.name}" is finished (0 ${item.unit}).`,
          }),
        });
      } else if (
        shouldBeAvailable &&
        !dish.available &&
        dish.unavailableReason?.includes(item.name)
      ) {
        await fetch(`/api/restaurants/${slug}/menu`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: dish.id,
            available: true,
            unavailableReason: "",
          }),
        });
      }
    }
    await onReloadPortal();
  };

  // Adjust single ingredient stock
  const handleAdjustStock = async (item: InventoryItem, delta: number) => {
    const nextStock = Math.max(
      0,
      Number((item.currentStock + delta).toFixed(2))
    );
    const nextItems = config.items.map((it) =>
      it.id === item.id ? { ...it, currentStock: nextStock } : it
    );
    await persistInventoryConfig(
      { ...config, items: nextItems },
      `${item.name} updated to ${nextStock} ${item.unit}.`
    );
    if (
      (item.currentStock > 0 && nextStock === 0) ||
      (item.currentStock === 0 && nextStock > 0)
    ) {
      await syncLinkedMenuAvailability(item, nextStock);
    }
  };

  // Transfer from Store / Commissary to Active Kitchen / Food Truck up to Par
  const handleTransferFromCommissary = async (item: InventoryItem) => {
    const needed = Math.max(0, item.parLevel - item.currentStock);
    if (needed <= 0) {
      notify(
        `${item.name} is already full at its daily target (${item.parLevel} ${item.unit}).`
      );
      return;
    }
    const transferQty = Math.min(needed, item.commissaryStock);
    if (transferQty <= 0) {
      notify(
        `Main Store backup for ${item.name} is empty! Buy more from ${item.supplierName}.`
      );
      return;
    }
    const nextStock = Number((item.currentStock + transferQty).toFixed(2));
    const nextCommissary = Number(
      (item.commissaryStock - transferQty).toFixed(2)
    );
    const nextItems = config.items.map((it) =>
      it.id === item.id
        ? {
            ...it,
            currentStock: nextStock,
            commissaryStock: nextCommissary,
            lastRestockedAt: new Date().toISOString(),
          }
        : it
    );
    await persistInventoryConfig(
      { ...config, items: nextItems },
      `🚚 Moved ${transferQty} ${item.unit} of ${item.name} from Store to Kitchen/Truck.`
    );
    await syncLinkedMenuAvailability(item, nextStock);
  };

  // Restock all ingredients to Par & restore any auto-86'd dishes
  const handleRestockAllToPar = async () => {
    const nowIso = new Date().toISOString();
    const nextItems = config.items.map((it) => ({
      ...it,
      currentStock: Math.max(it.currentStock, it.parLevel),
      lastRestockedAt: nowIso,
    }));
    await persistInventoryConfig(
      { ...config, items: nextItems },
      "✅ All kitchen pots, meats & takeaway packs refilled to daily target!"
    );

    for (const dish of menuItems) {
      if (
        !dish.available &&
        dish.unavailableReason?.toLowerCase().includes("auto-86")
      ) {
        await fetch(`/api/restaurants/${slug}/menu`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: dish.id,
            available: true,
            unavailableReason: "",
          }),
        });
      }
    }
    await onReloadPortal();
  };

  // Morning shift reset for dish daily batch par counts
  const handleMorningBatchResetAllDishes = async () => {
    setSaving(true);
    try {
      for (const dish of menuItems) {
        const limitVal = dish.dailyStockLimit ?? 25;
        const parLimit = limitVal > 0 ? limitVal : 25;
        await fetch(`/api/restaurants/${slug}/menu`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: dish.id,
            dailyStockLimit: parLimit,
            currentStockCount: parLimit,
            available: true,
            unavailableReason: "",
          }),
        });
      }
      await onReloadPortal();
      notify(
        "🌅 Fresh Morning Pots Ready! All menu dishes reset to full daily portions."
      );
    } finally {
      setSaving(false);
    }
  };

  // Update a single dish's daily batch par or remaining stock
  const handleUpdateDishBatchStock = async (
    dish: MenuItem,
    nextCurrent: number,
    nextDailyLimit: number
  ) => {
    const clampedCurrent = Math.max(0, nextCurrent);
    const clampedLimit = Math.max(0, nextDailyLimit);
    const shouldBeAvailable =
      clampedLimit === 0 ? dish.available : clampedCurrent > 0;
    await fetch(`/api/restaurants/${slug}/menu`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: dish.id,
        currentStockCount: clampedCurrent,
        dailyStockLimit: clampedLimit,
        available: shouldBeAvailable,
        unavailableReason: shouldBeAvailable
          ? ""
          : `Finished for today's pot (0 / ${clampedLimit} portions left)`,
      }),
    });
    await onReloadPortal();
    notify(
      `Updated ${dish.name} pot count (${clampedCurrent} / ${clampedLimit} portions).`
    );
  };

  // Add new shared ingredient / packaging / truck supply item
  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: newItemName.trim(),
      sku:
        newItemSku.trim() || `NG-${Math.floor(100 + Math.random() * 900)}`,
      category: newItemCategory,
      storageLocation: newItemLocation,
      unit: newItemUnit.trim() || "portions",
      currentStock: Math.max(0, Number(newItemCurrentStock) || 0),
      parLevel: Math.max(1, Number(newItemParLevel) || 20),
      commissaryStock: Math.max(0, Number(newItemCommissaryStock) || 0),
      reorderPoint: Math.max(0, Number(newItemReorderPoint) || 5),
      unitCost: Math.max(0, Number(newItemUnitCost) || 0),
      shelfLifeHours: Math.max(1, Number(newItemShelfLifeHours) || 36),
      supplierName: newItemSupplier.trim() || "Mile 12 Market Supplier",
      linkedMenuItemIds: newItemLinkedMenuIds,
      auto86LinkedDishes: newItemAuto86,
      wasteCountToday: 0,
      lastRestockedAt: new Date().toISOString(),
    };

    const nextItems = [newItem, ...config.items];
    await persistInventoryConfig(
      { ...config, items: nextItems },
      `➕ Added "${newItem.name}" card to stock.`
    );
    setNewItemName("");
    setNewItemSku("");
    setNewItemLinkedMenuIds([]);
    setShowNewItemForm(false);
  };

  const handleDeleteInventoryItem = async (itemId: string, name: string) => {
    const nextItems = config.items.filter((i) => i.id !== itemId);
    await persistInventoryConfig(
      { ...config, items: nextItems },
      `🗑️ Removed "${name}" card.`
    );
  };

  // Log waste / spoilage and automatically deduct from current stock
  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = config.items.find((i) => i.id === wasteItemId);
    if (!targetItem || wasteQty <= 0) return;

    const costLost = Number((wasteQty * targetItem.unitCost).toFixed(2));
    const newWasteEntry: WasteLogEntry = {
      id: `waste-${Date.now()}`,
      inventoryItemId: targetItem.id,
      inventoryItemName: targetItem.name,
      quantity: wasteQty,
      unit: targetItem.unit,
      costImpact: costLost,
      reason: wasteReason,
      loggedBy: wasteLoggedBy.trim() || "Kitchen Lead",
      createdAt: new Date().toISOString(),
    };

    const nextStock = Math.max(
      0,
      Number((targetItem.currentStock - wasteQty).toFixed(2))
    );
    const nextItems = config.items.map((it) =>
      it.id === targetItem.id
        ? {
            ...it,
            currentStock: nextStock,
            wasteCountToday: (it.wasteCountToday || 0) + wasteQty,
          }
        : it
    );
    const nextWasteLogs = [newWasteEntry, ...config.wasteLogs];

    await persistInventoryConfig(
      { ...config, items: nextItems, wasteLogs: nextWasteLogs },
      `📉 Recorded ${wasteQty} ${targetItem.unit} waste for ${targetItem.name} (-$${costLost.toFixed(2)}) & deducted from stock.`
    );
    await syncLinkedMenuAvailability(targetItem, nextStock);
  };

  // Toggle shift checklist item
  const handleToggleChecklist = async (checkId: string) => {
    const nextChecklist = config.shiftChecklist.map((chk) =>
      chk.id === checkId ? { ...chk, checked: !chk.checked } : chk
    );
    await persistInventoryConfig(
      { ...config, shiftChecklist: nextChecklist },
      "Updated morning kitchen checklist."
    );
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckLabel.trim()) return;
    const nextItem: ShiftLoadoutCheckItem = {
      id: `chk-${Date.now()}`,
      label: newCheckLabel.trim(),
      category: newCheckCategory,
      checked: false,
    };
    await persistInventoryConfig(
      { ...config, shiftChecklist: [...config.shiftChecklist, nextItem] },
      "Added checklist card."
    );
    setNewCheckLabel("");
  };

  // Switch operation mode
  const handleOperationModeChange = async (
    mode: RestaurantInventoryConfig["operationType"]
  ) => {
    await persistInventoryConfig(
      { ...config, operationType: mode },
      `Switched kitchen style to ${
        mode === "food_truck_commissary"
          ? "Food Truck / Mobile Suya & Jollof Van + Store"
          : mode === "hybrid"
          ? "Restaurant + Outdoor Party Catering"
          : "Sit-Down Restaurant / Bukka Kitchen"
      }.`
    );
  };

  // Summary metrics
  const lowStockItems = config.items.filter(
    (i) => i.currentStock > 0 && i.currentStock <= i.reorderPoint
  );
  const depletedItems = config.items.filter((i) => i.currentStock <= 0);
  const healthyItems = config.items.filter(
    (i) => i.currentStock > i.reorderPoint
  );
  const totalActiveInventoryValue = config.items.reduce(
    (sum, i) => sum + i.currentStock * i.unitCost,
    0
  );
  const totalCommissaryValue = config.items.reduce(
    (sum, i) => sum + i.commissaryStock * i.unitCost,
    0
  );
  const totalWasteLoss = config.wasteLogs.reduce(
    (sum, w) => sum + w.costImpact,
    0
  );

  // Reserved recurring / scheduled order demand per dish
  const reservedDemandByDishId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sr of scheduledReorders) {
      if (sr.status !== "active") continue;
      for (const line of sr.items) {
        map[line.menuItemId] = (map[line.menuItemId] || 0) + line.quantity;
      }
    }
    return map;
  }, [scheduledReorders]);

  // Filtered ingredients
  const filteredItems = config.items.filter((it) => {
    const matchesCat =
      categoryFilter === "ALL" || it.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      it.name.toLowerCase().includes(q) ||
      it.sku.toLowerCase().includes(q) ||
      it.storageLocation.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* HEADER BANNER WITH 1-CLICK NIGERIAN / AFRICAN SAMPLE PACK LOADER       */}
      {/* ===================================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                🇳🇬 Easy Kitchen, Bukka & Food Truck Stock Cards
              </span>
              <button
                type="button"
                onClick={() => setShowSimpleGuide(!showSimpleGuide)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white"
              >
                <HelpCircle className="h-3 w-3 text-orange-400" />
                {showSimpleGuide ? "Hide Simple Guide" : "Show How It Works"}
              </button>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">
              {restaurant.name} — Simple Kitchen Pots, Meat & Store Tracker
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              See what is remaining in your pots & coolers at a glance, refill
              from your Main Store in 1 click, and automatically stop online
              orders when **Jollof Rice, Asun, Egusi, Plantain (Dodo)** or
              **Moi-Moi** finishes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={config.operationType}
              onChange={(e) =>
                handleOperationModeChange(
                  e.target.value as RestaurantInventoryConfig["operationType"]
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="food_truck_commissary">
                🚚 Food Truck / Suya & Jollof Van + Store
              </option>
              <option value="restaurant_kitchen">
                🍲 Sit-Down Restaurant / Bukka Kitchen
              </option>
              <option value="hybrid">
                🎉 Restaurant + Party / Owambe Catering
              </option>
            </select>

            <button
              type="button"
              disabled={saving}
              onClick={handleLoadNigerianSamplePack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              🇳🇬 Load Nigerian Food Examples
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleRestockAllToPar}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 transition shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refill All Pots to Full Target
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MULTI-CARD ROW 1: 3 SIMPLE EXPLAINER CARDS (NIGERIAN EXAMPLES)     */}
        {/* ================================================================= */}
        {showSimpleGuide && (
          <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-xs font-extrabold">
                  1
                </span>
                <span>One Shared Pot Feeds Many Dishes</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Example: Your **Peppered Goat Meat (Asun)** and **Fried Plantain
                (Dodo)** are shared across *Party Jollof Combo*, *Fried Rice
                Special*, and *Swallow + Egusi*. When a customer buys a **Big
                Family Tray (2×)**, 2 portions are deducted automatically.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-extrabold">
                  2
                </span>
                <span>Auto-Stop When Food Finishes (Auto-86)</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Example: If **Moi-Moi** or **Egusi Soup** reaches **0** during
                lunch rush, the website immediately marks dishes using it as{" "}
                <span className="text-rose-300 font-semibold">Sold Out</span> so
                customers don&apos;t pay for food that has finished in the pot.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-extrabold">
                  3
                </span>
                <span>Main Store → Kitchen / Truck Refill</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Example: Keep extra bags of rice, frozen goat meat, takeaway
                packs & **12.5kg Cooking Gas** in your **Main Store**. Tap{" "}
                <span className="text-sky-300 font-semibold">
                  &quot;Refill from Store&quot;
                </span>{" "}
                on any card to top up your kitchen line or food truck.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MULTI-CARD ROW 2: 4 SIMPLE SUMMARY CARDS                              */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <span>✅ Plenty in Kitchen</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-white">
            {healthyItems.length} Items Ready
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Kitchen Stock Value:{" "}
            <span className="font-mono font-semibold text-emerald-300">
              ${totalActiveInventoryValue.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span>⚠️ Running Low / Finished</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-amber-300">
              {lowStockItems.length} Low
            </span>
            <span className="text-sm font-bold font-mono text-rose-400">
              • {depletedItems.length} Finished (0)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Tap &quot;Refill from Store&quot; on low cards below
          </div>
        </div>

        <div className="rounded-2xl border border-sky-500/30 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
            <span>🏭 Main Store / Freezer Backup</span>
            <Truck className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-white">
            ${totalCommissaryValue.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Extra bags of rice, meat, gas & takeaway packs
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/30 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
            <span>🔥 Spoilage / Burnt / Leftovers</span>
            <Flame className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-rose-300">
            ${totalWasteLoss.toFixed(2)} Lost
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {config.wasteLogs.length} kitchen waste records logged
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SIMPLE 4-STEP NAVIGATION BAR                                          */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              id: "ingredients",
              title: "1. Kitchen & Store Stock Cards",
              sub: "Jollof base, Asun, Egusi, Dodo, Packs & Gas",
              badge: `${config.items.length} Cards`,
              icon: Package,
            },
            {
              id: "batches",
              title: "2. Daily Dish Portion Cards",
              sub: "How many plates of each dish remain today",
              badge: `${menuItems.length} Dishes`,
              icon: Utensils,
            },
            {
              id: "cogs",
              title: "3. Profit per Plate & Big Tray (2×)",
              sub: "Cost to cook + takeaway pack vs selling price",
              badge: `${config.targetFoodCostPercent}% Cost Goal`,
              icon: DollarSign,
            },
            {
              id: "waste_checklist",
              title: "4. Spoilage Log & Morning Checklist",
              sub: "Track burnt/spoiled food & morning checks",
              badge: `${
                config.shiftChecklist.filter((c) => c.checked).length
              }/${config.shiftChecklist.length} Done`,
              icon: ClipboardCheck,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                active
                  ? "border-orange-500 bg-orange-500/15 text-white shadow-lg shadow-orange-500/10"
                  : "border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-white">
                  <Icon
                    className={`h-4 w-4 ${
                      active ? "text-orange-400" : "text-slate-400"
                    }`}
                  />
                  {tab.title}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                    active
                      ? "bg-orange-500 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">{tab.sub}</p>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: MULTI-CARD ROWS FOR KITCHEN & TRUCK STOCK ITEMS            */}
      {/* ===================================================================== */}
      {subTab === "ingredients" && (
        <div className="space-y-5">
          {/* Quick-Add Nigerian / African Staple Row (Multi-Card Roll) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-300">
                  ⚡ 1-Click Add Popular African / Nigerian Kitchen Stock Cards
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tap any card below to immediately add that item to your
                  kitchen stock roll, or click &quot;+ Custom Stock Card&quot;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewItemForm(!showNewItemForm)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                {showNewItemForm ? "Close Form" : "+ Custom Stock Card"}
              </button>
            </div>

            {/* Horizontal Multi-Card Roll of Nigerian Templates */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {NIGERIAN_QUICK_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.sku}
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/90 p-3 hover:border-orange-500/40 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-orange-300">
                        {CATEGORY_LABELS[tpl.category]}
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400">
                        ${tpl.unitCost.toFixed(2)} / {tpl.unit}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-white">
                      {tpl.name}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {tpl.exampleNote}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickAddTemplate(tpl)}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 py-1.5 text-[11px] font-bold text-orange-300 hover:bg-orange-500/20 transition"
                  >
                    <Plus className="h-3 w-3" /> Add Card ({tpl.parLevel}{" "}
                    {tpl.unit})
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Add Item Form */}
          {showNewItemForm && (
            <form
              onSubmit={handleCreateInventoryItem}
              className="rounded-2xl border border-orange-500/40 bg-slate-900/95 p-5 space-y-4 shadow-xl"
            >
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">
                  Create Custom Kitchen / Store Stock Card
                </h3>
                <p className="text-xs text-slate-400">
                  Example: &quot;Ofada Sauce (Ayamase) Pot&quot;, &quot;Fresh
                  Catfish (Point & Kill)&quot;, &quot;Pounded Yam Tubers&quot;,
                  or &quot;Takeaway Packs&quot;.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g., Ayamase Ofada Designer Stew"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Food / Supply Group
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) =>
                      setNewItemCategory(e.target.value as InventoryCategory)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {(Object.keys(CATEGORY_LABELS) as InventoryCategory[]).map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Where Is It Kept?
                  </label>
                  <select
                    value={newItemLocation}
                    onChange={(e) =>
                      setNewItemLocation(
                        e.target.value as InventoryStorageLocation
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {(
                      Object.keys(
                        STORAGE_LABELS
                      ) as InventoryStorageLocation[]
                    ).map((loc) => (
                      <option key={loc} value={loc}>
                        {STORAGE_LABELS[loc]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Counting Unit & Market Supplier
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      placeholder="scoops, wraps, bowls..."
                      className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={newItemSupplier}
                      onChange={(e) => setNewItemSupplier(e.target.value)}
                      placeholder="Market / Supplier"
                      className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    In Kitchen / Truck Now
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newItemCurrentStock}
                    onChange={(e) =>
                      setNewItemCurrentStock(parseFloat(e.target.value) || 0)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Full Daily Target (Par)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newItemParLevel}
                    onChange={(e) =>
                      setNewItemParLevel(parseFloat(e.target.value) || 1)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Backup in Main Store / Freezer
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newItemCommissaryStock}
                    onChange={(e) =>
                      setNewItemCommissaryStock(parseFloat(e.target.value) || 0)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Low Warning Point & Cost per Unit ($)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      value={newItemReorderPoint}
                      onChange={(e) =>
                        setNewItemReorderPoint(parseFloat(e.target.value) || 0)
                      }
                      placeholder="Low warning"
                      className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-mono text-amber-300"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={newItemUnitCost}
                      onChange={(e) =>
                        setNewItemUnitCost(parseFloat(e.target.value) || 0)
                      }
                      placeholder="$ Cost"
                      className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-mono text-emerald-300"
                    />
                  </div>
                </div>
              </div>

              {/* Link to Menu Dishes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Which Menu Dishes Use This Item? (Tap to select):
                </label>
                <div className="flex flex-wrap gap-2">
                  {menuItems.map((dish) => {
                    const checked = newItemLinkedMenuIds.includes(dish.id);
                    return (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() =>
                          setNewItemLinkedMenuIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== dish.id)
                              : [...prev, dish.id]
                          )
                        }
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                          checked
                            ? "border-orange-500 bg-orange-500/20 text-orange-200"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                        }`}
                      >
                        {checked ? "✓ " : "+ "}
                        {dish.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newItemAuto86}
                    onChange={(e) => setNewItemAuto86(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-orange-500"
                  />
                  <span>
                    Automatically mark linked dishes &quot;Sold Out&quot; when
                    this item finishes (0 left)
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewItemForm(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Stock Card
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Filter Pills + Search */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  categoryFilter === "ALL"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                All Cards ({config.items.length})
              </button>
              {(Object.keys(CATEGORY_LABELS) as InventoryCategory[]).map(
                (cat) => {
                  const count = config.items.filter(
                    (i) => i.category === cat
                  ).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        categoryFilter === cat
                          ? "bg-orange-500 text-white"
                          : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]} ({count})
                    </button>
                  );
                }
              )}
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Jollof, Asun, Egusi, Gas..."
              className="w-full lg:w-64 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* =============================================================== */}
          {/* MULTI-CARD GRID ROW FOR ALL INVENTORY ITEMS (3 CARDS PER ROW)   */}
          {/* =============================================================== */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const pct =
                item.parLevel > 0
                  ? Math.min(
                      100,
                      Math.round((item.currentStock / item.parLevel) * 100)
                    )
                  : 100;
              const isOut = item.currentStock <= 0;
              const isLow = !isOut && item.currentStock <= item.reorderPoint;
              const linkedDishes = menuItems.filter((m) =>
                item.linkedMenuItemIds.includes(m.id)
              );

              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition shadow-md ${
                    isOut
                      ? "border-rose-500/60 bg-rose-950/20"
                      : isLow
                      ? "border-amber-500/50 bg-amber-950/15"
                      : "border-slate-800 bg-slate-900/95 hover:border-slate-700"
                  }`}
                >
                  {/* Top of Card: Status Badge + Delete */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isOut
                            ? "bg-rose-500/25 text-rose-200 border border-rose-500/40"
                            : isLow
                            ? "bg-amber-500/25 text-amber-200 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {isOut
                          ? "🛑 Finished in Kitchen (0 Left)"
                          : isLow
                          ? "⚠️ Running Low — Refill Soon"
                          : "✅ Plenty in Kitchen"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteInventoryItem(item.id, item.name)
                        }
                        className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Remove card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Item Title & Category */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">
                        {CATEGORY_LABELS[item.category]} •{" "}
                        {STORAGE_LABELS[item.storageLocation]}
                      </div>
                      <h3 className="mt-0.5 text-base font-bold text-white leading-snug">
                        {item.name}
                      </h3>
                    </div>

                    {/* 3 Simple Number Boxes Inside the Card */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">
                          In Kitchen Now
                        </div>
                        <div
                          className={`mt-0.5 font-mono text-base font-extrabold ${
                            isOut
                              ? "text-rose-400"
                              : isLow
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {item.currentStock}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate">
                          {item.unit}
                        </div>
                      </div>

                      <div className="border-x border-slate-800/80 px-1">
                        <div className="text-[10px] text-slate-400">
                          Daily Target
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-white">
                          {item.parLevel}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          Full Pot/Par
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400">
                          Store Backup
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-sky-300">
                          {item.commissaryStock}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          In Store
                        </div>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          Cost:{" "}
                          <strong className="font-mono text-emerald-300">
                            ${item.unitCost.toFixed(2)}
                          </strong>{" "}
                          / {item.unit}
                        </span>
                        <span className="font-mono text-slate-300">
                          {pct}% Full
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                        <div
                          className={`h-full transition-all ${
                            isOut
                              ? "bg-rose-500"
                              : isLow
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Linked Menu Dishes Pills */}
                    <div className="min-h-[38px]">
                      {linkedDishes.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-slate-400">
                            Used in:
                          </span>
                          {linkedDishes.map((d) => (
                            <span
                              key={d.id}
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                d.available
                                  ? "border border-slate-700 bg-slate-950 text-slate-200"
                                  : "border border-rose-500/40 bg-rose-500/15 text-rose-300 line-through"
                              }`}
                            >
                              {d.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500">
                          General kitchen / truck utility ({item.supplierName})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom of Card: Quick Adjust & 1-Click Store Refill */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAdjustStock(item, -5)}
                        className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-xs font-bold text-slate-300 hover:border-rose-500/50 hover:text-rose-300"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustStock(item, -1)}
                        className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-xs font-bold text-slate-300 hover:border-rose-500/50 hover:text-rose-300"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustStock(item, 1)}
                        className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-xs font-bold text-emerald-300 hover:border-emerald-500/50"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustStock(item, 10)}
                        className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-xs font-bold text-emerald-300 hover:border-emerald-500/50"
                      >
                        +10
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTransferFromCommissary(item)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/25 transition"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      <span>Refill Kitchen from Store Backup</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: MULTI-CARD ROWS FOR DAILY DISH POTS & PORTIONS             */}
      {/* ===================================================================== */}
      {subTab === "batches" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                🍲 Daily Dish Portion Cards & Pre-Order Protection
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Set how many plates of each dish you cooked for today. Any
                scheduled pre-orders are separated so walk-in customers
                don&apos;t finish food meant for scheduled pickups.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleMorningBatchResetAllDishes}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              🌅 Reset All Dish Pots for New Morning Shift
            </button>
          </div>

          {/* 3-Card Row Grid for Menu Dishes */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {menuItems.map((dish) => {
              const dailyLimit = dish.dailyStockLimit ?? 0;
              const currentCount = dish.currentStockCount ?? dailyLimit;
              const reservedQty = reservedDemandByDishId[dish.id] || 0;
              const walkInSafeStock = Math.max(0, currentCount - reservedQty);
              const sharedIngredients = config.items.filter((i) =>
                i.linkedMenuItemIds.includes(dish.id)
              );

              return (
                <div
                  key={dish.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 space-y-3 ${
                    !dish.available
                      ? "border-rose-500/50 bg-rose-950/15"
                      : "border-slate-800 bg-slate-900/95"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                          {dish.category}
                        </span>
                        <h4 className="mt-1 text-base font-bold text-white">
                          {dish.name}
                        </h4>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          dish.available
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {dish.available ? "✅ Selling Now" : "🛑 Sold Out"}
                      </span>
                    </div>

                    {/* 3 Simple Boxes */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Left in Pot
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-white">
                          {dailyLimit > 0
                            ? `${currentCount}/${dailyLimit}`
                            : "∞"}
                        </div>
                      </div>
                      <div className="border-x border-slate-800">
                        <div className="text-[10px] text-slate-400">
                          Booked Orders
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-sky-300">
                          {reservedQty}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Walk-In Safe
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-emerald-300">
                          {dailyLimit > 0 ? walkInSafeStock : "∞"}
                        </div>
                      </div>
                    </div>

                    {/* Shared Ingredients Used */}
                    {sharedIngredients.length > 0 && (
                      <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-[11px]">
                        <div className="text-slate-400 mb-1">
                          Pulls from shared kitchen stock:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {sharedIngredients.map((ing) => (
                            <span
                              key={ing.id}
                              className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                            >
                              {ing.name} ({ing.currentStock} left)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Controls */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] text-slate-400">
                        Set Daily Pot Size:
                      </span>
                      <div className="flex items-center gap-1">
                        {[20, 35, 50, 80].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              handleUpdateDishBatchStock(dish, preset, preset)
                            }
                            className={`rounded-lg border px-2 py-1 font-mono text-[11px] font-bold ${
                              dailyLimit === preset
                                ? "border-orange-500 bg-orange-500/20 text-orange-300"
                                : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDishBatchStock(
                            dish,
                            Math.max(0, currentCount - 1),
                            dailyLimit || 25
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-xs font-bold text-slate-300 hover:text-rose-300"
                      >
                        -1 Plate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDishBatchStock(
                            dish,
                            currentCount + 1,
                            dailyLimit || 25
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-xs font-bold text-emerald-300"
                      >
                        +1 Plate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDishBatchStock(
                            dish,
                            dailyLimit > 0 ? dailyLimit : 35,
                            dailyLimit > 0 ? dailyLimit : 35
                          )
                        }
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        Refill Pot
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: MULTI-CARD ROWS FOR PROFIT PER PLATE & BIG TRAY (2×)       */}
      {/* ===================================================================== */}
      {subTab === "cogs" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
            <h3 className="text-base font-bold text-white">
              💰 Simple Profit per Plate & Party Tray (2×) Margin Cards
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Every card shows how much it costs you to cook & pack one plate
              (e.g., **Jollof + Asun + Dodo + Takeaway Pack**), how much profit
              you keep in your pocket, and how much you make on a **Big /
              Shareable (2×) Tray**.
            </p>
          </div>

          {/* 3-Card Row Grid for Dish Profit Breakdown */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {menuItems.map((dish) => {
              const linkedIng = config.items.filter((i) =>
                i.linkedMenuItemIds.includes(dish.id)
              );
              const packagingCost =
                config.items.find(
                  (i) => i.category === "Packaging & Disposables"
                )?.unitCost || 0.4;
              const rawIngCost =
                linkedIng.length > 0
                  ? linkedIng.reduce((s, i) => s + i.unitCost, 0)
                  : dish.price * 0.26;
              const plateCogs = Number(
                (rawIngCost + packagingCost).toFixed(2)
              );
              const grossProfit = Number((dish.price - plateCogs).toFixed(2));
              const cogsPct =
                dish.price > 0
                  ? Number(((plateCogs / dish.price) * 100).toFixed(1))
                  : 0;
              const overTarget = cogsPct > config.targetFoodCostPercent;

              const variantGroup = dish.modifiers?.find((g) =>
                /size|portion|preparation|style|variant/i.test(g.name)
              );
              const largeOpt =
                variantGroup?.options[variantGroup.options.length - 1];
              const largePrice = dish.price + (largeOpt?.priceDelta || 6);
              const largeCogs = Number(
                (rawIngCost * 1.85 + packagingCost).toFixed(2)
              );
              const largeProfit = Number((largePrice - largeCogs).toFixed(2));

              return (
                <div
                  key={dish.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/95 p-4 space-y-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {dish.category}
                        </span>
                        <h4 className="text-base font-bold text-white">
                          {dish.name}
                        </h4>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                          overTarget
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {cogsPct}% Food Cost{" "}
                        {overTarget ? "⚠️ High Cost" : "✓ Good Profit"}
                      </span>
                    </div>

                    {/* 3 Simple Money Boxes */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Selling Price
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-white">
                          ${dish.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="border-x border-slate-800">
                        <div className="text-[10px] text-slate-400">
                          Cost + Pack
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-amber-300">
                          -${plateCogs.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">
                          Your Profit
                        </div>
                        <div className="mt-0.5 font-mono text-base font-extrabold text-emerald-400">
                          +${grossProfit.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Ingredients Breakdown */}
                    <div className="space-y-1 text-xs">
                      <div className="text-[11px] font-semibold text-slate-400">
                        What goes into this plate:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {linkedIng.map((ing) => (
                          <span
                            key={ing.id}
                            className="rounded-md bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                          >
                            {ing.name} (${ing.unitCost.toFixed(2)})
                          </span>
                        ))}
                        <span className="rounded-md bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          + Takeaway Pack (${packagingCost.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Big Tray / 2x Variant Box */}
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-2.5 text-xs">
                    <div className="flex items-center justify-between font-semibold text-orange-200">
                      <span>
                        🍱 {largeOpt?.label || "Big / Family Tray (2×)"}
                      </span>
                      <span className="font-mono">
                        Sells ${largePrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Deducts 2× portions from pot</span>
                      <span className="font-mono font-bold text-emerald-300">
                        Profit: +${largeProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: SPOILAGE / LEFTOVER CARDS & MORNING CHECKLIST CARDS        */}
      {/* ===================================================================== */}
      {subTab === "waste_checklist" && (
        <div className="space-y-6">
          {/* Top Multi-Card Row: Record Spoilage Form + Morning Checklist Adder */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left Card: Record Spoiled / Burnt / Leftover Food */}
            <form
              onSubmit={handleLogWaste}
              className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-white">
                  🔥 Record Spoiled, Burnt or Unsold Night Leftovers
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Example: Burnt bottom Jollof pot, over-ripe Plantain (Dodo),
                  or soup that soured due to freezer/generator issue.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Which Food / Supply?
                  </label>
                  <select
                    value={wasteItemId}
                    onChange={(e) => setWasteItemId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {config.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.currentStock} {it.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    How Many & What Happened?
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={wasteQty}
                      onChange={(e) =>
                        setWasteQty(
                          Math.max(0.5, parseFloat(e.target.value) || 1)
                        )
                      }
                      className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-mono text-white"
                    />
                    <select
                      value={wasteReason}
                      onChange={(e) =>
                        setWasteReason(
                          e.target.value as WasteLogEntry["reason"]
                        )
                      }
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                    >
                      <option value="Expired / Spoilage (FIFO)">
                        ⏰ Spoiled / Leftover Overnight
                      </option>
                      <option value="Line Cook Burn / Overcooked">
                        🔥 Burnt Pot / Overcooked
                      </option>
                      <option value="Dropped / Spilled">
                        🔪 Spilled in Kitchen / Truck
                      </option>
                      <option value="Customer Comp / Remake">
                        🔄 Customer Remake / Replacement
                      </option>
                      <option value="Portion Creep Adjustment">
                        ⚖️ Extra Large Scoops Adjustment
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={wasteLoggedBy}
                  onChange={(e) => setWasteLoggedBy(e.target.value)}
                  placeholder="Staff Name (e.g., Chef Tunde)"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 transition"
                >
                  Record Waste & Deduct
                </button>
              </div>
            </form>

            {/* Right Card: Add Morning Kitchen / Food Truck Check */}
            <form
              onSubmit={handleAddChecklistItem}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/95 p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-white">
                  🚚 Morning Kitchen & Food Truck Opening Check Cards
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Make sure staff check the **12.5kg Cooking Gas cylinder**,
                  **Generator diesel**, **Takeaway packs**, and **Stew/Egusi
                  freshness** before opening.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={newCheckLabel}
                  onChange={(e) => setNewCheckLabel(e.target.value)}
                  placeholder="e.g., Check Suya charcoal & Yaji spice..."
                  className="sm:col-span-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <select
                  value={newCheckCategory}
                  onChange={(e) =>
                    setNewCheckCategory(
                      e.target.value as ShiftLoadoutCheckItem["category"]
                    )
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                >
                  <option value="Kitchen Prep">🍲 Kitchen Prep</option>
                  <option value="Packaging">📦 Takeaway Packs</option>
                  <option value="Food Truck Ops">⛽ Gas & Truck</option>
                  <option value="Safety & FIFO">❄️ Cooler & FIFO</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition"
              >
                + Add Morning Check Card
              </button>
            </form>
          </div>

          {/* Multi-Card Row: Morning Checklist Cards (3 per row) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              ✅ Morning Opening Checklist Cards (Tap any card to mark done)
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {config.shiftChecklist.map((chk) => (
                <button
                  key={chk.id}
                  type="button"
                  onClick={() => handleToggleChecklist(chk.id)}
                  className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                    chk.checked
                      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                      : "border-slate-800 bg-slate-900/95 text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-slate-950 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-400">
                      {chk.category}
                    </span>
                    <CheckCircle2
                      className={`h-5 w-5 shrink-0 ${
                        chk.checked ? "text-emerald-400" : "text-slate-600"
                      }`}
                    />
                  </div>
                  <p
                    className={`mt-2.5 text-xs font-semibold leading-relaxed ${
                      chk.checked ? "line-through text-emerald-300/80" : "text-white"
                    }`}
                  >
                    {chk.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Multi-Card Row: Recent Waste & Spoilage Cards (3 per row) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              📉 Recent Spoilage / Burnt / Leftover Cards
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {config.wasteLogs.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/95 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      {w.reason}
                    </span>
                    <span className="font-mono text-sm font-extrabold text-rose-400">
                      -${w.costImpact.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-white">
                    {w.inventoryItemName}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Lost: {w.quantity} {w.unit}
                    </span>
                    <span>By {w.loggedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerInventoryManager;
