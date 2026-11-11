export type PlanTier = "starter" | "growth" | "enterprise";
export type RestaurantStatus = "active" | "onboarding" | "suspended";
export type LayoutStyle =
  | "aura-luxury"
  | "modern-grid"
  | "editorial-list"
  | "compact-bistro";
export type OrderType = "pickup" | "delivery" | "dine_in";
export type OrderStatus =
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface AiAssistantConfig {
  enabled: boolean;
  botName: string; // e.g., "Chef Marco AI" or "Sensei Kenji AI"
  botRoleTitle: string; // e.g., "Wood-Fired Sommelier & Ordering Concierge"
  welcomeMessage: string;
  voiceEnabled: boolean;
  autoSpeakReplies: boolean;
  handsFreeContinuousMode: boolean;
  voiceRate: number; // 0.8 to 1.3
  voicePitch: number; // 0.8 to 1.2
  voiceLanguage: string; // e.g., "en-US", "it-IT", "ja-JP", "es-MX"
  voiceProvider:
    | "browser_speech"
    | "vapi_voice"
    | "gemini_live"
    | "openai_realtime"
    | "elevenlabs_twilio";
  externalVoiceWebhookUrl?: string;
  customKnowledgeNotes?: string;
}

export interface TenantFeatureFlags {
  pickup: boolean;
  delivery: boolean;
  dineInQr: boolean;
  tableReservations: boolean;
  loyaltyProgram: boolean;
  tipping: boolean;
  promoCodes: boolean;
  scheduledOrders: boolean;
  dietaryFilters: boolean;
  allergyNotes: boolean;
  aiChatbot?: boolean;
  // Super Admin provisioned integration entitlements per tenant
  doordashDrive?: boolean;
  squarePos?: boolean;
  cloverPos?: boolean;
  vapiVoiceAi?: boolean;
  // Detailed fulfillment controls per restaurant
  defaultFulfillment?: OrderType;
  curbsidePickup?: boolean;
  pickupInstructions?: string;
  deliveryRadiusMiles?: number;
  deliveryMinOrderAmount?: number;
  deliveryInstructions?: string;
  dineInInstructions?: string;
  // Tenant-branded AI Chat & Voice Assistant config
  aiAssistant?: AiAssistantConfig;
}

export interface DaySchedule {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  enabled: boolean; // If false, ordering is turned off for this entire day
  openTime: string; // "11:00"
  closeTime: string; // "22:00"
  breakEnabled?: boolean; // Optional afternoon/prep closure window
  breakStart?: string; // "15:00"
  breakEnd?: string; // "17:00"
  // Per-day available pickup time configuration & per-slot order capacity
  pickupEnabled?: boolean;
  pickupStartTime?: string; // e.g. "11:30"
  pickupEndTime?: string; // e.g. "21:30"
  pickupSlotIntervalMinutes?: number; // 15 | 30 | 60
  pickupSlotMaxOrders?: number; // Default max orders each time slot on this day can support (e.g. 5)
  customPickupSlots?: string[]; // Optional specific pickup times e.g. ["12:00", "17:30", "19:00"]
  pickupSlotCapacities?: Record<string, number>; // Per-slot order limit overrides e.g. { "12:00": 6, "18:00": 10 }
}

export interface BlackoutWindow {
  id: string;
  title: string; // e.g., "Private Catering Buyout" or "Thanksgiving Closure"
  date?: string; // Specific YYYY-MM-DD or recurring day name
  dayOfWeek?: string; // Optional day of week e.g. "Tuesday" or "All"
  startTime: string; // "14:00"
  endTime: string; // "18:00"
   fullDay: boolean;
  active: boolean;
  reasonMessage: string;
}

export interface PaymentGatewayConfig {
  mode: "simulated" | "live";
  currency: string;
  taxRatePercent: number;
  deliveryFee: number;
  freeDeliveryMin: number;
  serviceFeePercent: number;
  stripe: {
    enabled: boolean;
    accountId: string;
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  paypal: {
    enabled: boolean;
    merchantEmail: string;
    clientId: string;
    clientSecret: string;
  };
  square?: {
    enabled: boolean;
    applicationId: string;
    locationId: string;
    accessToken: string;
  };
  clover?: {
    enabled: boolean;
    merchantId: string;
    publicKey: string;
    privateToken: string;
  };
}

export interface PlatformTwilioConfig {
  enabled: boolean;
  mode: "simulated" | "live";
  provider: "twilio";
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
  senderPhone: string;
  notifyRestaurantOwnersOnNewOrder: boolean;
  notifyCustomersOnOrderEvents: boolean;
  ownerNewOrderTemplate: string;
  updatedAt: string;
}

export interface CommsConfig {
  sms: {
    enabled: boolean;
    mode: "simulated" | "live";
    provider: "twilio";
    twilioAccountSid: string;
    twilioAuthToken: string;
    senderPhone: string;
    ownerAlertEnabled?: boolean;
    ownerAlertPhone?: string;
    autoNotifyConfirmed: boolean;
    autoNotifyPreparing: boolean;
    autoNotifyReady: boolean;
    autoNotifyCancelled: boolean;
    templates: {
      confirmed: string;
      preparing: string;
      ready: string;
      cancelled: string;
    };
  };
  email: {
    enabled: boolean;
    mode: "simulated" | "live";
    provider: "resend" | "smtp";
    fromName: string;
    fromEmail: string;
    apiKeyOrSmtpHost: string;
  };
}

export interface MenuModifierOption {
  label: string;
  priceDelta: number;
}

export interface MenuModifierGroup {
  name: string;
  required: boolean;
  type?: "variant" | "side" | "addon";
  multiSelect?: boolean;
  options: MenuModifierOption[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  category: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  available: boolean;
  unavailableReason: string;
  dailyStockLimit: number | null;
  currentStockCount: number | null;
  popular: boolean;
  prepTimeMinutes: number;
  dietaryTags: string[];
  modifiers: MenuModifierGroup[];
  sortOrder: number;
}

export interface Customer {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone: string;
  defaultAddress?: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  vipStatus: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean;
  tags: string[];
  notes: string;
  lastOrderAt: string | null;
  createdAt: string;
}

export type ReorderFrequency = "once" | "weekly" | "biweekly" | "monthly";
export type ScheduledReorderStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface ScheduledReorder {
  id: string;
  restaurantId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sourceOrderNumber: string;
  title: string;
  orderType: OrderType;
  deliveryAddress?: string;
  tableNumber?: string;
  items: OrderLineItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  tip: number;
  total: number;
  paymentMethod: "stripe" | "paypal" | "square" | "clover";
  frequency: ReorderFrequency;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  specialInstructions: string;
  status: ScheduledReorderStatus;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface OrderLineItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  selectedModifiers: { groupName: string; optionLabel: string; priceDelta: number }[];
  itemTotal: number;
  notes?: string;
}

export interface OrderDeliveryTracking {
  provider: "doordash_drive" | "in_house";
  externalDeliveryId: string;
  status:
    | "quote_ready"
    | "created"
    | "dasher_confirmed"
    | "dasher_at_store"
    | "picked_up"
    | "delivered"
    | "cancelled";
  dasherName?: string;
  dasherPhone?: string;
  dasherVehicle?: string;
  feeTotal: number;
  customerFeeCharged: number;
  restaurantSubsidy: number;
  pickupEtaMinutes: number;
  dropoffEtaMinutes: number;
  trackingUrl: string;
  updatedAt: string;
}

export interface OrderPosSyncStatus {
  squareOrderId?: string;
  squareSyncedAt?: string;
  cloverOrderId?: string;
  cloverSyncedAt?: string;
  sourceChannel?: "web_storefront" | "vapi_voice_call" | "square_pos" | "clover_pos";
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantId: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderType: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  items: OrderLineItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  tip: number;
  discount: number;
  total: number;
  paymentMethod: "stripe" | "paypal" | "square" | "clover";
  paymentStatus: "paid" | "refunded" | "pending";
  paymentReference: string;
  status: OrderStatus;
  specialInstructions: string;
  scheduledFor?: string;
  deliveryTracking?: OrderDeliveryTracking;
  posSync?: OrderPosSyncStatus;
  createdAt: string;
}

export interface SmsLog {
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  triggerType:
    | "owner_new_order_alert"
    | "order_confirmed"
    | "order_preparing"
    | "order_ready"
    | "order_cancelled"
    | "broadcast"
    | "manual";
  message: string;
  provider: "twilio_simulated" | "twilio_live";
  status: "delivered" | "queued" | "failed";
  createdAt: string;
}

export interface EmailCampaign {
  id: string;
  restaurantId: string;
  name: string;
  subject: string;
  segment: "all" | "vip" | "repeat" | "inactive";
  promoCode?: string;
  discountPercent?: number;
  bodyHtml: string;
  status: "sent" | "scheduled" | "draft";
  recipientCount: number;
  openRate: number;
  clickRate: number;
  revenueGenerated: number;
  sentAt: string;
}

export interface StorefrontFooterLink {
  id: string;
  label: string;
  href: string;
  column: "navigation" | "legal" | "resources";
}

export interface StorefrontPolicySection {
  id: string;
  heading: string;
  body: string;
}

export interface StorefrontHighlight {
  label: string;
  value: string;
}

export interface StorefrontPagesConfig {
  logoImageUrl: string;
  brandSubtitle: string;
  about: {
    enabled: boolean;
    badge: string;
    headline: string;
    subheadline: string;
    storyParagraph1: string;
    storyParagraph2: string;
    chefOrFounderName: string;
    chefOrFounderRole: string;
    chefQuote: string;
    imageUrl: string;
    highlights: StorefrontHighlight[];
  };
  privacyPolicy: {
    title: string;
    lastUpdated: string;
    summary: string;
    sections: StorefrontPolicySection[];
  };
  termsAndConditions: {
    title: string;
    lastUpdated: string;
    summary: string;
    sections: StorefrontPolicySection[];
  };
  orderingPolicy: {
    cancellationPolicy: string;
    refundPolicy: string;
    allergenDisclaimer: string;
  };
  footer: {
    tagline: string;
    contactPhone: string;
    contactEmail: string;
    contactAddress: string;
    hoursSummary: string;
    instagramUrl: string;
    facebookUrl: string;
    tiktokUrl: string;
    websiteUrl: string;
    copyrightText: string;
    showNewsletterSignup: boolean;
    customLinks: StorefrontFooterLink[];
  };
}

export type InventoryCategory =
  | "Protein & Seafood"
  | "Produce & Dairy"
  | "Dough, Grains & Dry"
  | "Sauces & Prep Batches"
  | "Packaging & Disposables"
  | "Truck Fuel & Supplies";

export type InventoryStorageLocation =
  | "Line Prep Station"
  | "Walk-In / Commissary"
  | "On-Truck Cooler"
  | "Dry Storage";

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: InventoryCategory;
  storageLocation: InventoryStorageLocation;
  unit: string; // e.g., "portions", "lbs", "oz", "trays", "boxes", "tanks"
  currentStock: number; // Active line or on-truck count
  commissaryStock: number; // Backup storeroom / commissary count
  parLevel: number; // Target daily shift stock
  reorderPoint: number; // Low-stock warning threshold
  unitCost: number; // Cost per unit ($) for COGS calculation
  shelfLifeHours: number; // FIFO freshness window (hours)
  supplierName: string;
  linkedMenuItemIds: string[]; // Dishes that depend on this shared ingredient
  auto86LinkedDishes: boolean;
  wasteCountToday: number;
  lastRestockedAt: string;
}

export interface WasteLogEntry {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: string;
  costImpact: number;
  reason:
    | "Expired / Spoilage (FIFO)"
    | "Line Cook Burn / Overcooked"
    | "Dropped / Spilled"
    | "Customer Comp / Remake"
    | "Portion Creep Adjustment";
  loggedBy: string;
  createdAt: string;
}

export interface ShiftLoadoutCheckItem {
  id: string;
  label: string;
  category: "Kitchen Prep" | "Packaging" | "Food Truck Ops" | "Safety & FIFO";
  checked: boolean;
}

export interface RestaurantInventoryConfig {
  operationType: "restaurant_kitchen" | "food_truck_commissary" | "hybrid";
  lowStockAlertsEnabled: boolean;
  autoDeductOnOrder: boolean;
  targetFoodCostPercent: number;
  items: InventoryItem[];
  wasteLogs: WasteLogEntry[];
  shiftChecklist: ShiftLoadoutCheckItem[];
}

export interface DoorDashDriveConfig {
  enabled: boolean;
  mode: "simulated" | "live";
  developerId: string;
  keyId: string;
  signingSecret: string;
  autoDispatchOnConfirm: boolean;
  flatDasherFeeEstimate: number;
  customerDeliveryFeeShare: number;
  freeDeliveryThreshold: number;
  maxDeliveryRadiusMiles: number;
  pickupInstructionsForDasher: string;
}

export interface SquareIntegrationConfig {
  enabled: boolean;
  mode: "simulated" | "live";
  environment: "sandbox" | "production";
  applicationId: string;
  accessToken: string;
  locationId: string;
  webhookSignatureKey: string;
  acceptSquareCheckout: boolean;
  autoPushOrdersToPos: boolean;
  autoSyncCatalogAndStock: boolean;
  lastSyncedAt: string | null;
}

export interface CloverIntegrationConfig {
  enabled: boolean;
  mode: "simulated" | "live";
  environment: "sandbox" | "production";
  merchantId: string;
  publicKey: string;
  privateToken: string;
  webhookSecret: string;
  acceptCloverCheckout: boolean;
  autoPushOrdersToKitchenKds: boolean;
  autoSyncMenuAndStock: boolean;
  lastSyncedAt: string | null;
}

export interface VapiIntegrationConfig {
  enabled: boolean;
  mode: "simulated" | "live";
  publicKey: string;
  privateKey: string;
  assistantId: string;
  phoneNumberId: string;
  inboundPhoneNumber: string;
  voiceModel: string;
  greetingScript: string;
  allowPhoneOrderCreation: boolean;
  sendPaymentSmsAfterCall: boolean;
  totalVoiceCallsHandled: number;
  totalVoiceOrdersCreated: number;
}

export interface IntegrationActivityLog {
  id: string;
  integration: "doordash_drive" | "square" | "clover" | "vapi";
  action: string;
  status: "success" | "warning" | "error";
  summary: string;
  createdAt: string;
}

export interface TenantIntegrationsConfig {
  doordashDrive: DoorDashDriveConfig;
  square: SquareIntegrationConfig;
  clover: CloverIntegrationConfig;
  vapi: VapiIntegrationConfig;
  activityLogs: IntegrationActivityLog[];
}

export interface PlatformIntegrationsConfig {
  doordashDrive: {
    setupCompleted: boolean;
    availableToOwners: boolean;
    mode: "simulated" | "live";
    partnerDeveloperId: string;
    partnerKeyId: string;
    partnerSigningSecret: string;
    defaultFlatFeeQuote: number;
    webhookUrl: string;
  };
  square: {
    setupCompleted: boolean;
    availableToOwners: boolean;
    environment: "sandbox" | "production";
    partnerApplicationId: string;
    partnerClientSecret: string;
    webhookSignatureKey: string;
    webhookUrl: string;
  };
  clover: {
    setupCompleted: boolean;
    availableToOwners: boolean;
    environment: "sandbox" | "production";
    appId: string;
    appSecret: string;
    webhookVerificationCode: string;
    webhookUrl: string;
  };
  vapi: {
    setupCompleted: boolean;
    availableToOwners: boolean;
    mode: "simulated" | "live";
    masterPublicKey: string;
    masterPrivateKey: string;
    defaultVoiceModel: string;
    serverWebhookUrl: string;
  };
  updatedAt: string;
}

export interface RestaurantTenant {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  cuisine: string;
  description: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  address: string;
  timezone: string;
  plan: PlanTier;
  status: RestaurantStatus;

  // Custom Domain
  customDomain: string;
  subdomain: string;
  domainVerified: boolean;
  sslStatus: "pending" | "provisioning" | "active";
  dnsTxtToken: string;

  // Branding & Unique Customizations
  logoEmoji: string;
  primaryColor: string;
  accentColor: string;
  layoutStyle: LayoutStyle;
  heroBannerUrl: string;
  customRequirementNotes: string;
  features: TenantFeatureFlags;
  storefrontPages?: StorefrontPagesConfig;
  inventoryConfig?: RestaurantInventoryConfig;
  integrationsConfig?: TenantIntegrationsConfig;

  // Order Limits & Scheduling
  orderingEnabled: boolean;
  pauseReason: string;
  maxOrdersPerHour: number;
  maxOrdersPerDay: number;
  minOrderAmount: number;
  maxOrderAmount: number;
  prepTimeMinutes: number;
  advanceNoticeDays: number;
  advanceNoticeHours: number;
  advanceNoticeNote: string;
  autoPauseOnLimit: boolean;
  weeklySchedule: DaySchedule[];
  blackoutWindows: BlackoutWindow[];

  // Gateways & Comms
  paymentConfig: PaymentGatewayConfig;
  commsConfig: CommsConfig;

  createdAt: string;
  updatedAt: string;
}

export interface OrderingAvailabilityCheck {
  allowed: boolean;
  reasonCode:
    | "OPEN"
    | "MANUAL_PAUSED"
    | "DAY_CLOSED"
    | "OUTSIDE_HOURS"
    | "BREAK_WINDOW"
    | "BLACKOUT_WINDOW"
    | "HOURLY_ORDER_LIMIT_REACHED"
    | "DAILY_ORDER_LIMIT_REACHED";
  title: string;
  message: string;
  activeOrdersThisHour: number;
  maxOrdersPerHour: number;
  ordersToday: number;
  maxOrdersPerDay: number;
  checkedDay: string;
  checkedTime: string;
}

export type PlatformRole =
  | "super_admin"
  | "platform_ops"
  | "billing_admin"
  | "support_agent";

export type RestaurantRole =
  | "restaurant_owner"
  | "general_manager"
  | "kitchen_chef"
  | "cashier_host"
  | "marketing_manager";

export type UserRole = PlatformRole | RestaurantRole;

export type UserScope = "platform" | "restaurant";

export type UserStatus = "active" | "invited" | "suspended";

export type PortalTabId =
  | "orders"
  | "menu"
  | "inventory"
  | "limits"
  | "payments"
  | "integrations"
  | "customers"
  | "sms"
  | "email"
  | "domain"
  | "team";

export interface UserAccount {
  id: string;
  scope: UserScope;
  restaurantId: string | null;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  title: string;
  pinCode: string;
  permissions: string[];
  lastActiveAt: string;
  createdAt: string;
}

export interface RoleDefinition {
  role: UserRole;
  scope: UserScope;
  label: string;
  badgeColor: string;
  description: string;
  defaultPermissions: string[];
  allowedPortalTabs: PortalTabId[];
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  // Platform Super Admin Roles
  super_admin: {
    role: "super_admin",
    scope: "platform",
    label: "Super Admin (Founder)",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    description:
      "Full root access to create/suspend restaurants, manage custom domains, billing plans, and all platform & tenant users.",
    defaultPermissions: [
      "platform:tenants:write",
      "platform:domains:verify",
      "platform:billing:write",
      "platform:users:write",
      "tenant:impersonate",
    ],
    allowedPortalTabs: [
      "orders",
      "menu",
      "inventory",
      "limits",
      "payments",
      "integrations",
      "customers",
      "sms",
      "email",
      "domain",
      "team",
    ],
  },
  platform_ops: {
    role: "platform_ops",
    scope: "platform",
    label: "Platform Onboarding & DNS Ops",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    description:
      "Provisions new restaurants, configures custom domains & SSL certificates, and customizes storefront layouts.",
    defaultPermissions: [
      "platform:tenants:write",
      "platform:domains:verify",
      "tenant:impersonate",
    ],
    allowedPortalTabs: ["orders", "menu", "inventory", "limits", "domain", "team"],
  },
  billing_admin: {
    role: "billing_admin",
    scope: "platform",
    label: "Platform Billing & Finance",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    description:
      "Manages SaaS subscription tiers, monitors platform GMV, and audits tenant Stripe & PayPal gateway connections.",
    defaultPermissions: ["platform:billing:write", "tenant:payments:read"],
    allowedPortalTabs: ["orders", "payments"],
  },
  support_agent: {
    role: "support_agent",
    scope: "platform",
    label: "Merchant Success & Support",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    description:
      "Assists restaurant owners with menu setup, order limit rules, SMS templates, and troubleshooting.",
    defaultPermissions: ["tenant:orders:read", "tenant:menu:write"],
    allowedPortalTabs: ["orders", "menu", "inventory", "limits", "customers", "sms"],
  },

  // Restaurant Tenant Roles
  restaurant_owner: {
    role: "restaurant_owner",
    scope: "restaurant",
    label: "Restaurant Owner",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    description:
      "Full control over the restaurant: orders, menu, schedules, Stripe/PayPal payouts, CRM, SMS/Email, custom domain, and staff.",
    defaultPermissions: [
      "orders:write",
      "menu:write",
      "limits:write",
      "payments:write",
      "customers:write",
      "comms:write",
      "domain:write",
      "team:write",
    ],
    allowedPortalTabs: [
      "orders",
      "menu",
      "inventory",
      "limits",
      "payments",
      "integrations",
      "customers",
      "sms",
      "email",
      "domain",
      "team",
    ],
  },
  general_manager: {
    role: "general_manager",
    scope: "restaurant",
    label: "General Manager (GM)",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    description:
      "Manages daily operations: live orders, menu items & 86 availability, order limits, blackout schedules, CRM, and staff shifts.",
    defaultPermissions: [
      "orders:write",
      "menu:write",
      "limits:write",
      "customers:write",
      "comms:write",
      "team:write",
    ],
    allowedPortalTabs: [
      "orders",
      "menu",
      "inventory",
      "limits",
      "integrations",
      "customers",
      "sms",
      "email",
      "team",
    ],
  },
  kitchen_chef: {
    role: "kitchen_chef",
    scope: "restaurant",
    label: "Head Chef / Kitchen Expo",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    description:
      "Kitchen ticket access: advances orders (Preparing → Ready), marks dishes 86/Unavailable, and adjusts prep times.",
    defaultPermissions: ["orders:write", "menu:86_toggle", "limits:prep_time"],
    allowedPortalTabs: ["orders", "menu", "inventory", "limits"],
  },
  cashier_host: {
    role: "cashier_host",
    scope: "restaurant",
    label: "Front-of-House / Cashier",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    description:
      "Manages pickup & dine-in handoffs, views incoming orders, looks up guests in Customer CRM, and sends order-ready SMS.",
    defaultPermissions: ["orders:write", "customers:read", "sms:send"],
    allowedPortalTabs: ["orders", "customers", "sms"],
  },
  marketing_manager: {
    role: "marketing_manager",
    scope: "restaurant",
    label: "CRM & Marketing Specialist",
    badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/40",
    description:
      "Manages VIP guest segmentation, loyalty points, promotional SMS broadcasts, and targeted Email Campaigns.",
    defaultPermissions: ["customers:write", "sms:broadcast", "email:campaign"],
    allowedPortalTabs: ["customers", "sms", "email"],
  },
};
