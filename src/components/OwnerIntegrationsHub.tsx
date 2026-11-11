"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  PhoneCall,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import {
  MenuItem,
  Order,
  PlatformIntegrationsConfig,
  RestaurantTenant,
  TenantIntegrationsConfig,
} from "@/lib/types";
import {
  buildDefaultIntegrationsConfig,
  buildDefaultPlatformIntegrationsConfig,
  buildVapiAssistantConfigPayload,
} from "@/lib/integrationsDefaults";

interface OwnerIntegrationsHubProps {
  restaurant: RestaurantTenant;
  platformIntegrations?: PlatformIntegrationsConfig | null;
  menuItems: MenuItem[];
  orders: Order[];
  saving: boolean;
  onChangeRestaurant: (updated: RestaurantTenant) => void;
  onOrdersUpdated: (orders: Order[]) => void;
  onSaveIntegrations: (config: TenantIntegrationsConfig) => Promise<void>;
  onNotify: (msg: string) => void;
}

export function OwnerIntegrationsHub({
  restaurant,
  platformIntegrations,
  menuItems,
  orders,
  saving,
  onChangeRestaurant,
  onOrdersUpdated,
  onSaveIntegrations,
  onNotify,
}: OwnerIntegrationsHubProps) {
  const config: TenantIntegrationsConfig =
    restaurant.integrationsConfig || buildDefaultIntegrationsConfig(restaurant);
  const masterPlatform =
    platformIntegrations || buildDefaultPlatformIntegrationsConfig();

  // Check whether Platform Super Admin has finished setup AND granted feature access to this tenant
  const isDoorDashUnlockedByPlatform =
    masterPlatform.doordashDrive.setupCompleted &&
    masterPlatform.doordashDrive.availableToOwners &&
    restaurant.features.doordashDrive !== false;

  const isSquareUnlockedByPlatform =
    masterPlatform.square.setupCompleted &&
    masterPlatform.square.availableToOwners &&
    restaurant.features.squarePos !== false;

  const isCloverUnlockedByPlatform =
    masterPlatform.clover.setupCompleted &&
    masterPlatform.clover.availableToOwners &&
    restaurant.features.cloverPos !== false;

  const isVapiUnlockedByPlatform =
    masterPlatform.vapi.setupCompleted &&
    masterPlatform.vapi.availableToOwners &&
    restaurant.features.vapiVoiceAi !== false;

  const unlockedByPlatformCount = [
    isDoorDashUnlockedByPlatform,
    isSquareUnlockedByPlatform,
    isCloverUnlockedByPlatform,
    isVapiUnlockedByPlatform,
  ].filter(Boolean).length;

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [expandedApiCard, setExpandedApiCard] = useState<
    "doordash" | "square" | "clover" | "vapi" | null
  >(null);
  const [showVapiPayloadPreview, setShowVapiPayloadPreview] = useState(false);

  const updateConfig = (patch: Partial<TenantIntegrationsConfig>) => {
    const nextConfig: TenantIntegrationsConfig = {
      ...config,
      ...patch,
    };
    onChangeRestaurant({
      ...restaurant,
      integrationsConfig: nextConfig,
    });
    return nextConfig;
  };

  const runIntegrationAction = async (
    action: string,
    payload: Record<string, unknown> = {},
    toastMessage?: string
  ) => {
    setBusyAction(action);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/integrations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        if (data.restaurant) {
          onChangeRestaurant(data.restaurant);
        } else if (data.integrationsConfig) {
          onChangeRestaurant({
            ...restaurant,
            integrationsConfig: data.integrationsConfig,
          });
        }
        if (Array.isArray(data.orders)) {
          onOrdersUpdated(data.orders);
        }
        if (toastMessage) {
          onNotify(toastMessage);
        }
      } else {
        onNotify(data.error || "Could not complete action");
      }
    } catch (err) {
      console.error("Integration action failed:", err);
      onNotify("Network error while testing integration");
    } finally {
      setBusyAction(null);
    }
  };

  const activeAppsCount = [
    config.doordashDrive.enabled,
    config.square.enabled,
    config.clover.enabled,
    config.vapi.enabled,
  ].filter(Boolean).length;

  const vapiPayloadPreview = buildVapiAssistantConfigPayload({
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    cuisine: restaurant.cuisine,
    address: restaurant.address,
    phone: restaurant.phone,
    vapiConfig: config.vapi,
    menuItems,
  });

  return (
    <div className="space-y-6">
      {/* Top Plain-English Banner + Summary Roll */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5">
        {/* Platform Super Admin Provisioning Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-slate-200">
              <strong className="text-emerald-300">
                Platform Super Admin Integration Status:
              </strong>{" "}
              {unlockedByPlatformCount} of 4 integrations are configured by
              Platform Admin and unlocked for{" "}
              <strong className="text-white">{restaurant.name}</strong>.
            </span>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/15 px-3 py-1.5 text-[11px] font-bold text-orange-300 hover:bg-orange-500/25"
          >
            ⚙️ Manage Master Setup in Super Admin →
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Plug & Play Kitchen Apps • No Coding Needed
            </span>
            <h2 className="mt-2 text-xl font-black text-white">
              🔌 Connect DoorDash Drivers, Square, Clover & Vapi Phone AI
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl mt-1">
              Turn on any of the 4 cards below in 1 click. Every app starts in{" "}
              <strong className="text-slate-200">
                Practice / Sandbox Mode
              </strong>{" "}
              so you can test calling a DoorDash driver, syncing your Square or
              Clover register, or receiving an AI phone order right now without
              risking real money.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => onSaveIntegrations(config)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving Apps..." : "Save All App Settings"}
          </button>
        </div>

        {/* 4-Card Summary Status Roll */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400">
                🚗 1. DoorDash Driver
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {config.doordashDrive.enabled ? "Turned ON" : "Turned OFF"}
              </div>
              <div className="text-[11px] text-emerald-300 mt-0.5">
                0% commission • Flat $
                {config.doordashDrive.flatDasherFeeEstimate.toFixed(2)}/trip
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                config.doordashDrive.enabled
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {config.doordashDrive.mode === "live" ? "LIVE" : "PRACTICE"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400">
                ⬛ 2. Square POS & Card
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {config.square.enabled ? "Connected & Syncing" : "Turned OFF"}
              </div>
              <div className="text-[11px] text-sky-300 mt-0.5">
                {menuItems.length} dishes synced
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                config.square.enabled
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {config.square.environment === "production" ? "LIVE" : "SANDBOX"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400">
                🍀 3. Clover POS & Printer
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {config.clover.enabled ? "Connected & Syncing" : "Turned OFF"}
              </div>
              <div className="text-[11px] text-emerald-300 mt-0.5">
                {menuItems.length} dishes synced
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                config.clover.enabled
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {config.clover.environment === "production" ? "LIVE" : "SANDBOX"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400">
                📞 4. Vapi AI Phone Ordering
              </div>
              <div className="mt-1 text-sm font-black text-white">
                {config.vapi.enabled ? "Answering Calls 24/7" : "Turned OFF"}
              </div>
              <div className="text-[11px] text-amber-300 mt-0.5">
                {config.vapi.totalVoiceOrdersCreated} phone orders taken (
                {config.vapi.totalVoiceCallsHandled} calls)
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                config.vapi.enabled
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {config.vapi.mode === "live" ? "LIVE" : "PRACTICE"}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN 2x2 MULTI-CARD GRID FOR THE 4 INTEGRATIONS */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* =========================================================
            CARD 1: DOORDASH DRIVE API (WHITE-LABEL DASHER DISPATCH)
           ========================================================= */}
        <div
          className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 ${
            isDoorDashUnlockedByPlatform
              ? "border-slate-800 bg-slate-900"
              : "border-amber-500/30 bg-slate-900/60 opacity-85"
          }`}
        >
          {!isDoorDashUnlockedByPlatform && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                🔒 Locked until Platform Super Admin finishes DoorDash Drive
                setup & enables it for {restaurant.name}.
              </span>
              <Link
                href="/admin"
                className="underline font-bold text-amber-300 hover:text-white"
              >
                Unlock in Super Admin →
              </Link>
            </div>
          )}
          <div
            className={`space-y-4 ${
              !isDoorDashUnlockedByPlatform
                ? "pointer-events-none opacity-60"
                : ""
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-2xl">
                  🚗
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      1. DoorDash Driver Delivery (DoorDash Drive)
                    </h3>
                    <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                      0% Commission
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Don&apos;t have your own delivery bike or car? Call a local
                    DoorDash driver to deliver orders placed on your website for
                    a flat fee!
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white">
                <input
                  type="checkbox"
                  checked={config.doordashDrive.enabled}
                  onChange={(e) => {
                    const next = updateConfig({
                      doordashDrive: {
                        ...config.doordashDrive,
                        enabled: e.target.checked,
                      },
                    });
                    onSaveIntegrations(next);
                  }}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                {config.doordashDrive.enabled ? "Turned ON" : "Turned OFF"}
              </label>
            </div>

            {/* Beginner Plain-English Controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 space-y-2">
                <div className="text-xs font-bold text-white">
                  When should we call the driver?
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.doordashDrive.autoDispatchOnConfirm}
                    onChange={(e) =>
                      updateConfig({
                        doordashDrive: {
                          ...config.doordashDrive,
                          autoDispatchOnConfirm: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded accent-rose-500"
                  />
                  Automatically call driver as soon as a Delivery order comes in
                </label>
                <p className="text-[11px] text-slate-500">
                  (You can also click &ldquo;🚗 Call DoorDash Driver&rdquo; on
                  any order in the Orders tab.)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 space-y-2">
                <div className="text-xs font-bold text-white">
                  Free Delivery Minimum ($)
                </div>
                <input
                  type="number"
                  step="1"
                  value={config.doordashDrive.freeDeliveryThreshold}
                  onChange={(e) =>
                    updateConfig({
                      doordashDrive: {
                        ...config.doordashDrive,
                        freeDeliveryThreshold: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-emerald-300"
                />
                <p className="text-[11px] text-slate-500">
                  Orders over ${config.doordashDrive.freeDeliveryThreshold} get
                  $0 delivery fee for the customer!
                </p>
              </div>
            </div>

            {/* Fee & Distance Row */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <label className="block text-[10px] uppercase text-slate-400">
                  DoorDash Flat Quote ($)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={config.doordashDrive.flatDasherFeeEstimate}
                  onChange={(e) =>
                    updateConfig({
                      doordashDrive: {
                        ...config.doordashDrive,
                        flatDasherFeeEstimate: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <label className="block text-[10px] uppercase text-slate-400">
                  Customer Pays ($)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={config.doordashDrive.customerDeliveryFeeShare}
                  onChange={(e) =>
                    updateConfig({
                      doordashDrive: {
                        ...config.doordashDrive,
                        customerDeliveryFeeShare: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-emerald-300"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <label className="block text-[10px] uppercase text-slate-400">
                  Max Distance (Miles)
                </label>
                <input
                  type="number"
                  value={config.doordashDrive.maxDeliveryRadiusMiles}
                  onChange={(e) =>
                    updateConfig({
                      doordashDrive: {
                        ...config.doordashDrive,
                        maxDeliveryRadiusMiles: Number(e.target.value) || 6,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white"
                />
              </div>
            </div>

            {/* Pickup Instructions for Driver */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <label className="block text-[11px] font-bold text-slate-300">
                Note for the DoorDash Driver (Where to park & pick up food)
              </label>
              <input
                type="text"
                value={config.doordashDrive.pickupInstructionsForDasher}
                onChange={(e) =>
                  updateConfig({
                    doordashDrive: {
                      ...config.doordashDrive,
                      pickupInstructionsForDasher: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Come to the Takeout Counter and ask for the hot insulated bag."
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            {/* Optional Live API Key Accordion */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <button
                type="button"
                onClick={() =>
                  setExpandedApiCard(
                    expandedApiCard === "doordash" ? null : "doordash"
                  )
                }
                className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white"
              >
                <span>
                  🔑 Mode:{" "}
                  <strong className="text-rose-300">
                    {config.doordashDrive.mode === "live"
                      ? "Live DoorDash Developer Account"
                      : "Practice / Simulated Mode (Works Instantly)"}
                  </strong>
                </span>
                {expandedApiCard === "doordash" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {expandedApiCard === "doordash" && (
                <div className="mt-3 space-y-2.5 border-t border-slate-800 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          doordashDrive: {
                            ...config.doordashDrive,
                            mode: "simulated",
                          },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.doordashDrive.mode === "simulated"
                          ? "bg-rose-500 text-white"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Practice / Demo Mode
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          doordashDrive: {
                            ...config.doordashDrive,
                            mode: "live",
                          },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.doordashDrive.mode === "live"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Live DoorDash Drive API
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Developer ID
                      </label>
                      <input
                        type="text"
                        value={config.doordashDrive.developerId}
                        onChange={(e) =>
                          updateConfig({
                            doordashDrive: {
                              ...config.doordashDrive,
                              developerId: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Key ID
                      </label>
                      <input
                        type="text"
                        value={config.doordashDrive.keyId}
                        onChange={(e) =>
                          updateConfig({
                            doordashDrive: {
                              ...config.doordashDrive,
                              keyId: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Signing Secret
                      </label>
                      <input
                        type="password"
                        value={config.doordashDrive.signingSecret}
                        onChange={(e) =>
                          updateConfig({
                            doordashDrive: {
                              ...config.doordashDrive,
                              signingSecret: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1-Click Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <span className="text-[11px] text-slate-400">
              Kitchen Subsidy:{" "}
              <strong className="text-emerald-300">
                $
                {Math.max(
                  0,
                  config.doordashDrive.flatDasherFeeEstimate -
                    config.doordashDrive.customerDeliveryFeeShare
                ).toFixed(2)}
                /trip
              </strong>
            </span>
            <button
              type="button"
              disabled={busyAction === "dispatch_doordash"}
              onClick={() =>
                runIntegrationAction(
                  "dispatch_doordash",
                  {},
                  "🚗 DoorDash Driver dispatched! Live tracking link created."
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/40 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
            >
              <Truck className="h-4 w-4" />
              {busyAction === "dispatch_doordash"
                ? "Calling Driver..."
                : "🚗 Test Call a DoorDash Driver Now"}
            </button>
          </div>
        </div>

        {/* =========================================================
            CARD 2: SQUARE POS & PAYMENTS API
           ========================================================= */}
        <div
          className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 ${
            isSquareUnlockedByPlatform
              ? "border-slate-800 bg-slate-900"
              : "border-amber-500/30 bg-slate-900/60 opacity-85"
          }`}
        >
          {!isSquareUnlockedByPlatform && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                🔒 Locked until Platform Super Admin finishes Square POS setup &
                enables it for {restaurant.name}.
              </span>
              <Link
                href="/admin"
                className="underline font-bold text-amber-300 hover:text-white"
              >
                Unlock in Super Admin →
              </Link>
            </div>
          )}
          <div
            className={`space-y-4 ${
              !isSquareUnlockedByPlatform
                ? "pointer-events-none opacity-60"
                : ""
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 border border-sky-500/30 text-2xl">
                  ⬛
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      2. Square POS & Card Reader
                    </h3>
                    <span className="rounded-full bg-sky-500/20 border border-sky-500/40 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                      2-Way Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Use Square at your counter or food truck window? Sync your
                    menu, portion sizes, sides & Sold-Out dishes automatically!
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white">
                <input
                  type="checkbox"
                  checked={config.square.enabled}
                  onChange={(e) => {
                    const next = updateConfig({
                      square: {
                        ...config.square,
                        enabled: e.target.checked,
                      },
                    });
                    onSaveIntegrations(next);
                  }}
                  className="h-4 w-4 rounded accent-sky-500"
                />
                {config.square.enabled ? "Turned ON" : "Turned OFF"}
              </label>
            </div>

            {/* Plain-English Checkboxes */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.square.autoSyncCatalogAndStock}
                  onChange={(e) =>
                    updateConfig({
                      square: {
                        ...config.square,
                        autoSyncCatalogAndStock: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-sky-500"
                />
                <div>
                  <div className="font-bold text-white">
                    2-Way Menu, Sizes, Sides & Sold-Out Sync
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Keep prices, bowls/trays, sides & 86&apos;d items matching Square
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.square.autoPushOrdersToPos}
                  onChange={(e) =>
                    updateConfig({
                      square: {
                        ...config.square,
                        autoPushOrdersToPos: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-sky-500"
                />
                <div>
                  <div className="font-bold text-white">
                    Send Website Orders to Square Kitchen
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Website orders pop up on your Square POS & Kitchen screen
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={config.square.acceptSquareCheckout}
                  onChange={(e) =>
                    updateConfig({
                      square: {
                        ...config.square,
                        acceptSquareCheckout: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-sky-500"
                />
                <div>
                  <div className="font-bold text-white">
                    Accept Square Card / Cash App Pay at Online Checkout
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Let online customers pay using your Square merchant account
                  </div>
                </div>
              </label>
            </div>

            {/* Last Sync Status Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-sky-400" />
                <span>
                  Location:{" "}
                  <strong className="font-mono text-white">
                    {config.square.locationId}
                  </strong>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Last Synced:{" "}
                {config.square.lastSyncedAt
                  ? new Date(config.square.lastSyncedAt).toLocaleTimeString()
                  : "Ready to sync"}
              </span>
            </div>

            {/* Square Credentials Accordion */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <button
                type="button"
                onClick={() =>
                  setExpandedApiCard(
                    expandedApiCard === "square" ? null : "square"
                  )
                }
                className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white"
              >
                <span>
                  🔑 Square Account Mode:{" "}
                  <strong className="text-sky-300">
                    {config.square.environment === "production"
                      ? "Live Square Account"
                      : "Sandbox / Practice Mode"}
                  </strong>
                </span>
                {expandedApiCard === "square" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {expandedApiCard === "square" && (
                <div className="mt-3 space-y-2.5 border-t border-slate-800 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          square: {
                            ...config.square,
                            environment: "sandbox",
                            mode: "simulated",
                          },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.square.environment === "sandbox"
                          ? "bg-sky-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Sandbox (Practice)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          square: {
                            ...config.square,
                            environment: "production",
                            mode: "live",
                          },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.square.environment === "production"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Live Square Register
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Square App ID
                      </label>
                      <input
                        type="text"
                        value={config.square.applicationId}
                        onChange={(e) =>
                          updateConfig({
                            square: {
                              ...config.square,
                              applicationId: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Location ID
                      </label>
                      <input
                        type="text"
                        value={config.square.locationId}
                        onChange={(e) =>
                          updateConfig({
                            square: {
                              ...config.square,
                              locationId: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Access Token
                      </label>
                      <input
                        type="password"
                        value={config.square.accessToken}
                        onChange={(e) =>
                          updateConfig({
                            square: {
                              ...config.square,
                              accessToken: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1-Click Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              disabled={busyAction === "push_order_square"}
              onClick={() =>
                runIntegrationAction(
                  "push_order_square",
                  {},
                  "⬛ Sent test order ticket to Square POS & Kitchen Display!"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
            >
              <Zap className="h-3.5 w-3.5 text-sky-400" />
              Send Test Order to Square
            </button>

            <button
              type="button"
              disabled={busyAction === "sync_square"}
              onClick={() =>
                runIntegrationAction(
                  "sync_square",
                  {},
                  `⬛ Synced ${menuItems.length} dishes, sizes, sides & Sold-Out counts with Square POS!`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500/20 border border-sky-500/40 px-4 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  busyAction === "sync_square" ? "animate-spin" : ""
                }`}
              />
              {busyAction === "sync_square"
                ? "Syncing Square..."
                : "⬛ Sync Menu & Stock with Square Now"}
            </button>
          </div>
        </div>

        {/* =========================================================
            CARD 3: CLOVER POS & KITCHEN PRINTER API
           ========================================================= */}
        <div
          className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 ${
            isCloverUnlockedByPlatform
              ? "border-slate-800 bg-slate-900"
              : "border-amber-500/30 bg-slate-900/60 opacity-85"
          }`}
        >
          {!isCloverUnlockedByPlatform && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                🔒 Locked until Platform Super Admin finishes Clover POS setup &
                enables it for {restaurant.name}.
              </span>
              <Link
                href="/admin"
                className="underline font-bold text-amber-300 hover:text-white"
              >
                Unlock in Super Admin →
              </Link>
            </div>
          )}
          <div
            className={`space-y-4 ${
              !isCloverUnlockedByPlatform
                ? "pointer-events-none opacity-60"
                : ""
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-2xl">
                  🍀
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      3. Clover POS & Kitchen Printer
                    </h3>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      Kitchen Ticket Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Have a Clover Station or Clover Flex on your counter? Print
                    website orders straight to your Clover kitchen printer!
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white">
                <input
                  type="checkbox"
                  checked={config.clover.enabled}
                  onChange={(e) => {
                    const next = updateConfig({
                      clover: {
                        ...config.clover,
                        enabled: e.target.checked,
                      },
                    });
                    onSaveIntegrations(next);
                  }}
                  className="h-4 w-4 rounded accent-emerald-500"
                />
                {config.clover.enabled ? "Turned ON" : "Turned OFF"}
              </label>
            </div>

            {/* Plain-English Checkboxes */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.clover.autoSyncMenuAndStock}
                  onChange={(e) =>
                    updateConfig({
                      clover: {
                        ...config.clover,
                        autoSyncMenuAndStock: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-emerald-500"
                />
                <div>
                  <div className="font-bold text-white">
                    Sync Dishes, Modifiers & Item Stock
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Sync categories, portion variants, sides & Sold-Out counts
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.clover.autoPushOrdersToKitchenKds}
                  onChange={(e) =>
                    updateConfig({
                      clover: {
                        ...config.clover,
                        autoPushOrdersToKitchenKds: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-emerald-500"
                />
                <div>
                  <div className="font-bold text-white">
                    Print Website Orders on Clover Kitchen
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Fires atomic orders to Clover Kitchen Display & printer
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={config.clover.acceptCloverCheckout}
                  onChange={(e) =>
                    updateConfig({
                      clover: {
                        ...config.clover,
                        acceptCloverCheckout: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-emerald-500"
                />
                <div>
                  <div className="font-bold text-white">
                    Accept Clover eCommerce Card Pay at Online Checkout
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Let customers pay online directly into your Clover account
                  </div>
                </div>
              </label>
            </div>

            {/* Last Sync Status Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>
                  Clover Merchant ID:{" "}
                  <strong className="font-mono text-white">
                    {config.clover.merchantId}
                  </strong>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Last Synced:{" "}
                {config.clover.lastSyncedAt
                  ? new Date(config.clover.lastSyncedAt).toLocaleTimeString()
                  : "Ready to sync"}
              </span>
            </div>

            {/* Clover Credentials Accordion */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <button
                type="button"
                onClick={() =>
                  setExpandedApiCard(
                    expandedApiCard === "clover" ? null : "clover"
                  )
                }
                className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white"
              >
                <span>
                  🔑 Clover Account Mode:{" "}
                  <strong className="text-emerald-300">
                    {config.clover.environment === "production"
                      ? "Live Clover Station"
                      : "Sandbox / Practice Mode"}
                  </strong>
                </span>
                {expandedApiCard === "clover" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {expandedApiCard === "clover" && (
                <div className="mt-3 space-y-2.5 border-t border-slate-800 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          clover: {
                            ...config.clover,
                            environment: "sandbox",
                            mode: "simulated",
                          },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.clover.environment === "sandbox"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Sandbox (Practice)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          clover: {
                            ...config.clover,
                            environment: "production",
                            mode: "live",
                          },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.clover.environment === "production"
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Live Clover Station
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Merchant ID (mId)
                      </label>
                      <input
                        type="text"
                        value={config.clover.merchantId}
                        onChange={(e) =>
                          updateConfig({
                            clover: {
                              ...config.clover,
                              merchantId: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Private Token
                      </label>
                      <input
                        type="password"
                        value={config.clover.privateToken}
                        onChange={(e) =>
                          updateConfig({
                            clover: {
                              ...config.clover,
                              privateToken: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        eCommerce Public Key
                      </label>
                      <input
                        type="text"
                        value={config.clover.publicKey}
                        onChange={(e) =>
                          updateConfig({
                            clover: {
                              ...config.clover,
                              publicKey: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1-Click Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              disabled={busyAction === "push_order_clover"}
              onClick={() =>
                runIntegrationAction(
                  "push_order_clover",
                  {},
                  "🍀 Fired test order ticket to Clover POS & Kitchen Printer!"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/40"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              Print Test Ticket on Clover
            </button>

            <button
              type="button"
              disabled={busyAction === "sync_clover"}
              onClick={() =>
                runIntegrationAction(
                  "sync_clover",
                  {},
                  `🍀 Synced ${menuItems.length} dishes, modifiers & Sold-Out counts with Clover POS!`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  busyAction === "sync_clover" ? "animate-spin" : ""
                }`}
              />
              {busyAction === "sync_clover"
                ? "Syncing Clover..."
                : "🍀 Sync Menu & Stock with Clover Now"}
            </button>
          </div>
        </div>

        {/* =========================================================
            CARD 4: VAPI VOICE AI PHONE RECEPTIONIST & WEB VOICE CALLS
           ========================================================= */}
        <div
          className={`rounded-3xl border p-6 flex flex-col justify-between space-y-5 ${
            isVapiUnlockedByPlatform
              ? "border-slate-800 bg-slate-900"
              : "border-amber-500/30 bg-slate-900/60 opacity-85"
          }`}
        >
          {!isVapiUnlockedByPlatform && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                🔒 Locked until Platform Super Admin finishes Vapi Voice AI
                setup & enables it for {restaurant.name}.
              </span>
              <Link
                href="/admin"
                className="underline font-bold text-amber-300 hover:text-white"
              >
                Unlock in Super Admin →
              </Link>
            </div>
          )}
          <div
            className={`space-y-4 ${
              !isVapiUnlockedByPlatform
                ? "pointer-events-none opacity-60"
                : ""
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-2xl">
                  📞
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      4. Vapi AI Phone Ordering (24/7 Voice Receptionist)
                    </h3>
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                      Answers Calls 24/7
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Too busy frying plantain or tending the Suya grill to answer
                    the phone? Vapi AI answers calls, checks what pots are
                    available, takes the order, and texts a payment link!
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white">
                <input
                  type="checkbox"
                  checked={config.vapi.enabled}
                  onChange={(e) => {
                    const next = updateConfig({
                      vapi: {
                        ...config.vapi,
                        enabled: e.target.checked,
                      },
                    });
                    onSaveIntegrations(next);
                  }}
                  className="h-4 w-4 rounded accent-amber-500"
                />
                {config.vapi.enabled ? "Turned ON" : "Turned OFF"}
              </label>
            </div>

            {/* Phone Number & Voice Model Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5">
                <label className="block text-[10px] uppercase text-slate-400">
                  AI Phone Ordering Line (Customers Call This)
                </label>
                <input
                  type="text"
                  value={config.vapi.inboundPhoneNumber}
                  onChange={(e) =>
                    updateConfig({
                      vapi: {
                        ...config.vapi,
                        inboundPhoneNumber: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs font-bold text-amber-300"
                />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5">
                <label className="block text-[10px] uppercase text-slate-400">
                  Receptionist Voice Style
                </label>
                <select
                  value={config.vapi.voiceModel}
                  onChange={(e) =>
                    updateConfig({
                      vapi: {
                        ...config.vapi,
                        voiceModel: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  <option value="elevenlabs-nigerian-warm-host">
                    🇳🇬 Warm Nigerian / African Host (Lagos & Abuja Hospitality)
                  </option>
                  <option value="elevenlabs-rachel-warm-hospitality">
                    🍽️ Warm Restaurant Hospitality Host
                  </option>
                  <option value="elevenlabs-marcus-food-truck">
                    🚚 Energetic Food Truck Host (Fast & Friendly)
                  </option>
                  <option value="elevenlabs-concierge-calm">
                    🍷 Calm Fine-Dining Concierge
                  </option>
                </select>
              </div>
            </div>

            {/* First Greeting Spoken When Customer Calls */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <label className="block text-[11px] font-bold text-slate-300">
                What Vapi AI says when a customer calls your phone:
              </label>
              <input
                type="text"
                value={config.vapi.greetingScript}
                onChange={(e) =>
                  updateConfig({
                    vapi: {
                      ...config.vapi,
                      greetingScript: e.target.value,
                    },
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            {/* Checkboxes for SMS Payment Link & Auto-Create Order */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.vapi.allowPhoneOrderCreation}
                  onChange={(e) =>
                    updateConfig({
                      vapi: {
                        ...config.vapi,
                        allowPhoneOrderCreation: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded accent-amber-500"
                />
                <span>Send phone orders straight to Kitchen Orders tab</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.vapi.sendPaymentSmsAfterCall}
                  onChange={(e) =>
                    updateConfig({
                      vapi: {
                        ...config.vapi,
                        sendPaymentSmsAfterCall: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded accent-amber-500"
                />
                <span>Text caller a fast payment link after ordering</span>
              </label>
            </div>

            {/* Vapi API Key & Live Server Webhook Accordion */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedApiCard(
                      expandedApiCard === "vapi" ? null : "vapi"
                    )
                  }
                  className="flex items-center gap-2 text-left text-xs font-semibold text-slate-300 hover:text-white"
                >
                  <span>
                    🔑 Vapi Mode:{" "}
                    <strong className="text-amber-300">
                      {config.vapi.mode === "live"
                        ? "Live Vapi.ai Phone Line"
                        : "Practice / Simulated Call Mode"}
                    </strong>
                  </span>
                  {expandedApiCard === "vapi" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowVapiPayloadPreview(!showVapiPayloadPreview)
                  }
                  className="text-[11px] font-semibold text-amber-300 underline hover:text-amber-200"
                >
                  {showVapiPayloadPreview
                    ? "Hide AI Menu Brain"
                    : "View AI Menu Brain"}
                </button>
              </div>

              {expandedApiCard === "vapi" && (
                <div className="mt-3 space-y-2.5 border-t border-slate-800 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          vapi: { ...config.vapi, mode: "simulated" },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.vapi.mode === "simulated"
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Practice / Simulated Calls
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig({
                          vapi: { ...config.vapi, mode: "live" },
                        })
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        config.vapi.mode === "live"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      Live Vapi.ai Keys
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Vapi Assistant ID
                      </label>
                      <input
                        type="text"
                        value={config.vapi.assistantId}
                        onChange={(e) =>
                          updateConfig({
                            vapi: {
                              ...config.vapi,
                              assistantId: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Public Web Key
                      </label>
                      <input
                        type="text"
                        value={config.vapi.publicKey}
                        onChange={(e) =>
                          updateConfig({
                            vapi: {
                              ...config.vapi,
                              publicKey: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Private Key
                      </label>
                      <input
                        type="password"
                        value={config.vapi.privateKey}
                        onChange={(e) =>
                          updateConfig({
                            vapi: {
                              ...config.vapi,
                              privateKey: e.target.value,
                            },
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {showVapiPayloadPreview && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="text-[10px] font-bold text-amber-300 mb-1">
                    Live Vapi Assistant System Prompt & Tool Schema (Auto-Updates
                    When You Mark a Dish Sold Out):
                  </div>
                  <pre className="max-h-40 overflow-y-auto text-[10px] font-mono text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(vapiPayloadPreview, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* 1-Click Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <span className="text-[11px] text-slate-400">
              Webhook:{" "}
              <code className="text-slate-300">
                /api/webhooks/vapi?slug={restaurant.slug}
              </code>
            </span>
            <button
              type="button"
              disabled={busyAction === "simulate_vapi_phone_order"}
              onClick={() =>
                runIntegrationAction(
                  "simulate_vapi_phone_order",
                  { orderType: "delivery" },
                  "📞 Simulated Vapi AI Phone Order created! Check your Customer Orders tab."
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
            >
              <PhoneCall className="h-4 w-4" />
              {busyAction === "simulate_vapi_phone_order"
                ? "Simulating Call..."
                : "📞 Simulate Incoming Phone Order Now"}
            </button>
          </div>
        </div>
      </div>

      {/* RECENT INTEGRATION ACTIVITY CARDS (MULTI-CARD ROLL) */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-white">
              ⚡ Live App Activity & Webhook History ({activeAppsCount}/4 Apps
              Active)
            </h3>
            <p className="text-xs text-slate-400">
              Every time a DoorDash driver updates status, Square/Clover syncs
              your menu, or Vapi AI takes a phone order, it appears below as an
              easy-to-read card.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(config.activityLogs || []).slice(0, 8).map((log) => {
            const badgeMap = {
              doordash_drive: {
                icon: "🚗",
                label: "DoorDash Driver",
                cls: "bg-rose-500/20 text-rose-300 border-rose-500/30",
              },
              square: {
                icon: "⬛",
                label: "Square POS",
                cls: "bg-sky-500/20 text-sky-300 border-sky-500/30",
              },
              clover: {
                icon: "🍀",
                label: "Clover POS",
                cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
              },
              vapi: {
                icon: "📞",
                label: "Vapi Voice AI",
                cls: "bg-amber-500/20 text-amber-300 border-amber-500/30",
              },
            }[log.integration];

            return (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col justify-between space-y-2"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badgeMap.cls}`}
                    >
                      <span>{badgeMap.icon}</span>
                      {badgeMap.label}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-snug">
                    {log.action}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {log.summary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                  <span>⚡ Verified Event</span>
                  <span className="text-emerald-400 font-semibold">
                    ✓ {log.status.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
