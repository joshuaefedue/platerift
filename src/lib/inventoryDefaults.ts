import type {
  InventoryItem,
  RestaurantInventoryConfig,
  ShiftLoadoutCheckItem,
  WasteLogEntry,
} from "./types";

export function buildNigerianAfricanInventoryConfig(
  linkedDishIds: string[] = []
): RestaurantInventoryConfig {
  const nowIso = new Date().toISOString();
  const d1 = linkedDishIds[0] || "item_bn_1";
  const d2 = linkedDishIds[1] || "item_bn_2";
  const d3 = linkedDishIds[2] || "item_bn_3";
  const d4 = linkedDishIds[3] || "item_bn_4";

  const shiftChecklist: ShiftLoadoutCheckItem[] = [
    {
      id: "chk_ng_1",
      label:
        "Morning Pot Check: Taste & check freshness of Stew Base, Egusi & Efo Riro in cooler (FIFO)",
      category: "Safety & FIFO",
      checked: true,
    },
    {
      id: "chk_ng_2",
      label:
        "Parboil Rice & Prep Smoky Party Jollof / Fried Rice base before 11:00 AM lunch rush",
      category: "Kitchen Prep",
      checked: true,
    },
    {
      id: "chk_ng_3",
      label:
        "Season & par-boil Goat Meat (Asun), Assorted Meat (Shaki, Kpomo) & Suya Beef Skewers",
      category: "Kitchen Prep",
      checked: true,
    },
    {
      id: "chk_ng_4",
      label:
        "Count Takeaway Packs, Soup Bowls, Nylon Bags & Moi-Moi Foil/Uma Leaves at counter",
      category: "Packaging",
      checked: true,
    },
    {
      id: "chk_ng_5",
      label:
        "Food Truck / Bukka Grill: Check 12.5kg Cooking Gas Cylinder, Suya Charcoal & Generator Fuel",
      category: "Food Truck Ops",
      checked: false,
    },
  ];

  const items: InventoryItem[] = [
    {
      id: "inv_ng_1",
      name: "Smoky Party Jollof Rice & Firewood Tomato-Ata Rodo Base",
      sku: "NG-JOL-BASE",
      category: "Dough, Grains & Dry",
      storageLocation: "Line Prep Station",
      unit: "portions (scoops)",
      currentStock: 65,
      commissaryStock: 180,
      parLevel: 90,
      reorderPoint: 20,
      unitCost: 1.35,
      shelfLifeHours: 36,
      supplierName: "Mile 12 Market Bulk Grains & Peppers",
      linkedMenuItemIds: [d1, d2].filter(Boolean),
      auto86LinkedDishes: true,
      wasteCountToday: 2,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_2",
      name: "Peppered Goat Meat (Asun), Shaki & Kpomo (Assorted Meat)",
      sku: "NG-PROT-ASUN",
      category: "Protein & Seafood",
      storageLocation: "Line Prep Station",
      unit: "meat portions",
      currentStock: 14,
      commissaryStock: 75,
      parLevel: 60,
      reorderPoint: 15,
      unitCost: 3.4,
      shelfLifeHours: 48,
      supplierName: "Lagos Abattoir Fresh Butcher Supply",
      linkedMenuItemIds: [d1, d3].filter(Boolean),
      auto86LinkedDishes: true,
      wasteCountToday: 0,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_3",
      name: "Suya Spiced Beef Sirloin Skewers & Yaji Groundnut Rub",
      sku: "NG-PROT-SUYA",
      category: "Protein & Seafood",
      storageLocation: "On-Truck Cooler",
      unit: "skewers",
      currentStock: 38,
      commissaryStock: 110,
      parLevel: 70,
      reorderPoint: 15,
      unitCost: 2.5,
      shelfLifeHours: 36,
      supplierName: "Arewa Mai-Suya Grill Commissary",
      linkedMenuItemIds: [d2, d4].filter(Boolean),
      auto86LinkedDishes: true,
      wasteCountToday: 1,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_4",
      name: "Egusi (Melon Seed) & Efo Riro Fluted Pumpkin Soup Pot",
      sku: "NG-SOUP-EGU",
      category: "Sauces & Prep Batches",
      storageLocation: "Line Prep Station",
      unit: "soup bowls",
      currentStock: 28,
      commissaryStock: 60,
      parLevel: 45,
      reorderPoint: 10,
      unitCost: 2.8,
      shelfLifeHours: 36,
      supplierName: "Oyingbo Market Fresh Leaf & Melon",
      linkedMenuItemIds: [d3, d4].filter(Boolean),
      auto86LinkedDishes: true,
      wasteCountToday: 1,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_5",
      name: "Ripe Sweet Plantain (Dodo) & Pounded Yam / Amala Swallow Wraps",
      sku: "NG-PROD-DODO",
      category: "Produce & Dairy",
      storageLocation: "Walk-In / Commissary",
      unit: "portions",
      currentStock: 9,
      commissaryStock: 95,
      parLevel: 60,
      reorderPoint: 15,
      unitCost: 0.95,
      shelfLifeHours: 48,
      supplierName: "Benue Yam & Plantain Direct Farm",
      linkedMenuItemIds: [d1, d2, d3].filter(Boolean),
      auto86LinkedDishes: true,
      wasteCountToday: 2,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_6",
      name: "Steamed Bean Pudding (Moi-Moi) & Leaf / Foil Containers",
      sku: "NG-PREP-MOI",
      category: "Sauces & Prep Batches",
      storageLocation: "Line Prep Station",
      unit: "wraps",
      currentStock: 0,
      commissaryStock: 45,
      parLevel: 40,
      reorderPoint: 10,
      unitCost: 1.1,
      shelfLifeHours: 24,
      supplierName: "In-House Morning Steamer Batch",
      linkedMenuItemIds: [d4].filter(Boolean),
      auto86LinkedDishes: true,
      wasteCountToday: 0,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_7",
      name: "Insulated Jollof Takeaway Packs & Leak-Proof Soup Bowls",
      sku: "NG-PKG-PACK",
      category: "Packaging & Disposables",
      storageLocation: "Dry Storage",
      unit: "packs",
      currentStock: 85,
      commissaryStock: 400,
      parLevel: 150,
      reorderPoint: 35,
      unitCost: 0.4,
      shelfLifeHours: 8760,
      supplierName: "Eko Pack & Disposables Ltd",
      linkedMenuItemIds: [d1, d2, d3, d4].filter(Boolean),
      auto86LinkedDishes: false,
      wasteCountToday: 0,
      lastRestockedAt: nowIso,
    },
    {
      id: "inv_ng_8",
      name: "12.5kg Cooking Gas (LPG), Suya Charcoal & Generator Fuel",
      sku: "NG-TRK-GAS",
      category: "Truck Fuel & Supplies",
      storageLocation: "On-Truck Cooler",
      unit: "cylinders / kegs",
      currentStock: 3,
      commissaryStock: 8,
      parLevel: 5,
      reorderPoint: 2,
      unitCost: 18.0,
      shelfLifeHours: 8760,
      supplierName: "NaijaGas & Mobile Kitchen Power",
      linkedMenuItemIds: [],
      auto86LinkedDishes: false,
      wasteCountToday: 0,
      lastRestockedAt: nowIso,
    },
  ];

  const wasteLogs: WasteLogEntry[] = [
    {
      id: "waste_ng_1",
      inventoryItemId: "inv_ng_1",
      inventoryItemName:
        "Smoky Party Jollof Rice & Firewood Tomato-Ata Rodo Base",
      quantity: 2,
      unit: "portions (scoops)",
      costImpact: 2.7,
      reason: "Line Cook Burn / Overcooked",
      loggedBy: "Chef Tunde Bakare",
      createdAt: "2026-11-06T09:15:00.000Z",
    },
    {
      id: "waste_ng_2",
      inventoryItemId: "inv_ng_5",
      inventoryItemName:
        "Ripe Sweet Plantain (Dodo) & Pounded Yam / Amala Swallow Wraps",
      quantity: 2,
      unit: "portions",
      costImpact: 1.9,
      reason: "Expired / Spoilage (FIFO)",
      loggedBy: "Madam Ngozi (Kitchen Lead)",
      createdAt: "2026-11-06T10:00:00.000Z",
    },
  ];

  return {
    operationType: "food_truck_commissary",
    lowStockAlertsEnabled: true,
    autoDeductOnOrder: true,
    targetFoodCostPercent: 30,
    items,
    wasteLogs,
    shiftChecklist,
  };
}

export function buildDefaultInventoryConfig(tenant: {
  id?: string;
  slug: string;
  name: string;
  cuisine: string;
}): RestaurantInventoryConfig {
  const slug = (tenant.slug || "").toLowerCase();
  const isBella = slug.includes("bella") || (tenant.id || "").includes("bella");
  const isSakura =
    slug.includes("sakura") || (tenant.id || "").includes("sakura");
  const isFuego = slug.includes("fuego") || (tenant.id || "").includes("fuego");

  const defaultDishIds = isBella
    ? ["item_bn_1", "item_bn_2", "item_bn_3", "item_bn_4"]
    : isSakura
    ? ["item_sk_1", "item_sk_2", "item_sk_3", "item_sk_4"]
    : isFuego
    ? ["item_fg_1", "item_fg_2", "item_fg_3", "item_fg_4"]
    : [];

  return buildNigerianAfricanInventoryConfig(defaultDishIds);
}
