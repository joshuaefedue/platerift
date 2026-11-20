"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Globe,
  HelpCircle,
  Mail,
  MessageSquare,
  Package,
  Plug,
  ShieldCheck,
  ShoppingBag,
  Users,
  Utensils,
} from "lucide-react";
import { PortalTabId } from "@/lib/types";

interface OwnerBeginnerGuideBarProps {
  activeTab: PortalTabId;
  onSelectTab: (tab: PortalTabId) => void;
  restaurantName: string;
  soldOutDishesCount: number;
  lowStockCount: number;
  pendingOrdersCount: number;
}

const TAB_GUIDES: Record<
  PortalTabId,
  {
    title: string;
    whatYouDoHere: string;
    threeEasySteps: [string, string, string];
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  orders: {
    title: "Live Orders & Kitchen Queue",
    whatYouDoHere:
      "Track incoming customer orders from web, QR dine-in, and voice AI. Advance ticket status to trigger automatic customer SMS updates.",
    threeEasySteps: [
      "Click Actions on a new ticket to confirm it and send an SMS confirmation.",
      "Move orders to Preparing when fired on the line.",
      "Mark Ready when packed for counter pickup or DoorDash courier handoff.",
    ],
    icon: ShoppingBag,
  },
  menu: {
    title: "Menu Builder & 86 Controls",
    whatYouDoHere:
      "Add dishes, upload photos, configure portion sizes and sides, or toggle sold-out status across web and POS.",
    threeEasySteps: [
      "Add new dishes with photos, pricing, dietary tags, and prep times.",
      "Toggle availability to immediately mark sold-out items across your storefront.",
      "Edit dishes to manage portion variants and side options.",
    ],
    icon: Utensils,
  },
  inventory: {
    title: "Kitchen Stock & Plate Margins",
    whatYouDoHere:
      "Monitor line stock, freezer backup levels, ingredient-to-dish auto-86 links, and per-plate COGS margins.",
    threeEasySteps: [
      "Watch Healthy, Low, and Out-of-Stock counts across your prep stations.",
      "Tap Refill from Store to transfer backup commissary stock onto the line.",
      "Review Plate Margins to check food cost percentages and gross profit.",
    ],
    icon: Package,
  },
  limits: {
    title: "Hours, Fulfillment & Capacity",
    whatYouDoHere:
      "Manage pickup, delivery, and dine-in channels alongside operating hours, order caps, and scheduled blackout closures.",
    threeEasySteps: [
      "Enable or configure Pickup, Delivery, and Dine-In QR channels.",
      "Set daily opening and closing service windows for each day of the week.",
      "Add blackout closures for holidays, private events, or kitchen breaks.",
    ],
    icon: CalendarClock,
  },
  customers: {
    title: "Guest CRM & Loyalty",
    whatYouDoHere:
      "Every storefront and phone order builds your guest directory with spend history, VIP tags, and reorder activity.",
    threeEasySteps: [
      "Search guests by name, email, or phone number.",
      "Add walk-in or catering VIP contacts manually when needed.",
      "Identify repeat regulars for targeted SMS and email promotions.",
    ],
    icon: Users,
  },
  sms: {
    title: "Automated SMS Alerts",
    whatYouDoHere:
      "Powered centrally by Platerift's Twilio gateway. Configure your owner alert number, guest event triggers, and promotional broadcasts.",
    threeEasySteps: [
      "Enter the mobile number that should receive instant new-order alerts.",
      "Choose which order milestones automatically text customers.",
      "Send targeted or all-guest SMS promos directly from this workspace.",
    ],
    icon: MessageSquare,
  },
  email: {
    title: "Email Marketing & Promo Codes",
    whatYouDoHere:
      "Launch branded HTML campaigns with trackable discount codes that validate automatically at checkout.",
    threeEasySteps: [
      "Write your subject line and campaign message.",
      "Select All Guests or VIP Regulars and attach a promo code.",
      "Send now and track campaign redemptions and engagement.",
    ],
    icon: Mail,
  },
  payments: {
    title: "Direct Payments, Tax & Fees",
    whatYouDoHere:
      "Connect your Stripe, Square, Clover, or PayPal credentials for 0%-commission payouts alongside tax and delivery fees.",
    threeEasySteps: [
      "Enable the card and wallet gateways active on your storefront checkout.",
      "Configure sales tax percentage and delivery fee / minimum spend rules.",
      "Save settings to update checkout calculation immediately.",
    ],
    icon: CreditCard,
  },
  integrations: {
    title: "Integrations: DoorDash, Square, Clover & Vapi",
    whatYouDoHere:
      "Connect white-label DoorDash Drive couriers, 2-way Square or Clover POS sync, and Vapi 24/7 inbound voice AI ordering.",
    threeEasySteps: [
      "Toggle on any unlocked integration card to activate its workflow.",
      "Use Practice / Sandbox test actions before going live in production.",
      "Switch to Live mode or connect OAuth when ready for service.",
    ],
    icon: Plug,
  },
  domain: {
    title: "Website, Domain, Logo & About Us",
    whatYouDoHere:
      "Customize your storefront theme, upload your restaurant logo, edit your About Us story, footer links, and policy pages.",
    threeEasySteps: [
      "Choose your brand accent color, storefront layout preset, and domain.",
      "Upload or link your logo and refine your About Us story.",
      "Customize footer contact details, hours summary, and store policies.",
    ],
    icon: Globe,
  },
  team: {
    title: "Staff Accounts, PINs & Roles",
    whatYouDoHere:
      "Create role-scoped portal credentials and quick POS PINs for General Managers, Head Chefs, Cashiers, and Marketing leads.",
    threeEasySteps: [
      "Add staff with name, email, role, and a quick terminal PIN.",
      "Use Role Switcher preview to inspect exact permissions per role.",
      "Suspend or adjust staff access at any time with zero downtime.",
    ],
    icon: ShieldCheck,
  },
};

export function OwnerBeginnerGuideBar({
  activeTab,
  onSelectTab,
  restaurantName,
  soldOutDishesCount,
  lowStockCount,
  pendingOrdersCount,
}: OwnerBeginnerGuideBarProps) {
  const [showGuide, setShowGuide] = useState(false);
  const currentGuide = TAB_GUIDES[activeTab] || TAB_GUIDES.orders;
  const ActiveIcon = currentGuide.icon;

  return (
    <div className="mb-5 rounded-2xl border border-white/[0.08] bg-[#0f131b]/95 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Active section title & subtle restaurant context */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400">
            <ActiveIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-xs sm:text-sm font-semibold text-white">
                {currentGuide.title}
              </span>
              <span className="hidden md:inline text-[11px] text-slate-500">
                • {restaurantName}
              </span>
            </div>
            <p className="hidden lg:block truncate text-[11px] text-slate-400">
              {currentGuide.whatYouDoHere}
            </p>
          </div>
        </div>

        {/* Right: Actionable pulse pills + Quick Guide toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectTab("orders")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition ${
              activeTab === "orders"
                ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                : pendingOrdersCount > 0
                ? "border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
                : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShoppingBag className="h-3 w-3" />
            <span>{pendingOrdersCount} Active Orders</span>
          </button>

          {soldOutDishesCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectTab("menu")}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-rose-300 hover:bg-rose-500/20 transition"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{soldOutDishesCount} Sold Out</span>
            </button>
          )}

          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectTab("inventory")}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-300 hover:bg-amber-500/20 transition"
            >
              <Package className="h-3 w-3" />
              <span>{lowStockCount} Low Stock</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
              showGuide
                ? "border-orange-500/40 bg-orange-500/15 text-orange-200"
                : "border-white/10 bg-[#090b10] text-slate-300 hover:border-white/20 hover:text-white"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5 text-orange-400" />
            <span>Quick Guide</span>
            {showGuide ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Step-by-Step Guide */}
      {showGuide && (
        <div className="mt-3 border-t border-white/[0.08] pt-3 space-y-2.5">
          <p className="text-xs text-slate-300 lg:hidden">
            {currentGuide.whatYouDoHere}
          </p>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {currentGuide.threeEasySteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-[#090b10]/90 px-3 py-2.5 text-xs text-slate-300"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/15 font-mono text-[10px] font-bold text-orange-300">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerBeginnerGuideBar;
