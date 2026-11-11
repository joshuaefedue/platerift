import type {
  MenuItem,
  OrderDeliveryTracking,
  PlatformIntegrationsConfig,
  TenantIntegrationsConfig,
} from "./types";

export function buildDefaultPlatformIntegrationsConfig(): PlatformIntegrationsConfig {
  return {
    doordashDrive: {
      setupCompleted: true,
      availableToOwners: true,
      mode: "simulated",
      partnerDeveloperId: "dd_partner_platerift_master_9910",
      partnerKeyId: "dd_key_master_sandbox_4412",
      partnerSigningSecret: "dd_secret_master_hs256_99812a",
      defaultFlatFeeQuote: 6.75,
      webhookUrl: "https://api.platerift.app/api/webhooks/doordash",
    },
    square: {
      setupCompleted: true,
      availableToOwners: true,
      environment: "sandbox",
      partnerApplicationId: "sandbox-sq0idp-platerift-master-app",
      partnerClientSecret: "sq0csp-platerift-master-secret-8812",
      webhookSignatureKey: "sq_wh_master_sig_7719",
      webhookUrl: "https://api.platerift.app/api/webhooks/square",
    },
    clover: {
      setupCompleted: true,
      availableToOwners: true,
      environment: "sandbox",
      appId: "CLV_APP_PLATERIFT_MARKET_01",
      appSecret: "clv_app_secret_master_5519",
      webhookVerificationCode: "clv_verify_master_2026",
      webhookUrl: "https://api.platerift.app/api/webhooks/clover",
    },
    vapi: {
      setupCompleted: true,
      availableToOwners: true,
      mode: "simulated",
      masterPublicKey: "vapi_pub_master_platerift_8812",
      masterPrivateKey: "vapi_priv_master_platerift_9941",
      defaultVoiceModel: "elevenlabs-nigerian-warm-host",
      serverWebhookUrl: "https://api.platerift.app/api/webhooks/vapi",
    },
    updatedAt: "2026-11-08T18:00:00.000Z",
  };
}

export function buildDefaultIntegrationsConfig(tenant: {
  id?: string;
  slug: string;
  name: string;
  cuisine?: string;
  phone?: string;
}): TenantIntegrationsConfig {
  const slug = (tenant.slug || "bella-napoli").toLowerCase();
  const nowIso = "2026-11-08T18:00:00.000Z";

  const isBella = slug.includes("bella");
  const isSakura = slug.includes("sakura");
  const isFuego = slug.includes("fuego");

  const inboundVapiPhone = isBella
    ? "+1 (312) 555-0199"
    : isSakura
    ? "+1 (415) 555-0188"
    : isFuego
    ? "+1 (512) 555-0177"
    : "+1 (888) 555-0144";

  return {
    doordashDrive: {
      enabled: true,
      mode: "simulated",
      developerId: `dd_dev_${slug.replace(/[^a-z0-9]/g, "_")}`,
      keyId: `dd_key_sandbox_${slug.slice(0, 6)}`,
      signingSecret: "dd_secret_sandbox_hs256_placeholder",
      autoDispatchOnConfirm: true,
      flatDasherFeeEstimate: 6.75,
      customerDeliveryFeeShare: 4.99,
      freeDeliveryThreshold: 45,
      maxDeliveryRadiusMiles: 6,
      pickupInstructionsForDasher:
        "Park in the 5-minute courier loading zone and pick up sealed thermal bag at the Express Counter.",
    },
    square: {
      enabled: true,
      mode: "simulated",
      environment: "sandbox",
      applicationId: `sandbox-sq0idb-${slug.slice(0, 8)}`,
      accessToken: `EAAA_SANDBOX_SQUARE_TOKEN_${slug.toUpperCase()}`,
      locationId: `L_SQ_${slug.toUpperCase().slice(0, 6)}`,
      webhookSignatureKey: `sq_wh_${slug.slice(0, 6)}`,
      acceptSquareCheckout: true,
      autoPushOrdersToPos: true,
      autoSyncCatalogAndStock: true,
      lastSyncedAt: nowIso,
    },
    clover: {
      enabled: true,
      mode: "simulated",
      environment: "sandbox",
      merchantId: `CLV_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "")}_01`,
      publicKey: `pakms_sandbox_${slug.slice(0, 8)}`,
      privateToken: `clv_sandbox_tok_${slug.slice(0, 8)}`,
      webhookSecret: `clv_wh_${slug.slice(0, 6)}`,
      acceptCloverCheckout: true,
      autoPushOrdersToKitchenKds: true,
      autoSyncMenuAndStock: true,
      lastSyncedAt: nowIso,
    },
    vapi: {
      enabled: true,
      mode: "simulated",
      publicKey: `vapi_pub_${slug.slice(0, 8)}_demo`,
      privateKey: `vapi_priv_${slug.slice(0, 8)}_demo`,
      assistantId: `asst_vapi_${slug.replace(/[^a-z0-9]/g, "_")}`,
      phoneNumberId: `phn_vapi_${slug.slice(0, 6)}`,
      inboundPhoneNumber: inboundVapiPhone,
      voiceModel: "elevenlabs-rachel-warm-hospitality",
      greetingScript: `Hello! Thank you for calling ${tenant.name}. I can tell you what is fresh in the kitchen today, help you choose portion sizes and sides, check delivery to your address, or place your order right now over the phone!`,
      allowPhoneOrderCreation: true,
      sendPaymentSmsAfterCall: true,
      totalVoiceCallsHandled: isBella ? 42 : isSakura ? 29 : 54,
      totalVoiceOrdersCreated: isBella ? 18 : isSakura ? 14 : 26,
    },
    activityLogs: [
      {
        id: `int_log_${slug}_1`,
        integration: "doordash_drive",
        action: "Dasher Dispatched",
        status: "success",
        summary:
          "DoorDash Drive Dasher (Marcus T. • Honda Civic) assigned in 45s. Flat fee $6.75 (Customer paid $4.99, Restaurant subsidy $1.76).",
        createdAt: "2026-11-08T17:40:00.000Z",
      },
      {
        id: `int_log_${slug}_2`,
        integration: "square",
        action: "Catalog & Stock Sync",
        status: "success",
        summary:
          "Synced menu items, portion variants, sides & sold-out status with Square POS Register.",
        createdAt: "2026-11-08T17:15:00.000Z",
      },
      {
        id: `int_log_${slug}_3`,
        integration: "clover",
        action: "Kitchen Printer KDS Push",
        status: "success",
        summary:
          "Pushed online order ticket to Clover Station Kitchen Display & thermal printer.",
        createdAt: "2026-11-08T16:50:00.000Z",
      },
      {
        id: `int_log_${slug}_4`,
        integration: "vapi",
        action: "Inbound Phone Order Completed",
        status: "success",
        summary: `Caller placed pickup order via Vapi Voice AI (${inboundVapiPhone}) and received SMS confirmation link.`,
        createdAt: "2026-11-08T16:20:00.000Z",
      },
    ],
  };
}

const SAMPLE_DASHER_PROFILES = [
  {
    name: "Chinedu Okafor",
    phone: "+1 (312) 555-0812",
    vehicle: "Red Toyota Corolla • Top Dasher ⭐ 4.98",
  },
  {
    name: "Marcus Thompson",
    phone: "+1 (312) 555-0499",
    vehicle: "Silver Honda Civic • Insulated Hot-Bag Verified",
  },
  {
    name: "Amina Bello",
    phone: "+1 (312) 555-0321",
    vehicle: "Black Hyundai Elantra • VIP Catering Dasher",
  },
];

export function buildSimulatedDoorDashTracking(params: {
  orderNumber: string;
  orderSubtotal: number;
  config: TenantIntegrationsConfig["doordashDrive"];
  stage?: OrderDeliveryTracking["status"];
}): OrderDeliveryTracking {
  const dasher =
    SAMPLE_DASHER_PROFILES[
      Math.abs(params.orderNumber.charCodeAt(params.orderNumber.length - 1)) %
        SAMPLE_DASHER_PROFILES.length
    ];
  const feeTotal = params.config.flatDasherFeeEstimate || 6.75;
  const isFreeForCustomer =
    params.config.freeDeliveryThreshold > 0 &&
    params.orderSubtotal >= params.config.freeDeliveryThreshold;
  const customerFeeCharged = isFreeForCustomer
    ? 0
    : params.config.customerDeliveryFeeShare;
  const restaurantSubsidy = Math.max(
    0,
    Number((feeTotal - customerFeeCharged).toFixed(2))
  );

  return {
    provider: "doordash_drive",
    externalDeliveryId: `dd_drv_${params.orderNumber.toLowerCase()}_${Date.now()
      .toString()
      .slice(-4)}`,
    status: params.stage || "dasher_confirmed",
    dasherName: dasher.name,
    dasherPhone: dasher.phone,
    dasherVehicle: dasher.vehicle,
    feeTotal,
    customerFeeCharged,
    restaurantSubsidy,
    pickupEtaMinutes: 7,
    dropoffEtaMinutes: 21,
    trackingUrl: `https://order.doordash.com/track/dd_drv_${params.orderNumber.toLowerCase()}`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildVapiAssistantConfigPayload(params: {
  restaurantName: string;
  restaurantSlug: string;
  cuisine: string;
  address: string;
  phone: string;
  vapiConfig: TenantIntegrationsConfig["vapi"];
  menuItems: MenuItem[];
}) {
  const availableItems = params.menuItems.filter((m) => m.available);
  const soldOutItems = params.menuItems.filter((m) => !m.available);

  const menuSummary = availableItems
    .map((m) => {
      const modText = (m.modifiers || [])
        .map(
          (g) =>
            `${g.name}: ${g.options
              .map(
                (o) =>
                  `${o.label}${o.priceDelta > 0 ? ` (+$${o.priceDelta.toFixed(2)})` : ""}`
              )
              .join(", ")}`
        )
        .join(" | ");
      return `- ${m.name} ($${m.price.toFixed(2)}, ${m.category}): ${m.description}${
        modText ? ` [Options: ${modText}]` : ""
      }`;
    })
    .join("\n");

  const soldOutSummary =
    soldOutItems.length > 0
      ? soldOutItems.map((m) => m.name).join(", ")
      : "None (all dishes available)";

  return {
    name: `${params.restaurantName} Voice Ordering Host`,
    firstMessage: params.vapiConfig.greetingScript,
    model: {
      provider: "openai",
      model: "gpt-4o",
      systemPrompt: `You are the friendly phone & voice ordering host for ${params.restaurantName} (${params.cuisine}) located at ${params.address}.
Always help the caller pick their dish, ask which portion size/variant and side dish they want (for example: Regular Bowl vs Big Family Tray, or sides like Fried Plantain / Dodo, Moi-Moi, Coleslaw, etc.), confirm Pickup or DoorDash Delivery, and call the place_voice_order tool to send their order straight to the kitchen.

LIVE AVAILABLE MENU:
${menuSummary}

CURRENTLY SOLD OUT TODAY:
${soldOutSummary}`,
      tools: [
        {
          type: "function",
          function: {
            name: "get_live_menu_and_stock",
            description:
              "Returns the restaurant's live available dishes, portion variants, sides, prices, and sold-out items.",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "check_delivery_quote",
            description:
              "Requests a DoorDash Drive delivery fee and ETA quote for the caller's delivery address.",
            parameters: {
              type: "object",
              properties: {
                deliveryAddress: { type: "string" },
                orderSubtotal: { type: "number" },
              },
              required: ["deliveryAddress"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "place_voice_order",
            description:
              "Places a live customer food order into the kitchen queue, deducts stock, dispatches DoorDash if delivery, and texts the customer a confirmation SMS.",
            parameters: {
              type: "object",
              properties: {
                customerName: { type: "string" },
                customerPhone: { type: "string" },
                orderType: {
                  type: "string",
                  enum: ["pickup", "delivery"],
                },
                deliveryAddress: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      menuItemId: { type: "string" },
                      name: { type: "string" },
                      quantity: { type: "number" },
                    },
                  },
                },
              },
              required: ["customerName", "customerPhone", "items"],
            },
          },
        },
      ],
    },
  };
}

