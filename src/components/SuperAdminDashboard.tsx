"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  OrderingAvailabilityCheck,
  PlatformIntegrationsConfig,
  PlatformTwilioConfig,
  RestaurantTenant,
  ROLE_DEFINITIONS,
  SmsLog,
  TenantFeatureFlags,
  UserAccount,
  UserRole,
  UserScope,
} from "@/lib/types";

interface EnrichedRestaurant extends RestaurantTenant {
  stats: {
    totalOrders: number;
    activeOrders: number;
    totalRevenue: number;
    menuItemCount: number;
    unavailableItemCount: number;
    customerCount: number;
  };
  availability: OrderingAvailabilityCheck;
}

const DEFAULT_FEATURES: TenantFeatureFlags = {
  pickup: true,
  delivery: true,
  dineInQr: true,
  tableReservations: false,
  loyaltyProgram: true,
  tipping: true,
  promoCodes: true,
  scheduledOrders: true,
  dietaryFilters: true,
  allergyNotes: true,
  doordashDrive: true,
  squarePos: true,
  cloverPos: true,
  vapiVoiceAi: true,
};

export default function SuperAdminDashboard() {
  const [restaurants, setRestaurants] = useState<EnrichedRestaurant[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [platformTwilio, setPlatformTwilio] =
    useState<PlatformTwilioConfig | null>(null);
  const [platformIntegrations, setPlatformIntegrations] =
    useState<PlatformIntegrationsConfig | null>(null);
  const [platformSmsLogs, setPlatformSmsLogs] = useState<SmsLog[]>([]);
  const [tursoStatus, setTursoStatus] = useState<{
    configured: boolean;
    connected: boolean;
    tursoHost: string;
    envVarDetected: string;
    localCounts: Record<string, number>;
    tursoCounts: Record<string, number>;
    lastCheckedAt: string;
    error?: string;
  } | null>(null);
  const [syncingTurso, setSyncingTurso] = useState(false);
  const [adminView, setAdminView] = useState<
    "tenants" | "users" | "twilio" | "integrations"
  >("tenants");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userScopeFilter, setUserScopeFilter] = useState<
    "ALL" | "platform" | "restaurant"
  >("ALL");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dnsModalTenant, setDnsModalTenant] =
    useState<EnrichedRestaurant | null>(null);
  const [customizeTenant, setCustomizeTenant] =
    useState<EnrichedRestaurant | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Super Admin Create User State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("+1 (415) 555-0190");
  const [newUserScope, setNewUserScope] = useState<UserScope>("platform");
  const [newUserRestaurantId, setNewUserRestaurantId] =
    useState("rest_bella_napoli");
  const [newUserRole, setNewUserRole] = useState<UserRole>("platform_ops");
  const [newUserTitle, setNewUserTitle] = useState("");
  const [newUserPin, setNewUserPin] = useState("4401");

  // Create New Restaurant Wizard Form State
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCuisine, setFormCuisine] = useState("Artisanal Bistro & Grill");
  const [formTagline, setFormTagline] = useState(
    "Farm-to-table seasonal plates & craft beverages"
  );
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formOwnerEmail, setFormOwnerEmail] = useState("");
  const [formPhone, setFormPhone] = useState("+1 (555) 390-8812");
  const [formAddress, setFormAddress] = useState(
    "450 Culinary Way, New York, NY 10013"
  );
  const [formCustomDomain, setFormCustomDomain] = useState("");
  const [formPlan, setFormPlan] =
    useState<RestaurantTenant["plan"]>("growth");
  const [formLogoEmoji, setFormLogoEmoji] = useState("🥂");
  const [formPrimaryColor, setFormPrimaryColor] = useState("#e5be65");
  const [formLayoutStyle, setFormLayoutStyle] =
    useState<RestaurantTenant["layoutStyle"]>("aura-luxury");
  const [formMaxOrdersHour, setFormMaxOrdersHour] = useState(25);
  const [formMaxOrdersDay, setFormMaxOrdersDay] = useState(200);
  const [formCustomReqNotes, setFormCustomReqNotes] = useState(
    "Custom VIP loyalty tiers, allergy notes on checkout, and split kitchen prep hours."
  );
  const [formFeatures, setFormFeatures] =
    useState<TenantFeatureFlags>(DEFAULT_FEATURES);
  const [formStripeEmail, setFormStripeEmail] = useState("");
  const [formPaypalEmail, setFormPaypalEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showToastMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const [restRes, usrRes, twilioRes, intRes, tursoRes] = await Promise.all([
        fetch("/api/restaurants", { cache: "no-store" }),
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/platform/twilio", { cache: "no-store" }),
        fetch("/api/platform/integrations", { cache: "no-store" }),
        fetch("/api/platform/turso-sync", { cache: "no-store" }),
      ]);
      const data = await restRes.json();
      const usrData = await usrRes.json();
      const twilioData = await twilioRes.json();
      const intData = await intRes.json();
      const tursoData = await tursoRes.json().catch(() => null);
      if (data.restaurants) {
        setRestaurants(data.restaurants);
      }
      if (usrData.users) {
        setUsers(usrData.users);
      }
      if (twilioData.config) {
        setPlatformTwilio(twilioData.config);
      }
      if (twilioData.recentSmsLogs) {
        setPlatformSmsLogs(twilioData.recentSmsLogs);
      }
      if (intData.config) {
        setPlatformIntegrations(intData.config);
      }
      if (tursoData) {
        setTursoStatus(tursoData);
      }
    } catch (e) {
      console.error("Failed to fetch restaurants/users:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTursoSync = async (
    direction: "push" | "pull" | "bidirectional"
  ) => {
    setSyncingTurso(true);
    try {
      const res = await fetch("/api/platform/turso-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (data.status) {
        setTursoStatus(data.status);
      }
      await fetchRestaurants();
      if (data.syncResult?.connected) {
        showToastMessage(
          `☁️ Turso Cloud DB Sync (${direction}) complete! All 9 tables synced.`
        );
      } else {
        showToastMessage(
          `⚠️ ${
            data.syncResult?.error ||
            data.error ||
            "Add TURSO_DATABASE_URL & TURSO_AUTH_TOKEN in Vercel Environment Variables."
          }`
        );
      }
    } finally {
      setSyncingTurso(false);
    }
  };

  const handleSavePlatformIntegrations = async (
    nextConfig?: PlatformIntegrationsConfig
  ) => {
    const payload = nextConfig || platformIntegrations;
    if (!payload) return;
    const res = await fetch("/api/platform/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: payload }),
    });
    const data = await res.json();
    if (res.ok && data.config) {
      setPlatformIntegrations(data.config);
      showToastMessage(
        "🔌 Saved Super Admin Master Integrations setup & owner availability!"
      );
    }
  };

  const handleFinishAndPublishAllIntegrations = async () => {
    const res = await fetch("/api/platform/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish_and_publish_all" }),
    });
    const data = await res.json();
    if (res.ok && data.config) {
      setPlatformIntegrations(data.config);
      await fetchRestaurants();
      showToastMessage(
        "🎉 All 4 Integrations (DoorDash Drive, Square, Clover & Vapi) marked Setup Complete and unlocked for all Restaurant Owners!"
      );
    }
  };

  const handleToggleTenantIntegration = async (
    restaurantId: string,
    restaurantName: string,
    featureKey: "doordashDrive" | "squarePos" | "cloverPos" | "vapiVoiceAi",
    enabled: boolean
  ) => {
    const res = await fetch("/api/platform/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_tenant_integration",
        restaurantId,
        featureKey,
        enabled,
      }),
    });
    if (res.ok) {
      await fetchRestaurants();
      showToastMessage(
        `${enabled ? "🔓 Unlocked" : "🔒 Locked"} ${featureKey} for ${restaurantName}!`
      );
    }
  };

  const handleSavePlatformTwilio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformTwilio) return;
    const res = await fetch("/api/platform/twilio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(platformTwilio),
    });
    const data = await res.json();
    if (res.ok && data.config) {
      setPlatformTwilio(data.config);
      if (data.recentSmsLogs) setPlatformSmsLogs(data.recentSmsLogs);
      showToastMessage(
        "📲 Saved Super Admin Master Twilio Gateway configuration for all restaurants!"
      );
    }
  };

  const handleTestOwnerOrderAlert = async (restaurantId: string, name: string) => {
    const res = await fetch("/api/platform/twilio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test_owner_alert",
        restaurantId,
      }),
    });
    const data = await res.json();
    if (res.ok && data.smsLog) {
      if (data.recentSmsLogs) setPlatformSmsLogs(data.recentSmsLogs);
      showToastMessage(
        `🔔 Dispatched test Order Alert SMS to ${name}'s owner (${data.smsLog.customerPhone})!`
      );
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: newUserScope,
        restaurantId:
          newUserScope === "restaurant" ? newUserRestaurantId : null,
        name: newUserName,
        email: newUserEmail,
        phone: newUserPhone,
        role: newUserRole,
        title: newUserTitle || ROLE_DEFINITIONS[newUserRole]?.label,
        pinCode: newUserPin,
      }),
    });
    if (res.ok) {
      setNewUserName("");
      setNewUserEmail("");
      setNewUserTitle("");
      await fetchRestaurants();
      showToastMessage(
        `👤 Created ${ROLE_DEFINITIONS[newUserRole]?.label} account for ${newUserName}!`
      );
    }
  };

  const handleUpdateUserRoleOrStatus = async (
    userId: string,
    updates: Partial<UserAccount>
  ) => {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...updates }),
    });
    if (res.ok) {
      await fetchRestaurants();
      showToastMessage("✅ Updated user role & permissions!");
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    const res = await fetch(
      `/api/users?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await fetchRestaurants();
      showToastMessage(`🗑️ Removed user "${name}".`);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleNameChange = (val: string) => {
    setFormName(val);
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setFormSlug(autoSlug);
    if (autoSlug) {
      setFormCustomDomain(`orders.${autoSlug.replace(/-/g, "")}.com`);
    }
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formOwnerName || !formOwnerEmail) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          slug: formSlug,
          cuisine: formCuisine,
          tagline: formTagline,
          ownerName: formOwnerName,
          ownerEmail: formOwnerEmail,
          phone: formPhone,
          address: formAddress,
          customDomain: formCustomDomain,
          plan: formPlan,
          logoEmoji: formLogoEmoji,
          primaryColor: formPrimaryColor,
          layoutStyle: formLayoutStyle,
          maxOrdersPerHour: Number(formMaxOrdersHour),
          maxOrdersPerDay: Number(formMaxOrdersDay),
          customRequirementNotes: formCustomReqNotes,
          features: formFeatures,
          paymentConfig: {
            mode: "simulated",
            currency: "USD",
            taxRatePercent: 8.5,
            deliveryFee: 4.99,
            freeDeliveryMin: 45,
            serviceFeePercent: 2.0,
            stripe: {
              enabled: true,
              accountId:
                formStripeEmail || `acct_${formSlug.replace(/-/g, "")}`,
              publishableKey: `pk_test_${formSlug.replace(/-/g, "")}_live`,
              secretKey: `sk_test_${formSlug.replace(/-/g, "")}_secret`,
              webhookSecret: `whsec_${formSlug.replace(/-/g, "")}`,
            },
            paypal: {
              enabled: true,
              merchantEmail: formPaypalEmail || formOwnerEmail,
              clientId: `AY_${formSlug.replace(/-/g, "")}_CLIENT`,
              clientSecret: `EJ_${formSlug.replace(/-/g, "")}_SECRET`,
            },
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.restaurant) {
        setShowCreateModal(false);
        setFormName("");
        setFormSlug("");
        setFormOwnerName("");
        setFormOwnerEmail("");
        await fetchRestaurants();
        showToastMessage(
          `🎉 Created "${data.restaurant.name}" with custom domain ${data.restaurant.customDomain}!`
        );
      } else {
        showToastMessage(`⚠️ ${data.error || "Could not create restaurant"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyDomain = async (tenant: EnrichedRestaurant) => {
    const res = await fetch(`/api/restaurants/${tenant.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domainVerified: true,
        sslStatus: "active",
        customDomain: tenant.customDomain,
      }),
    });
    if (res.ok) {
      await fetchRestaurants();
      setDnsModalTenant(null);
      showToastMessage(
        `🔒 Custom domain ${tenant.customDomain} verified & SSL certificate provisioned!`
      );
    }
  };

  const handleToggleOrdering = async (tenant: EnrichedRestaurant) => {
    const nextState = !tenant.orderingEnabled;
    const res = await fetch(`/api/restaurants/${tenant.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderingEnabled: nextState,
        pauseReason: nextState
          ? ""
          : "Temporarily paused by Super Admin / Restaurant Manager",
      }),
    });
    if (res.ok) {
      await fetchRestaurants();
      showToastMessage(
        nextState
          ? `✅ Online ordering enabled for ${tenant.name}`
          : `⏸️ Online ordering paused for ${tenant.name}`
      );
    }
  };

  const handleQuickBrandingUpdate = async (
    tenant: EnrichedRestaurant,
    updates: { layoutStyle?: RestaurantTenant["layoutStyle"]; primaryColor?: string }
  ) => {
    const res = await fetch(`/api/restaurants/${tenant.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await fetchRestaurants();
      showToastMessage(
        `🎨 Updated customer storefront layout & branding for ${tenant.name}!`
      );
    }
  };

  const handleSaveCustomizations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customizeTenant) return;
    const res = await fetch(`/api/restaurants/${customizeTenant.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: customizeTenant.name,
        tagline: customizeTenant.tagline,
        customDomain: customizeTenant.customDomain,
        primaryColor: customizeTenant.primaryColor,
        layoutStyle: customizeTenant.layoutStyle,
        plan: customizeTenant.plan,
        maxOrdersPerHour: Number(customizeTenant.maxOrdersPerHour),
        maxOrdersPerDay: Number(customizeTenant.maxOrdersPerDay),
        customRequirementNotes: customizeTenant.customRequirementNotes,
        features: customizeTenant.features,
      }),
    });
    if (res.ok) {
      setCustomizeTenant(null);
      await fetchRestaurants();
      showToastMessage(
        `✨ Saved custom requirements & domain settings for ${customizeTenant.name}!`
      );
    }
  };

  const totalPlatformRevenue = restaurants.reduce(
    (sum, r) => sum + r.stats.totalRevenue,
    0
  );
  const totalOrdersCount = restaurants.reduce(
    (sum, r) => sum + r.stats.totalOrders,
    0
  );
  const verifiedDomainsCount = restaurants.filter(
    (r) => r.domainVerified
  ).length;
  const totalCustomersCount = restaurants.reduce(
    (sum, r) => sum + r.stats.customerCount,
    0
  );

  const superAdminNavGroups: {
    groupLabel: string;
    items: {
      id: "tenants" | "users" | "twilio" | "integrations";
      label: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string | number;
      badgeTone?: "default" | "emerald" | "amber" | "sky";
    }[];
  }[] = [
    {
      groupLabel: "Platform Control",
      items: [
        {
          id: "tenants",
          label: "Restaurant Tenants",
          subtitle: "Provisioning, Domains & Branding",
          icon: Building2,
          badge: `${restaurants.length} Active`,
          badgeTone: "emerald",
        },
        {
          id: "integrations",
          label: "Plug & Play Integrations",
          subtitle: "DoorDash, Square, Clover & Vapi Setup",
          icon: Sparkles,
          badge: `${
            platformIntegrations
              ? [
                  platformIntegrations.doordashDrive.setupCompleted &&
                    platformIntegrations.doordashDrive.availableToOwners,
                  platformIntegrations.square.setupCompleted &&
                    platformIntegrations.square.availableToOwners,
                  platformIntegrations.clover.setupCompleted &&
                    platformIntegrations.clover.availableToOwners,
                  platformIntegrations.vapi.setupCompleted &&
                    platformIntegrations.vapi.availableToOwners,
                ].filter(Boolean).length
              : 4
          }/4 Live`,
          badgeTone: "emerald",
        },
        {
          id: "users",
          label: "Users & RBAC Roles",
          subtitle: "Super Admin & Restaurant Staff",
          icon: Users,
          badge: users.length,
          badgeTone: "sky",
        },
        {
          id: "twilio",
          label: "Platform Twilio SMS",
          subtitle: "Central Gateway & Order Alerts",
          icon: MessageSquare,
          badge: platformTwilio?.enabled
            ? `${platformTwilio.mode === "live" ? "LIVE" : "SIM"} · ${platformSmsLogs.length}`
            : "OFF",
          badgeTone: platformTwilio?.enabled ? "emerald" : "amber",
        },
      ],
    },
  ];

  const activeNavItem =
    superAdminNavGroups
      .flatMap((g) => g.items)
      .find((i) => i.id === adminView) || superAdminNavGroups[0].items[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 text-xs sm:px-5 sm:py-3.5 sm:text-sm font-medium text-emerald-300 shadow-2xl backdrop-blur-md">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Left Sidebar Navigation — Super Admin Console */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-slate-800/90 bg-slate-950 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Identity Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm font-bold tracking-tight text-white">
                  Platerift Cloud
                </h1>
              </div>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-400 border border-orange-500/30">
                <ShieldCheck className="h-3 w-3" /> Super Admin Console
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Primary Action CTA inside Sidebar */}
        <div className="border-b border-slate-800/80 px-4 py-3.5">
          <button
            onClick={() => {
              setShowCreateModal(true);
              setMobileSidebarOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-rose-700 transition"
          >
            <Plus className="h-4 w-4" />
            Create & Setup Restaurant
          </button>
        </div>

        {/* Categorized Sidebar Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {superAdminNavGroups.map((group) => (
            <div key={group.groupLabel}>
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.groupLabel}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = adminView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setAdminView(item.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                        isActive
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">
                            {item.label}
                          </div>
                          <div
                            className={`truncate text-[10px] ${
                              isActive
                                ? "text-orange-100/90"
                                : "text-slate-500 group-hover:text-slate-400"
                            }`}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : item.badgeTone === "emerald"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : item.badgeTone === "amber"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : item.badgeTone === "sky"
                              ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Jump Links to Managed Restaurant Portals & Storefronts */}
          <div>
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Restaurant Portals ({restaurants.length})
              </span>
              <span className="text-[10px] text-slate-500">
                {verifiedDomainsCount}/{restaurants.length} SSL
              </span>
            </div>
            <div className="space-y-1.5">
              {restaurants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 transition hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">
                        {tenant.logoEmoji}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">
                          {tenant.name}
                        </div>
                        <div className="truncate font-mono text-[10px] text-slate-400">
                          {tenant.customDomain}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        tenant.availability.allowed
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                      title={
                        tenant.availability.allowed
                          ? "Accepting Orders"
                          : "Ordering Paused"
                      }
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <Link
                      href={`/dashboard/${tenant.slug}`}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-orange-500/40 hover:text-white transition"
                    >
                      <LayoutDashboard className="h-3 w-3 text-orange-400" />
                      Owner Portal
                    </Link>
                    <Link
                      href={`/store/${tenant.slug}`}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-white transition"
                    >
                      <ExternalLink className="h-3 w-3 text-emerald-400" />
                      Storefront
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* Sidebar Footer: Platform Status & Refresh */}
        <div className="border-t border-slate-800/80 p-3.5 space-y-2.5 bg-slate-950">
          <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/70 px-3 py-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  platformTwilio?.enabled ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span className="truncate text-slate-300 font-medium">
                Twilio SMS Gateway
              </span>
            </div>
            <button
              onClick={() => setAdminView("twilio")}
              className="font-mono text-[10px] font-semibold text-orange-400 hover:underline"
            >
              {platformTwilio?.enabled ? "ACTIVE" : "PAUSED"}
            </button>
          </div>
          <button
            onClick={fetchRestaurants}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Platform Telemetry
          </button>
        </div>
      </aside>

      {/* Right Column: Contextual Header + Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
                aria-label="Open Super Admin Sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm sm:text-base font-bold tracking-tight text-white">
                    {activeNavItem.label}
                  </h2>
                  <span className="hidden sm:inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-800">
                    {activeNavItem.subtitle}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">
                  Multi-Tenant Restaurant Provisioning, Custom Domains &
                  Merchant Control Center
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
                <Globe className="h-3.5 w-3.5 text-sky-400" />
                <span>
                  <strong className="text-white">{verifiedDomainsCount}</strong>/
                  {restaurants.length} Custom Domains Active
                </span>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Globe className="h-3.5 w-3.5 text-orange-400" />
                <span className="hidden sm:inline">Marketing Site</span>
              </Link>
              <button
                onClick={fetchRestaurants}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3 sm:px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-rose-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create & Setup New Restaurant</span>
                <span className="sm:hidden">New Restaurant</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Hero Architecture Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/40 p-5 sm:p-6 md:p-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              All-in-One Multi-Tenant Restaurant SaaS Engine
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
              Onboard restaurants in 60 seconds, connect their custom domains,
              and empower them to take orders directly.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every restaurant gets its own isolated **Owner Portal** and
              custom-branded **Customer Ordering Storefront** connected to their
              own domain name, their own **Stripe & PayPal** accounts, **Menu
              Builder** with 86/unavailable toggles, **Hourly/Daily Order
              Limits**, **Day/Time Blackout Schedules**, **Customer CRM**,
              automated **Twilio SMS Notifications**, and **Email Marketing
              Campaigns**.
            </p>
          </div>

          {/* KPI Metric Cards */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Active Restaurant Tenants</span>
                <Building2 className="h-4 w-4 text-orange-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">
                {restaurants.length}
              </p>
              <p className="mt-1 text-xs text-emerald-400">
                {verifiedDomainsCount} custom domains SSL active
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Direct Merchant Volume</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">
                ${totalPlatformRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                100% routed to tenant Stripe & PayPal
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Total Orders Processed</span>
                <ShoppingBag className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">
                {totalOrdersCount}
              </p>
              <p className="mt-1 text-xs text-sky-400">
                Real-time SMS order updates active
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>CRM Customers Managed</span>
                <Users className="h-4 w-4 text-purple-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">
                {totalCustomersCount}
              </p>
              <p className="mt-1 text-xs text-purple-400">
                Segmented for SMS & Email blasts
              </p>
            </div>
          </div>

          {/* Turso Cloud Database Live Sync Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  tursoStatus?.connected
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                    : tursoStatus?.configured
                    ? "bg-amber-400"
                    : "bg-slate-500"
                }`}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Turso Cloud SQLite / libSQL Sync
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      tursoStatus?.connected
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {tursoStatus?.connected
                      ? "CONNECTED & AUTO-SYNCING"
                      : "WAITING FOR TURSO ENV VARS"}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400 mt-0.5">
                  {tursoStatus?.connected ? (
                    <>
                      Host: <span className="font-mono text-slate-300">{tursoStatus.tursoHost}</span> • Cloud Rows:{" "}
                      <strong className="text-emerald-300">
                        {tursoStatus.tursoCounts?.restaurants ?? 0}
                      </strong>{" "}
                      restaurants,{" "}
                      <strong className="text-emerald-300">
                        {tursoStatus.tursoCounts?.menu_items ?? 0}
                      </strong>{" "}
                      dishes,{" "}
                      <strong className="text-emerald-300">
                        {tursoStatus.tursoCounts?.orders ?? 0}
                      </strong>{" "}
                      orders
                    </>
                  ) : (
                    <>
                      Ensure <code className="text-orange-300">TURSO_DATABASE_URL</code> &amp;{" "}
                      <code className="text-orange-300">TURSO_AUTH_TOKEN</code> are connected to your Vercel project, then click{" "}
                      <strong className="text-white">Sync All to Turso</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={syncingTurso}
                onClick={() => handleTursoSync("bidirectional")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncingTurso ? "animate-spin" : ""}`}
                />
                <span>{syncingTurso ? "Syncing..." : "Sync All Data with Turso"}</span>
              </button>
              <button
                type="button"
                disabled={syncingTurso}
                onClick={() => handleTursoSync("push")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50 transition"
              >
                <span>Push Local → Turso</span>
              </button>
              <button
                type="button"
                disabled={syncingTurso}
                onClick={() => handleTursoSync("pull")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50 transition"
              >
                <span>Pull Turso → Local</span>
              </button>
            </div>
          </div>
        </div>

        {/* VIEW 1: Restaurant Tenants Grid */}
        {adminView === "tenants" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">
                Managed Restaurant Tenants ({restaurants.length})
              </h3>
              <p className="text-xs text-slate-400">
                Configure unique requirements, verify custom domains, or launch
                any restaurant&apos;s Owner Portal or Customer Storefront.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-96 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl transition hover:border-slate-700"
                >
                  <div>
                    {/* Tenant Banner Header */}
                    <div className="relative h-32 w-full overflow-hidden bg-slate-800">
                      <img
                        src={tenant.heroBannerUrl}
                        alt={tenant.name}
                        className="h-full w-full object-cover opacity-65 transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className="rounded-full bg-slate-950/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-md border border-slate-700">
                          {tenant.plan} plan
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
                            tenant.availability.allowed
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              tenant.availability.allowed
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                            }`}
                          />
                          {tenant.availability.allowed
                            ? "Accepting Orders"
                            : tenant.availability.reasonCode.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl shadow-md border border-white/15"
                            style={{ backgroundColor: tenant.primaryColor }}
                          >
                            {tenant.logoEmoji}
                          </span>
                          <div>
                            <h4 className="font-bold text-white text-base leading-tight">
                              {tenant.name}
                            </h4>
                            <p className="text-xs text-slate-300">
                              {tenant.cuisine} • Owner: {tenant.ownerName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Custom Domain Bar */}
                    <div className="border-b border-slate-800/80 bg-slate-950/60 px-4 py-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-4 w-4 shrink-0 text-sky-400" />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-medium text-sky-300 truncate">
                              {tenant.customDomain}
                            </span>
                            {tenant.domainVerified ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                <Lock className="h-2.5 w-2.5" /> SSL Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                                Pending DNS
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            Fallback: {tenant.subdomain}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setDnsModalTenant(tenant)}
                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                      >
                        DNS / SSL
                      </button>
                    </div>

                    {/* Body Details */}
                    <div className="p-4 space-y-4">
                      {/* Custom Requirements Summary */}
                      <div className="rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <span>Unique Tenant Setup & Requirements</span>
                          <button
                            onClick={() => setCustomizeTenant(tenant)}
                            className="text-orange-400 hover:underline flex items-center gap-1"
                          >
                            <Settings2 className="h-3 w-3" /> Customize
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-300 line-clamp-2">
                          {tenant.customRequirementNotes ||
                            "Standard online pickup & delivery configuration."}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {tenant.features.pickup && (
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              Pickup
                            </span>
                          )}
                          {tenant.features.delivery && (
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              Delivery
                            </span>
                          )}
                          {tenant.features.dineInQr && (
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              QR Table Order
                            </span>
                          )}
                          {tenant.features.loyaltyProgram && (
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              Loyalty CRM
                            </span>
                          )}
                          <span className="rounded-md bg-orange-500/15 text-orange-300 px-2 py-0.5 text-[11px]">
                            Max {tenant.maxOrdersPerHour} orders/hr
                          </span>
                        </div>
                      </div>

                      {/* Quick Super Admin Customer Branding & Layout Switcher */}
                      <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Customer Storefront Layout & Brand
                          </span>
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: tenant.primaryColor }}
                          />
                        </div>
                        <select
                          value={tenant.layoutStyle}
                          onChange={(e) =>
                            handleQuickBrandingUpdate(tenant, {
                              layoutStyle: e.target
                                .value as RestaurantTenant["layoutStyle"],
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                        >
                          <option value="aura-luxury">
                            ✨ AURA Bespoke Gastronomy (Banquet + Degustation)
                          </option>
                          <option value="modern-grid">
                            🖼️ Visual Banquet Cards Grid
                          </option>
                          <option value="editorial-list">
                            📜 Editorial Degustation List
                          </option>
                          <option value="compact-bistro">
                            ⚡ Fast-Casual Express Bistro
                          </option>
                        </select>
                        <div className="flex items-center justify-between gap-1.5 pt-0.5">
                          <span className="text-[11px] text-slate-400">
                            Brand Accent:
                          </span>
                          <div className="flex items-center gap-1.5">
                            {[
                              { label: "AURA Gold", hex: "#e5be65" },
                              { label: "Crimson", hex: "#dc2626" },
                              { label: "Jade", hex: "#14b8a6" },
                              { label: "Amber", hex: "#f59e0b" },
                              { label: "Violet", hex: "#a855f7" },
                            ].map((sw) => (
                              <button
                                key={sw.hex}
                                type="button"
                                title={sw.label}
                                onClick={() =>
                                  handleQuickBrandingUpdate(tenant, {
                                    primaryColor: sw.hex,
                                  })
                                }
                                className={`h-5 w-5 rounded-full border transition ${
                                  tenant.primaryColor.toLowerCase() === sw.hex
                                    ? "scale-110 border-white ring-2 ring-white/40"
                                    : "border-white/20 opacity-75 hover:opacity-100"
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            ))}
                            <input
                              type="color"
                              value={tenant.primaryColor}
                              onChange={(e) =>
                                handleQuickBrandingUpdate(tenant, {
                                  primaryColor: e.target.value,
                                })
                              }
                              title="Custom Brand Hex Color"
                              className="h-5 w-6 cursor-pointer rounded border border-slate-700 bg-slate-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Gateways & Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2">
                          <p className="text-[11px] text-slate-400">Menu</p>
                          <p className="text-sm font-bold text-white">
                            {tenant.stats.menuItemCount} items
                          </p>
                          {tenant.stats.unavailableItemCount > 0 && (
                            <p className="text-[10px] text-rose-400">
                              {tenant.stats.unavailableItemCount} 86&apos;d
                            </p>
                          )}
                        </div>
                        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2">
                          <p className="text-[11px] text-slate-400">Orders</p>
                          <p className="text-sm font-bold text-white">
                            {tenant.stats.totalOrders}
                          </p>
                          <p className="text-[10px] text-emerald-400">
                            ${tenant.stats.totalRevenue.toFixed(0)} rev
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2">
                          <p className="text-[11px] text-slate-400">Gateways</p>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            {tenant.paymentConfig.stripe.enabled && (
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                                Stripe
                              </span>
                            )}
                            {tenant.paymentConfig.paypal.enabled && (
                              <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                                PayPal
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="border-t border-slate-800 bg-slate-950/80 p-4 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <Link
                        href={`/dashboard/${tenant.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-semibold text-white shadow hover:bg-orange-600 transition"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Owner Portal
                      </Link>
                      <Link
                        href={`/store/${tenant.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
                      >
                        <Store className="h-3.5 w-3.5" />
                        Live Storefront
                      </Link>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <Link
                        href={`/?domain=${encodeURIComponent(
                          tenant.customDomain
                        )}`}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Test Custom Domain Route
                      </Link>

                      <button
                        onClick={() => handleToggleOrdering(tenant)}
                        className={`inline-flex items-center gap-1 font-medium ${
                          tenant.orderingEnabled
                            ? "text-amber-400 hover:text-amber-300"
                            : "text-emerald-400 hover:text-emerald-300"
                        }`}
                      >
                        {tenant.orderingEnabled ? (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" /> Pause
                            Ordering
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-3.5 w-3.5" /> Resume
                            Ordering
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* VIEW 2: Super Admin & Restaurant User Management (RBAC) */}
        {adminView === "users" && (
          <section className="space-y-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left Column: Create Platform Admin or Restaurant Staff User */}
              <form
                onSubmit={handleCreateUser}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 h-fit"
              >
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                  <UserPlus className="h-5 w-5 text-orange-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Add Platform or Restaurant User
                    </h3>
                    <p className="text-xs text-slate-400">
                      Assign role-based permissions across Super Admin or any
                      Restaurant Tenant
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Account Scope *
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewUserScope("platform");
                        setNewUserRole("platform_ops");
                      }}
                      className={`rounded-xl border py-2 text-xs font-semibold transition ${
                        newUserScope === "platform"
                          ? "border-orange-500 bg-orange-500/20 text-orange-300"
                          : "border-slate-800 bg-slate-950 text-slate-400"
                      }`}
                    >
                      Platform Admin Team
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewUserScope("restaurant");
                        setNewUserRole("general_manager");
                      }}
                      className={`rounded-xl border py-2 text-xs font-semibold transition ${
                        newUserScope === "restaurant"
                          ? "border-orange-500 bg-orange-500/20 text-orange-300"
                          : "border-slate-800 bg-slate-950 text-slate-400"
                      }`}
                    >
                      Restaurant Tenant Staff
                    </button>
                  </div>
                </div>

                {newUserScope === "restaurant" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Assign to Restaurant Tenant *
                    </label>
                    <select
                      value={newUserRestaurantId}
                      onChange={(e) => setNewUserRestaurantId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.logoEmoji} {r.name} ({r.customDomain})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Role & Access Level *
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) =>
                      setNewUserRole(e.target.value as UserRole)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {Object.values(ROLE_DEFINITIONS)
                      .filter((r) => r.scope === newUserScope)
                      .map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[11px] text-slate-400">
                    {ROLE_DEFINITIONS[newUserRole]?.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Lucas Ferrari"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="lucas@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      POS / Terminal PIN
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Job Title / Shift Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Evening Shift Manager"
                    value={newUserTitle}
                    onChange={(e) => setNewUserTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 py-2.5 text-xs font-semibold text-white shadow hover:from-orange-600 hover:to-rose-700"
                >
                  + Provision User Account & Role
                </button>
              </form>

              {/* Right 2 Columns: User Directory & Role Switcher */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Platform & Tenant User Directory ({users.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Manage Super Admin staff, Restaurant Owners, General
                      Managers, Kitchen Chefs, Cashiers, and Marketing roles.
                    </p>
                  </div>

                  <div className="no-scrollbar flex w-full sm:w-auto gap-1.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1">
                    {[
                      { id: "ALL", label: `All (${users.length})` },
                      {
                        id: "platform",
                        label: `Super Admin Team (${
                          users.filter((u) => u.scope === "platform").length
                        })`,
                      },
                      {
                        id: "restaurant",
                        label: `Restaurant Staff (${
                          users.filter((u) => u.scope === "restaurant").length
                        })`,
                      },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() =>
                          setUserScopeFilter(
                            f.id as "ALL" | "platform" | "restaurant"
                          )
                        }
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          userScopeFilter === f.id
                            ? "bg-orange-500 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {users
                    .filter(
                      (u) =>
                        userScopeFilter === "ALL" || u.scope === userScopeFilter
                    )
                    .map((u) => {
                      const roleDef =
                        ROLE_DEFINITIONS[u.role] ||
                        ROLE_DEFINITIONS.general_manager;
                      const assignedTenant = restaurants.find(
                        (r) => r.id === u.restaurantId
                      );
                      return (
                        <div
                          key={u.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                {u.name}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${roleDef.badgeColor}`}
                              >
                                {roleDef.label}
                              </span>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-mono uppercase ${
                                  u.status === "active"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {u.status}
                              </span>
                              {u.scope === "platform" ? (
                                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                                  🛡️ SaaS Platform HQ
                                </span>
                              ) : (
                                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                                  {assignedTenant
                                    ? `${assignedTenant.logoEmoji} ${assignedTenant.name}`
                                    : "Restaurant Staff"}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400">
                              {u.title} • {u.email} • {u.phone} • PIN:{" "}
                              <code className="text-slate-300">{u.pinCode}</code>
                            </p>

                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {roleDef.defaultPermissions.map((perm) => (
                                <span
                                  key={perm}
                                  className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleUpdateUserRoleOrStatus(u.id, {
                                  role: e.target.value as UserRole,
                                })
                              }
                              className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                            >
                              {Object.values(ROLE_DEFINITIONS)
                                .filter((r) => r.scope === u.scope)
                                .map((r) => (
                                  <option key={r.role} value={r.role}>
                                    Role: {r.label}
                                  </option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleUpdateUserRoleOrStatus(u.id, {
                                    status:
                                      u.status === "active"
                                        ? "suspended"
                                        : "active",
                                  })
                                }
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                              >
                                {u.status === "active" ? "Suspend" : "Activate"}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="rounded-lg p-1 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Role Definitions & RBAC Matrix Reference */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <h3 className="text-base font-bold text-white">
                Role-Based Access Control (RBAC) Matrix — Platform & Restaurant
                Roles
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.values(ROLE_DEFINITIONS).map((r) => (
                  <div
                    key={r.role}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${r.badgeColor}`}
                      >
                        {r.label}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        {r.scope}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {r.description}
                    </p>
                    <div className="pt-1">
                      <p className="text-[10px] font-mono uppercase text-slate-500">
                        Allowed Portal Sections:
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.allowedPortalTabs.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* VIEW 3: Super Admin Platform-Wide Twilio SMS Gateway & Order Notification Hub */}
        {adminView === "twilio" && platformTwilio && (
          <section className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-orange-400" />
                  Super Admin Central Twilio SMS Gateway & Multi-Tenant Order
                  Notifications
                </h3>
                <p className="text-xs text-slate-400">
                  Twilio credentials are managed centrally at the Super Admin
                  level. Every onboarded restaurant automatically receives
                  instant Owner Order Alerts and Customer Order Status SMS out
                  of the box.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  platformTwilio.enabled
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {platformTwilio.enabled
                  ? `Platform Gateway Active (${platformTwilio.mode.toUpperCase()})`
                  : "Platform Gateway Paused"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Left Column (7 Cols): Super Admin Master Twilio Credentials & Global Order Alert Rules */}
              <form
                onSubmit={handleSavePlatformTwilio}
                className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-orange-400">
                      Root SaaS Infrastructure
                    </span>
                    <h4 className="text-base font-bold text-white">
                      Master Twilio API Credentials & Global Dispatch Rules
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformTwilio.enabled}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          enabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded"
                    />
                    Gateway Enabled
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Master Twilio Account SID
                    </label>
                    <input
                      type="text"
                      value={platformTwilio.accountSid}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          accountSid: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Master Twilio Auth Token
                    </label>
                    <input
                      type="password"
                      value={platformTwilio.authToken}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          authToken: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Twilio Messaging Service SID
                    </label>
                    <input
                      type="text"
                      value={platformTwilio.messagingServiceSid}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          messagingServiceSid: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Platform Default Sender Number
                    </label>
                    <input
                      type="text"
                      value={platformTwilio.senderPhone}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          senderPhone: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Dispatch Environment Mode
                  </label>
                  <select
                    value={platformTwilio.mode}
                    onChange={(e) =>
                      setPlatformTwilio({
                        ...platformTwilio,
                        mode: e.target.value as "simulated" | "live",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                  >
                    <option value="simulated">
                      Simulated Sandbox Mode (Logs all SMS in platform & tenant
                      portals)
                    </option>
                    <option value="live">
                      Live Production Mode (Dispatches via Twilio REST API)
                    </option>
                  </select>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-300">
                    Automatic Multi-Tenant Order Notification Rules
                  </p>

                  <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformTwilio.notifyRestaurantOwnersOnNewOrder}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          notifyRestaurantOwnersOnNewOrder: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <span className="font-semibold text-white">
                        Instant Order SMS Alert to Every Restaurant Owner
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Automatically texts the restaurant owner&apos;s phone
                        number whenever a customer places a new order on their
                        storefront.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformTwilio.notifyCustomersOnOrderEvents}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          notifyCustomersOnOrderEvents: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <span className="font-semibold text-white">
                        Automated Customer Order Status SMS Across All
                        Restaurants
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Powers Order Confirmed, Preparing, Ready for
                        Pickup/Delivery, and Cancelled SMS for every restaurant
                        tenant.
                      </p>
                    </div>
                  </label>

                  <div className="pt-2">
                    <label className="block text-xs font-medium text-slate-300">
                      Restaurant Owner New-Order Alert SMS Template
                    </label>
                    <textarea
                      rows={2}
                      value={platformTwilio.ownerNewOrderTemplate}
                      onChange={(e) =>
                        setPlatformTwilio({
                          ...platformTwilio,
                          ownerNewOrderTemplate: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <p className="mt-1 text-[10px] font-mono text-slate-500">
                      Variables: {"{{restaurant_name}}"}, {"{{order_number}}"},{" "}
                      {"{{order_type}}"}, {"{{total}}"}, {"{{customer_name}}"}
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:from-orange-600 hover:to-rose-700"
                >
                  Save Super Admin Platform Twilio Configuration
                </button>
              </form>

              {/* Right Column (5 Cols): Connected Restaurant Owners Routing Status & Test Dispatch */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 h-fit">
                <div>
                  <h4 className="text-base font-bold text-white">
                    Restaurant Owner Order Notification Routing (
                    {restaurants.length} Tenants)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Every restaurant automatically inherits SMS order
                    notifications from the Super Admin Twilio gateway.
                  </p>
                </div>

                <div className="space-y-3">
                  {restaurants.map((tenant) => {
                    const ownerPhone =
                      tenant.commsConfig.sms.ownerAlertPhone || tenant.phone;
                    return (
                      <div
                        key={tenant.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tenant.logoEmoji}</span>
                            <div>
                              <p className="text-xs font-bold text-white">
                                {tenant.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Owner: {tenant.ownerName} • {ownerPhone}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Connected
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                          <span className="text-slate-400">
                            Owner Alerts:{" "}
                            <strong className="text-emerald-400">ON</strong> •
                            Guest Status SMS:{" "}
                            <strong className="text-emerald-400">
                              {tenant.commsConfig.sms.enabled ? "ON" : "OFF"}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleTestOwnerOrderAlert(tenant.id, tenant.name)
                            }
                            className="rounded-lg border border-orange-500/40 bg-orange-500/15 px-2.5 py-1 text-[10px] font-semibold text-orange-300 hover:bg-orange-500/25"
                          >
                            📲 Test Owner Order Alert
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Global Platform SMS Dispatch Audit Log */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <h4 className="text-base font-bold text-white">
                Global Platform Twilio SMS Dispatch Feed ({platformSmsLogs.length}
                )
              </h4>
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {platformSmsLogs.map((log) => {
                  const tenant = restaurants.find(
                    (r) => r.id === log.restaurantId
                  );
                  return (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs"
                    >
                      <div className="space-y-1 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            {log.status}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                            {tenant
                              ? `${tenant.logoEmoji} ${tenant.name}`
                              : log.restaurantId}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-mono ${
                              log.triggerType === "owner_new_order_alert"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-orange-300"
                            }`}
                          >
                            {log.triggerType}
                          </span>
                          <strong className="text-white">
                            To: {log.customerName} ({log.customerPhone})
                          </strong>
                        </div>
                        <p className="text-slate-300">{log.message}</p>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* VIEW 4: Super Admin Master Integrations Setup & Owner Feature Release */}
        {adminView === "integrations" && platformIntegrations && (
          <section className="space-y-8">
            {/* Master Workflow Header Banner */}
            <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/20 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-3xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 px-3 py-1 text-xs font-bold text-orange-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Step 1: Platform Admin Setup → Step 2: Available to Restaurant Owners
                  </span>
                  <h3 className="text-xl font-black text-white">
                    🔌 Master Platform Integrations & Tenant Feature Release
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Configure your platform-level partner credentials and webhooks
                    for <strong>1. DoorDash Drive API</strong>,{" "}
                    <strong>2. Square POS</strong>, <strong>3. Clover POS</strong>
                    , and <strong>4. Vapi Voice AI</strong> below. Once you mark
                    an integration as{" "}
                    <strong className="text-emerald-300">
                      Setup Completed &amp; Available to Owners
                    </strong>{" "}
                    (and enable the tenant switch below), it unlocks inside that
                    restaurant owner&apos;s dashboard!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleFinishAndPublishAllIntegrations}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-xs font-black text-slate-950 shadow-lg hover:brightness-110"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Complete &amp; Unlock All 4 Apps for All Owners
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSavePlatformIntegrations()}
                    className="inline-flex items-center gap-2 rounded-xl border border-orange-500/50 bg-orange-500/20 px-4 py-3 text-xs font-bold text-orange-200 hover:bg-orange-500/30"
                  >
                    Save Master Config
                  </button>
                </div>
              </div>

              {/* 4-Card Master Readiness Roll */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    key: "doordashDrive" as const,
                    icon: "🚗",
                    title: "1. DoorDash Drive API",
                    ready:
                      platformIntegrations.doordashDrive.setupCompleted &&
                      platformIntegrations.doordashDrive.availableToOwners,
                    sub: `Default Flat Quote: $${platformIntegrations.doordashDrive.defaultFlatFeeQuote.toFixed(2)}`,
                  },
                  {
                    key: "square" as const,
                    icon: "⬛",
                    title: "2. Square POS & Payments",
                    ready:
                      platformIntegrations.square.setupCompleted &&
                      platformIntegrations.square.availableToOwners,
                    sub: `Env: ${platformIntegrations.square.environment.toUpperCase()}`,
                  },
                  {
                    key: "clover" as const,
                    icon: "🍀",
                    title: "3. Clover POS & KDS",
                    ready:
                      platformIntegrations.clover.setupCompleted &&
                      platformIntegrations.clover.availableToOwners,
                    sub: `Env: ${platformIntegrations.clover.environment.toUpperCase()}`,
                  },
                  {
                    key: "vapi" as const,
                    icon: "📞",
                    title: "4. Vapi Voice AI",
                    ready:
                      platformIntegrations.vapi.setupCompleted &&
                      platformIntegrations.vapi.availableToOwners,
                    sub: `Voice: ${platformIntegrations.vapi.defaultVoiceModel}`,
                  },
                ].map((card) => (
                  <div
                    key={card.key}
                    className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">
                        {card.icon} {card.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {card.sub}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        card.ready
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {card.ready ? "UNLOCKED" : "PENDING"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2x2 Grid of Master Platform Partner Configurations */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {/* 1. DOORDASH DRIVE MASTER SETUP */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🚗</span>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        1. DoorDash Drive API (Platform Partner Keys)
                      </h4>
                      <p className="text-xs text-slate-400">
                        White-label Dasher dispatch for tenant delivery orders
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      platformIntegrations.doordashDrive.setupCompleted &&
                      platformIntegrations.doordashDrive.availableToOwners
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {platformIntegrations.doordashDrive.setupCompleted &&
                    platformIntegrations.doordashDrive.availableToOwners
                      ? "Available to Owners"
                      : "Hidden / Locked"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.doordashDrive.setupCompleted}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          doordashDrive: {
                            ...platformIntegrations.doordashDrive,
                            setupCompleted: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    ✅ Step 1: Admin Setup Completed
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        platformIntegrations.doordashDrive.availableToOwners
                      }
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          doordashDrive: {
                            ...platformIntegrations.doordashDrive,
                            availableToOwners: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    🔓 Step 2: Release to Owners
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Partner Developer ID
                    </label>
                    <input
                      type="text"
                      value={
                        platformIntegrations.doordashDrive.partnerDeveloperId
                      }
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          doordashDrive: {
                            ...platformIntegrations.doordashDrive,
                            partnerDeveloperId: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Partner Key ID
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.doordashDrive.partnerKeyId}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          doordashDrive: {
                            ...platformIntegrations.doordashDrive,
                            partnerKeyId: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400">
                      Platform Webhook Receiver URL
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.doordashDrive.webhookUrl}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          doordashDrive: {
                            ...platformIntegrations.doordashDrive,
                            webhookUrl: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-sky-300"
                    />
                  </div>
                </div>
              </div>

              {/* 2. SQUARE POS MASTER SETUP */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">⬛</span>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        2. Square POS &amp; Payments (Partner OAuth App)
                      </h4>
                      <p className="text-xs text-slate-400">
                        2-way menu, portion variants, sides &amp; Sold-Out sync
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      platformIntegrations.square.setupCompleted &&
                      platformIntegrations.square.availableToOwners
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {platformIntegrations.square.setupCompleted &&
                    platformIntegrations.square.availableToOwners
                      ? "Available to Owners"
                      : "Hidden / Locked"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.square.setupCompleted}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          square: {
                            ...platformIntegrations.square,
                            setupCompleted: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    ✅ Step 1: Admin Setup Completed
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.square.availableToOwners}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          square: {
                            ...platformIntegrations.square,
                            availableToOwners: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    🔓 Step 2: Release to Owners
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Square Partner Application ID
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.square.partnerApplicationId}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          square: {
                            ...platformIntegrations.square,
                            partnerApplicationId: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Webhook Signature Key
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.square.webhookSignatureKey}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          square: {
                            ...platformIntegrations.square,
                            webhookSignatureKey: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400">
                      Square Webhook Receiver URL
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.square.webhookUrl}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          square: {
                            ...platformIntegrations.square,
                            webhookUrl: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-sky-300"
                    />
                  </div>
                </div>
              </div>

              {/* 3. CLOVER POS MASTER SETUP */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🍀</span>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        3. Clover POS &amp; Kitchen Printer (App Market Setup)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Atomic order push to Clover KDS &amp; real-time stock sync
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      platformIntegrations.clover.setupCompleted &&
                      platformIntegrations.clover.availableToOwners
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {platformIntegrations.clover.setupCompleted &&
                    platformIntegrations.clover.availableToOwners
                      ? "Available to Owners"
                      : "Hidden / Locked"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.clover.setupCompleted}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          clover: {
                            ...platformIntegrations.clover,
                            setupCompleted: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    ✅ Step 1: Admin Setup Completed
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.clover.availableToOwners}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          clover: {
                            ...platformIntegrations.clover,
                            availableToOwners: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    🔓 Step 2: Release to Owners
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Clover Market App ID
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.clover.appId}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          clover: {
                            ...platformIntegrations.clover,
                            appId: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Webhook Verification Code
                    </label>
                    <input
                      type="text"
                      value={
                        platformIntegrations.clover.webhookVerificationCode
                      }
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          clover: {
                            ...platformIntegrations.clover,
                            webhookVerificationCode: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400">
                      Clover Webhook Receiver URL
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.clover.webhookUrl}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          clover: {
                            ...platformIntegrations.clover,
                            webhookUrl: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-sky-300"
                    />
                  </div>
                </div>
              </div>

              {/* 4. VAPI VOICE AI MASTER SETUP */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">📞</span>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        4. Vapi Voice AI (Master Telephony &amp; Voice LLM)
                      </h4>
                      <p className="text-xs text-slate-400">
                        24/7 inbound phone ordering &amp; live menu/stock voice brain
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      platformIntegrations.vapi.setupCompleted &&
                      platformIntegrations.vapi.availableToOwners
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {platformIntegrations.vapi.setupCompleted &&
                    platformIntegrations.vapi.availableToOwners
                      ? "Available to Owners"
                      : "Hidden / Locked"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.vapi.setupCompleted}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          vapi: {
                            ...platformIntegrations.vapi,
                            setupCompleted: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    ✅ Step 1: Admin Setup Completed
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformIntegrations.vapi.availableToOwners}
                      onChange={(e) => {
                        const next = {
                          ...platformIntegrations,
                          vapi: {
                            ...platformIntegrations.vapi,
                            availableToOwners: e.target.checked,
                          },
                        };
                        setPlatformIntegrations(next);
                        handleSavePlatformIntegrations(next);
                      }}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                    🔓 Step 2: Release to Owners
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Master Vapi Public Key
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.vapi.masterPublicKey}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          vapi: {
                            ...platformIntegrations.vapi,
                            masterPublicKey: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Default Hospitality Voice Model
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.vapi.defaultVoiceModel}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          vapi: {
                            ...platformIntegrations.vapi,
                            defaultVoiceModel: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400">
                      Vapi Server Tool-Call Webhook URL
                    </label>
                    <input
                      type="text"
                      value={platformIntegrations.vapi.serverWebhookUrl}
                      onChange={(e) =>
                        setPlatformIntegrations({
                          ...platformIntegrations,
                          vapi: {
                            ...platformIntegrations.vapi,
                            serverWebhookUrl: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-amber-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PER-TENANT INTEGRATION ENTITLEMENT MATRIX */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-white">
                    🏪 Per-Restaurant Integration Entitlements ({restaurants.length} Tenants)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Choose which restaurants get access to each integration once
                    Platform Admin setup is complete. Toggle any switch below to
                    unlock or lock that app in the owner&apos;s portal.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {restaurants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl">{tenant.logoEmoji}</span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-white">
                            {tenant.name}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            Owner: {tenant.ownerName} • Plan:{" "}
                            <span className="uppercase text-orange-300 font-semibold">
                              {tenant.plan}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/dashboard/${tenant.slug}`}
                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-orange-300 hover:bg-slate-800"
                      >
                        Open Portal →
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                      {(
                        [
                          {
                            key: "doordashDrive" as const,
                            label: "🚗 DoorDash Drive",
                          },
                          {
                            key: "squarePos" as const,
                            label: "⬛ Square POS",
                          },
                          {
                            key: "cloverPos" as const,
                            label: "🍀 Clover POS",
                          },
                          {
                            key: "vapiVoiceAi" as const,
                            label: "📞 Vapi Voice AI",
                          },
                        ] as const
                      ).map((app) => {
                        const isEnabled = tenant.features[app.key] !== false;
                        return (
                          <button
                            key={app.key}
                            type="button"
                            onClick={() =>
                              handleToggleTenantIntegration(
                                tenant.id,
                                tenant.name,
                                app.key,
                                !isEnabled
                              )
                            }
                            className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold transition ${
                              isEnabled
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                : "border-slate-800 bg-slate-900 text-slate-500"
                            }`}
                          >
                            <span className="truncate">{app.label}</span>
                            <span className="font-mono text-[9px] uppercase">
                              {isEnabled ? "ON" : "LOCKED"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        </main>
      </div>

      {/* MODAL 1: Create & Setup New Restaurant Tenant */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-4 sm:my-8 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 md:p-8 shadow-2xl max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Super Admin Tenant Provisioning
                </span>
                <h3 className="text-xl font-bold text-white">
                  Create & Customize New Restaurant
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRestaurant} className="mt-6 space-y-6">
              {/* Section 1: Identity & Owner */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-orange-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> 1. Restaurant Profile &
                  Owner Credentials
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Restaurant Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Le Petit Bistro"
                      value={formName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Tenant URL Slug *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="le-petit-bistro"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Chef Pierre Laurent"
                      value={formOwnerName}
                      onChange={(e) => setFormOwnerName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Owner Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="pierre@lepetitbistro.com"
                      value={formOwnerEmail}
                      onChange={(e) => setFormOwnerEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Cuisine Category
                    </label>
                    <input
                      type="text"
                      value={formCuisine}
                      onChange={(e) => setFormCuisine(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Restaurant Phone
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Custom Domain & Branding */}
              <div className="space-y-4 border-t border-slate-800 pt-5">
                <h4 className="text-sm font-semibold text-sky-300 flex items-center gap-2">
                  <Globe className="h-4 w-4" /> 2. Custom Domain Mapping &
                  Storefront Branding
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300">
                      Restaurant Custom Domain Name
                    </label>
                    <input
                      type="text"
                      placeholder="orders.lepetitbistro.com"
                      value={formCustomDomain}
                      onChange={(e) => setFormCustomDomain(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-sky-300 focus:border-sky-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Customers visiting this domain are routed directly to this
                      restaurant&apos;s ordering storefront.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      SaaS Subscription Plan
                    </label>
                    <select
                      value={formPlan}
                      onChange={(e) =>
                        setFormPlan(
                          e.target.value as RestaurantTenant["plan"]
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="starter">Starter ($79/mo)</option>
                      <option value="growth">Growth ($149/mo)</option>
                      <option value="enterprise">Enterprise ($299/mo)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Logo Icon / Emoji
                    </label>
                    <input
                      type="text"
                      value={formLogoEmoji}
                      onChange={(e) => setFormLogoEmoji(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Brand Primary Color
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-slate-700 bg-slate-950"
                      />
                      <input
                        type="text"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Storefront Layout Theme
                    </label>
                    <select
                      value={formLayoutStyle}
                      onChange={(e) =>
                        setFormLayoutStyle(
                          e.target.value as RestaurantTenant["layoutStyle"]
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                    >
                      <option value="aura-luxury">
                        AURA Bespoke Gastronomy (Banquet + Degustation)
                      </option>
                      <option value="modern-grid">
                        Visual Banquet Cards Grid
                      </option>
                      <option value="editorial-list">
                        Editorial Fine-Dining Degustation List
                      </option>
                      <option value="compact-bistro">
                        Fast-Casual Express Bistro
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Unique Requirements, Order Limits & Feature Flags */}
              <div className="space-y-4 border-t border-slate-800 pt-5">
                <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> 3. Unique Restaurant
                  Requirements & Order Limits
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Max Orders Per Hour Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formMaxOrdersHour}
                      onChange={(e) =>
                        setFormMaxOrdersHour(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Max Orders Per Day Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formMaxOrdersDay}
                      onChange={(e) =>
                        setFormMaxOrdersDay(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Unique Owner Requirements & Custom Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formCustomReqNotes}
                    onChange={(e) => setFormCustomReqNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {(
                    Object.keys(formFeatures) as Array<keyof TenantFeatureFlags>
                  )
                    .filter((key) => typeof formFeatures[key] === "boolean")
                    .map((key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 hover:border-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(formFeatures[key])}
                          onChange={(e) =>
                            setFormFeatures({
                              ...formFeatures,
                              [key]: e.target.checked,
                            })
                          }
                          className="rounded border-slate-600 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Section 4: Tenant's Own Stripe & PayPal Accounts */}
              <div className="space-y-4 border-t border-slate-800 pt-5">
                <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> 4. Restaurant&apos;s Own
                  Stripe & PayPal Accounts
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Stripe Connect Account ID / Merchant Key
                    </label>
                    <input
                      type="text"
                      placeholder="acct_1RestaurantStripeAccount"
                      value={formStripeEmail}
                      onChange={(e) => setFormStripeEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      PayPal Merchant Email / Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="payments@restaurantdomain.com"
                      value={formPaypalEmail}
                      onChange={(e) => setFormPaypalEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-orange-600 hover:to-rose-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {submitting
                    ? "Provisioning Tenant..."
                    : "Provision Restaurant & Storefront"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Custom Domain & DNS Configuration Modal */}
      {dnsModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Globe className="h-5 w-5 text-sky-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Custom Domain & SSL Setup
                  </h3>
                  <p className="text-xs text-slate-400">
                    {dnsModalTenant.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDnsModalTenant(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Assigned Custom Domain
              </label>
              <input
                type="text"
                value={dnsModalTenant.customDomain}
                onChange={(e) =>
                  setDnsModalTenant({
                    ...dnsModalTenant,
                    customDomain: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-sky-300"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4 space-y-3 text-xs overflow-x-auto">
              <p className="font-semibold text-slate-200">
                Required DNS Records at Restaurant Owner&apos;s Domain Registrar
                (Cloudflare, GoDaddy, Namecheap):
              </p>
              <div className="min-w-[340px] space-y-2.5">
                <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-2 text-slate-400 font-mono">
                  <span>TYPE</span>
                  <span>HOST / NAME</span>
                  <span>VALUE / TARGET</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-slate-200">
                  <span className="text-sky-400">CNAME</span>
                  <span className="truncate">
                    {dnsModalTenant.customDomain.split(".")[0] || "orders"}
                  </span>
                  <span className="truncate">cname.platerift.app</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-slate-200">
                  <span className="text-emerald-400">A</span>
                  <span>@</span>
                  <span>76.76.21.21</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-slate-200">
                  <span className="text-purple-400">TXT</span>
                  <span>_platerift</span>
                  <span className="truncate">{dnsModalTenant.dnsTxtToken}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`h-4 w-4 shrink-0 ${
                    dnsModalTenant.domainVerified
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                />
                <span>
                  Status:{" "}
                  <strong className="text-white">
                    {dnsModalTenant.domainVerified
                      ? "Verified & TLS/SSL Certificate Active"
                      : "Awaiting DNS Verification"}
                  </strong>
                </span>
              </div>
              <Link
                href={`/?domain=${encodeURIComponent(
                  dnsModalTenant.customDomain
                )}`}
                className="text-sky-400 hover:underline font-medium"
              >
                Preview Domain Route →
              </Link>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
              <button
                onClick={() => setDnsModalTenant(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => handleVerifyDomain(dnsModalTenant)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                Verify DNS & Provision SSL Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Customize Existing Tenant Unique Requirements */}
      {customizeTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSaveCustomizations}
            className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Tenant Customization Engine
                </span>
                <h3 className="text-lg font-bold text-white">
                  Customize {customizeTenant.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomizeTenant(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={customizeTenant.name}
                  onChange={(e) =>
                    setCustomizeTenant({
                      ...customizeTenant,
                      name: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Custom Domain
                </label>
                <input
                  type="text"
                  value={customizeTenant.customDomain}
                  onChange={(e) =>
                    setCustomizeTenant({
                      ...customizeTenant,
                      customDomain: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-sky-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Max Orders Per Hour
                </label>
                <input
                  type="number"
                  value={customizeTenant.maxOrdersPerHour}
                  onChange={(e) =>
                    setCustomizeTenant({
                      ...customizeTenant,
                      maxOrdersPerHour: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Storefront Layout Theme
                </label>
                <select
                  value={customizeTenant.layoutStyle}
                  onChange={(e) =>
                    setCustomizeTenant({
                      ...customizeTenant,
                      layoutStyle: e.target
                        .value as RestaurantTenant["layoutStyle"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                >
                  <option value="aura-luxury">
                    AURA Bespoke Gastronomy (Banquet + Degustation)
                  </option>
                  <option value="modern-grid">Visual Banquet Cards Grid</option>
                  <option value="editorial-list">
                    Editorial Fine-Dining Degustation List
                  </option>
                  <option value="compact-bistro">
                    Fast-Casual Express Bistro
                  </option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300">
                  Customer Brand Primary Color
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color"
                    value={customizeTenant.primaryColor}
                    onChange={(e) =>
                      setCustomizeTenant({
                        ...customizeTenant,
                        primaryColor: e.target.value,
                      })
                    }
                    className="h-9 w-14 cursor-pointer rounded border border-slate-700 bg-slate-950"
                  />
                  <input
                    type="text"
                    value={customizeTenant.primaryColor}
                    onChange={(e) =>
                      setCustomizeTenant({
                        ...customizeTenant,
                        primaryColor: e.target.value,
                      })
                    }
                    className="w-40 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Unique Requirements & Custom Rules Notes
              </label>
              <textarea
                rows={2}
                value={customizeTenant.customRequirementNotes}
                onChange={(e) =>
                  setCustomizeTenant({
                    ...customizeTenant,
                    customRequirementNotes: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Enabled Capabilities for This Restaurant
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  Object.keys(
                    customizeTenant.features
                  ) as Array<keyof TenantFeatureFlags>
                )
                  .filter(
                    (key) => typeof customizeTenant.features[key] === "boolean"
                  )
                  .map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(customizeTenant.features[key])}
                        onChange={(e) =>
                          setCustomizeTenant({
                            ...customizeTenant,
                            features: {
                              ...customizeTenant.features,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-600 text-orange-500"
                      />
                      <span className="capitalize">
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setCustomizeTenant(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-600"
              >
                Save Tenant Customizations
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
