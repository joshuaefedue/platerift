import type { MenuModifierGroup } from "./types";

const ITEM_SPECIFIC_VARIANTS_AND_SIDES: Record<
  string,
  { variantGroup: MenuModifierGroup; sideGroup: MenuModifierGroup }
> = {
  item_bn_1: {
    variantGroup: {
      name: "Crust & Size Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: 'Traditional 12" Sourdough Crust', priceDelta: 0 },
        { label: '14" Grande Shareable Sourdough', priceDelta: 5.0 },
        { label: "Gluten-Free Cauliflower Crust", priceDelta: 4.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Wood-Fired Rosemary Focaccia", priceDelta: 4.5 },
        { label: "Baby Arugula & Shaved Parmigiano Salad", priceDelta: 5.5 },
        { label: "Truffle Parmigiano Garlic Knots (4 pcs)", priceDelta: 6.0 },
        { label: "Marinated Castelvetrano Olives", priceDelta: 4.0 },
      ],
    },
  },
  item_bn_2: {
    variantGroup: {
      name: "Crust & Size Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: 'Traditional 12" Sourdough Crust', priceDelta: 0 },
        { label: '14" Grande Shareable Sourdough', priceDelta: 5.5 },
        { label: "Gluten-Free Cauliflower Crust", priceDelta: 4.0 },
        { label: "Extra Spicy Calabrian Chili Rim", priceDelta: 2.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Caesar Insalata Piccola", priceDelta: 5.5 },
        { label: "Wood-Fired Rosemary Focaccia", priceDelta: 4.5 },
        { label: "Truffle Parmigiano Garlic Knots (4 pcs)", priceDelta: 6.0 },
        { label: "Whipped Ricotta & Calabrian Honey Dip", priceDelta: 4.5 },
      ],
    },
  },
  item_bn_3: {
    variantGroup: {
      name: "Portion & Pasta Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Classico Individual Portion", priceDelta: 0 },
        { label: "Tavola Shareable Double Portion", priceDelta: 9.0 },
        { label: "Gluten-Free Artisanal Tagliatelle", priceDelta: 3.5 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Charred Sourdough Garlic Bread", priceDelta: 4.5 },
        { label: "Heirloom Tomato & Burrata Insalata", priceDelta: 6.5 },
        { label: "Sautéed Wild Forest Mushrooms", priceDelta: 6.0 },
        { label: "Crispy Brussels Sprouts & Pancetta", priceDelta: 6.0 },
      ],
    },
  },
  item_bn_4: {
    variantGroup: {
      name: "Portion & Pasta Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Classico Individual Portion", priceDelta: 0 },
        { label: "Tavola Shareable Double Portion", priceDelta: 8.0 },
        { label: "Gluten-Free Bronze-Die Penne", priceDelta: 3.5 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Charred Sourdough Garlic Bread", priceDelta: 4.5 },
        { label: "Handmade Wagyu & Pork Meatballs (2 pcs)", priceDelta: 7.0 },
        { label: "Charred Broccolini with Garlic & Lemon", priceDelta: 5.5 },
        { label: "Baby Arugula & Lemon Insalata", priceDelta: 5.0 },
      ],
    },
  },
  item_bn_5: {
    variantGroup: {
      name: "Board Size & Style Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Per Due (Serves 1–2 Guests)", priceDelta: 0 },
        { label: "Famiglia Grande Board (Serves 3–4)", priceDelta: 11.0 },
        { label: "Vegetarian Caprese Board (No Prosciutto)", priceDelta: 0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Extra Basket of Warm Rosemary Focaccia", priceDelta: 4.5 },
        { label: "Truffle Honey & Roasted Fig Compote", priceDelta: 3.5 },
        { label: "Marinated Roman Artichoke Hearts", priceDelta: 5.0 },
        { label: "24-Month Aged Parmigiano Reggiano Cubes", priceDelta: 5.5 },
      ],
    },
  },
  item_bn_6: {
    variantGroup: {
      name: "Serving Size Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Classic Individual Cut", priceDelta: 0 },
        { label: "Double Shareable Cut", priceDelta: 6.5 },
        { label: "Decaf Espresso Soak Variant", priceDelta: 0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Scoop of Pistachio di Bronte Gelato", priceDelta: 4.5 },
        { label: "Scoop of Madagascar Vanilla Bean Gelato", priceDelta: 4.0 },
        { label: "Sicilian Almond Cantucci Biscotti (2 pcs)", priceDelta: 3.5 },
        { label: "Fresh Berries & Marsala Chantilly Cream", priceDelta: 4.0 },
      ],
    },
  },

  // Sakura Izakaya & Sushi
  item_sk_1: {
    variantGroup: {
      name: "Omakase Tier & Shoyu Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "12-Piece Signature Omakase (House Aged Shoyu)", priceDelta: 0 },
        { label: "12-Piece Signature Omakase (Gluten-Free Tamari)", priceDelta: 1.0 },
        { label: "16-Piece Imperial Reserve (+A5 Wagyu & Uni)", priceDelta: 24.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Akadashi Red Miso Soup with Nameko Mushrooms", priceDelta: 4.0 },
        { label: "Truffle Sea-Salt Steamed Edamame", priceDelta: 5.0 },
        { label: "Wakame Seaweed & Cucumber Sunomono Salad", priceDelta: 5.5 },
        { label: "Crispy Prawn & Seasonal Vegetable Tempura", priceDelta: 7.5 },
      ],
    },
  },
  item_sk_2: {
    variantGroup: {
      name: "Roll Cut & Wrapper Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "8-Piece Traditional Crispy Nori Cut", priceDelta: 0 },
        { label: "10-Piece Chef's Deluxe Cut (+Extra Unagi)", priceDelta: 5.5 },
        { label: "Sesame Soy Paper Wrap Variant", priceDelta: 2.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Traditional Tofu & Scallion Miso Soup", priceDelta: 3.5 },
        { label: "Spicy Garlic Charred Edamame", priceDelta: 5.0 },
        { label: "Pan-Seared Kurobuta Pork Gyoza (4 pcs)", priceDelta: 6.5 },
        { label: "Wakame Seaweed Salad", priceDelta: 5.0 },
      ],
    },
  },
  item_sk_3: {
    variantGroup: {
      name: "Broth Spice & Noodle Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Original Savory Tonkotsu (Wavy Egg Noodles)", priceDelta: 0 },
        { label: "Spicy Aka Miso Bomb (+1) Variant", priceDelta: 1.5 },
        { label: "Extra Rich Double-Truffle Tonkotsu", priceDelta: 4.0 },
        { label: "Gluten-Free Rice Ramen Noodles", priceDelta: 2.5 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Pan-Seared Pork & Chive Gyoza (4 pcs)", priceDelta: 6.5 },
        { label: "Crispy Chicken Karaage with Yuzu Mayo", priceDelta: 7.0 },
        { label: "Kaedama (Extra Side of Ramen Noodles)", priceDelta: 3.5 },
        { label: "Mini Charred Chashu Pork Donburi Bowl", priceDelta: 6.0 },
      ],
    },
  },
  item_sk_4: {
    variantGroup: {
      name: "Tasting Flight Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "3-Piece Hokkaido Bafun Uni Nigiri Flight", priceDelta: 0 },
        { label: "5-Piece Grand Uni & Ikura Tasting Flight", priceDelta: 16.0 },
        { label: "Crispy Marukome Nori Hand-Roll Style", priceDelta: 2.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Clear Clam & Yuzu Dashi Broth", priceDelta: 4.5 },
        { label: "Blistered Shishito Peppers with Bonito", priceDelta: 6.0 },
        { label: "Truffle Sea-Salt Edamame", priceDelta: 5.0 },
        { label: "Freshly Grated Shizuoka Wasabi Side", priceDelta: 3.5 },
      ],
    },
  },

  // Fuego Craft Taqueria
  item_fg_1: {
    variantGroup: {
      name: "Tortilla, Portion & Salsa Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "3 Tacos on Heirloom Corn + Tomatillo Verde", priceDelta: 0 },
        { label: "3 Tacos on Heirloom Corn + Mango Habanero 🔥", priceDelta: 0.75 },
        { label: "4-Taco Grande Plate + Large Consomé", priceDelta: 5.0 },
        { label: "Handmade Sonoran Flour Tortillas Variant", priceDelta: 1.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Roasted Street Corn Elote Cup (Esquites)", priceDelta: 5.5 },
        { label: "Charro Pinto Beans & Smoked Bacon", priceDelta: 4.0 },
        { label: "Cilantro-Lime Mexican Red Rice", priceDelta: 3.5 },
        { label: "Rice & Charro Beans Combo Side", priceDelta: 6.0 },
        { label: "Warm Totopos Chips & Salsa Roja", priceDelta: 4.0 },
      ],
    },
  },
  item_fg_2: {
    variantGroup: {
      name: "Tortilla & Portion Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "3 Tacos on Heirloom Blue Corn Tortillas", priceDelta: 0 },
        { label: "3 Tacos on Handmade Flour Tortillas", priceDelta: 1.0 },
        { label: "5-Taco Taquero Shareable Platter", priceDelta: 7.5 },
        { label: "Crispy Oaxaca Cheese Costra Style (3)", priceDelta: 3.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Roasted Street Corn Elote Cup (Esquites)", priceDelta: 5.5 },
        { label: "Rice & Charro Beans Combo Side", priceDelta: 6.0 },
        { label: "Warm Chips & Queso Blanco Fundido", priceDelta: 5.5 },
        { label: "Sweet Fried Plantains with Crema", priceDelta: 5.0 },
      ],
    },
  },
  item_fg_3: {
    variantGroup: {
      name: "Guacamole Size & Style Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Classic Tableside Hass Avocado & Cotija (8 oz)", priceDelta: 0 },
        { label: "Fiesta Grande Bowl (16 oz Double Portion)", priceDelta: 6.5 },
        { label: "Spicy Serrano & Charred Pineapple Variant", priceDelta: 2.0 },
        { label: "Topped with Crispy Pork Belly Chicharrón", priceDelta: 4.0 },
      ],
    },
    sideGroup: {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Extra Bag of Warm Sea-Salt Totopos Chips", priceDelta: 3.0 },
        { label: "Side of Warm Queso Blanco Dip", priceDelta: 4.5 },
        { label: "Flight of 3 House-Roasted Salsas", priceDelta: 3.5 },
        { label: "Fresh Cucumber, Jicama & Lime Crudité", priceDelta: 3.5 },
      ],
    },
  },
};

export function buildDefaultVariantAndSideGroups(
  category: string = "",
  restaurantId: string = ""
): MenuModifierGroup[] {
  const lowerCat = category.toLowerCase();
  const isItalian = restaurantId.includes("bella");
  const isJapanese = restaurantId.includes("sakura");
  const isMexican = restaurantId.includes("fuego");

  let variantGroup: MenuModifierGroup = {
    name: "Size & Preparation Variant",
    type: "variant",
    required: true,
    multiSelect: false,
    options: [
      { label: "Regular House Portion", priceDelta: 0 },
      { label: "Large / Shareable Portion", priceDelta: 6.0 },
      { label: "Gluten-Free / Lighter Preparation", priceDelta: 2.5 },
    ],
  };

  let sideGroup: MenuModifierGroup = {
    name: "Side Option",
    type: "side",
    required: false,
    multiSelect: true,
    options: [
      { label: "Artisanal House Side Salad", priceDelta: 5.0 },
      { label: "Crispy Truffle & Herb Fries", priceDelta: 5.5 },
      { label: "Warm House-Baked Bread & Herb Butter", priceDelta: 4.0 },
      { label: "Seasonal Roasted Market Vegetables", priceDelta: 5.5 },
    ],
  };

  if (isItalian || lowerCat.includes("pizza") || lowerCat.includes("pasta")) {
    variantGroup = {
      name: lowerCat.includes("pizza")
        ? "Crust & Size Variant"
        : "Portion & Preparation Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: lowerCat.includes("pizza")
        ? [
            { label: 'Traditional 12" Sourdough Crust', priceDelta: 0 },
            { label: '14" Grande Shareable Sourdough', priceDelta: 5.0 },
            { label: "Gluten-Free Cauliflower Crust", priceDelta: 4.0 },
          ]
        : [
            { label: "Classico Individual Portion", priceDelta: 0 },
            { label: "Tavola Shareable Portion", priceDelta: 7.5 },
            { label: "Gluten-Free Artisanal Pasta", priceDelta: 3.5 },
          ],
    };
    sideGroup = {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Wood-Fired Rosemary Focaccia", priceDelta: 4.5 },
        { label: "Baby Arugula & Parmigiano Insalata", priceDelta: 5.5 },
        { label: "Truffle Garlic Knots (4 pcs)", priceDelta: 6.0 },
        { label: "Charred Broccolini with Garlic & Lemon", priceDelta: 5.5 },
      ],
    };
  } else if (
    isJapanese ||
    lowerCat.includes("sushi") ||
    lowerCat.includes("omakase") ||
    lowerCat.includes("ramen") ||
    lowerCat.includes("roll")
  ) {
    variantGroup = {
      name: "Portion & Style Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Traditional House Presentation", priceDelta: 0 },
        { label: "Chef's Deluxe Reserve Upgrade", priceDelta: 6.5 },
        { label: "Gluten-Free Tamari Preparation", priceDelta: 1.5 },
      ],
    };
    sideGroup = {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Traditional Tofu & Scallion Miso Soup", priceDelta: 3.5 },
        { label: "Truffle Sea-Salt Edamame", priceDelta: 5.0 },
        { label: "Pan-Seared Kurobuta Gyoza (4 pcs)", priceDelta: 6.5 },
        { label: "Wakame Seaweed & Cucumber Salad", priceDelta: 5.0 },
      ],
    };
  } else if (
    isMexican ||
    lowerCat.includes("taco") ||
    lowerCat.includes("antojito")
  ) {
    variantGroup = {
      name: "Tortilla & Portion Variant",
      type: "variant",
      required: true,
      multiSelect: false,
      options: [
        { label: "Heirloom Corn Tortillas (Regular)", priceDelta: 0 },
        { label: "Handmade Flour Tortillas Variant", priceDelta: 1.0 },
        { label: "Grande Shareable Platter", priceDelta: 6.0 },
      ],
    };
    sideGroup = {
      name: "Side Option",
      type: "side",
      required: false,
      multiSelect: true,
      options: [
        { label: "Roasted Street Corn Elote Cup (Esquites)", priceDelta: 5.5 },
        { label: "Charro Pinto Beans & Cilantro Rice Combo", priceDelta: 6.0 },
        { label: "Warm Totopos Chips & House Salsa", priceDelta: 4.0 },
        { label: "Side of Queso Blanco Fundido", priceDelta: 5.0 },
      ],
    };
  }

  return [variantGroup, sideGroup];
}

function inferModifierGroupType(
  group: MenuModifierGroup
): "variant" | "side" | "addon" {
  if (group.type) return group.type;
  const n = group.name.toLowerCase();
  if (
    n.includes("side") ||
    n.includes("accompaniment") ||
    n.includes("pairing")
  ) {
    return "side";
  }
  if (
    n.includes("variant") ||
    n.includes("size") ||
    n.includes("crust") ||
    n.includes("portion") ||
    n.includes("style") ||
    n.includes("spice") ||
    n.includes("soy") ||
    n.includes("salsa") ||
    n.includes("tortilla") ||
    n.includes("tier") ||
    n.includes("cut") ||
    group.required
  ) {
    return "variant";
  }
  return "addon";
}

export function ensureMenuItemVariantsAndSides(
  rawModifiers: MenuModifierGroup[] | undefined | null,
  meta: { id?: string; category?: string; restaurantId?: string }
): MenuModifierGroup[] {
  const existing = Array.isArray(rawModifiers) ? rawModifiers : [];
  const itemPreset = meta.id ? ITEM_SPECIFIC_VARIANTS_AND_SIDES[meta.id] : undefined;
  const fallbackDefaults = buildDefaultVariantAndSideGroups(
    meta.category || "",
    meta.restaurantId || ""
  );

  const defaultVariant = itemPreset?.variantGroup || fallbackDefaults[0];
  const defaultSide = itemPreset?.sideGroup || fallbackDefaults[1];

  const classified: MenuModifierGroup[] = existing
    .filter((g) => g && Array.isArray(g.options) && g.options.length > 0)
    .map((g) => {
      const inferredType = inferModifierGroupType(g);
      return {
        ...g,
        type: inferredType,
        multiSelect:
          g.multiSelect !== undefined
            ? g.multiSelect
            : inferredType === "side" || inferredType === "addon",
      };
    });

  const hasVariant = classified.some((g) => g.type === "variant");
  const hasSide = classified.some((g) => g.type === "side");

  // If the item had an older 2-option crust/spice/salsa group from seed data and matches an itemPreset,
  // upgrade its variant group options if it has fewer than 3 options so every seeded item has full rich variants
  const upgraded = classified.map((g) => {
    if (
      g.type === "variant" &&
      itemPreset &&
      g.options.length <= 2 &&
      (g.name === "Crust Option" ||
        g.name === "Soy Sauce Preference" ||
        g.name === "Spice Level")
    ) {
      return itemPreset.variantGroup;
    }
    return g;
  });

  const result: MenuModifierGroup[] = [];
  if (!hasVariant) {
    result.push(defaultVariant);
  }
  for (const g of upgraded) {
    result.push(g);
  }
  if (!hasSide) {
    result.push(defaultSide);
  }

  return result;
}

