"use client";

import React, { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Globe,
  HelpCircle,
  Mail,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
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

const TAB_PLAIN_GUIDES: Record<
  PortalTabId,
  {
    emoji: string;
    simpleTitle: string;
    whatYouDoHere: string;
    threeEasySteps: [string, string, string];
  }
> = {
  orders: {
    emoji: "🛍️",
    simpleTitle: "Step 1: Incoming Customer Food Orders",
    whatYouDoHere:
      "When a customer orders food on your website, it appears here immediately. You just click one button as you cook their food, and we automatically text the customer's phone!",
    threeEasySteps: [
      "1️⃣ Click 'Mark Confirmed' when you see a new order.",
      "2️⃣ Click 'Start Preparing' when the chef starts cooking.",
      "3️⃣ Click 'Mark Ready' when packed — customer gets a text message automatically!",
    ],
  },
  menu: {
    emoji: "🍲",
    simpleTitle: "Step 2: Your Food Menu, Prices & Sold-Out Button",
    whatYouDoHere:
      "Add new dishes with photos, change prices, add Portion Sizes (e.g., Regular Bowl vs Big Family Tray) & Side Dishes (e.g., Fried Plantain / Moi-Moi), or mark a dish Sold Out when it finishes.",
    threeEasySteps: [
      "1️⃣ Use the left box to add a new dish with photo & price.",
      "2️⃣ Click 'Mark Sold Out' on any dish card if it finishes in the kitchen.",
      "3️⃣ Click 'Edit / Update' on any dish to change its price, photo, or sides.",
    ],
  },
  inventory: {
    emoji: "📦",
    simpleTitle: "Step 3: Kitchen Pots, Meat Stock & Profit per Plate",
    whatYouDoHere:
      "Track your shared pots and meats (like Party Jollof Base, Asun Goat Meat, Egusi Soup, Plantain, Takeaway Packs & Cooking Gas) using simple cards.",
    threeEasySteps: [
      "1️⃣ Check green/yellow/red cards to see what is plenty or running low.",
      "2️⃣ Tap 'Refill Kitchen from Store Backup' when you bring items from your store/freezer.",
      "3️⃣ Open 'Profit per Plate' to see how much profit you keep on every plate sold.",
    ],
  },
  limits: {
    emoji: "🕒",
    simpleTitle: "Step 4: Pickup, Delivery, Opening Hours & Holiday Closures",
    whatYouDoHere:
      "Choose whether you offer Pickup, Delivery, or Eat-In, set your daily opening/closing times, and set how many orders your kitchen can handle per hour.",
    threeEasySteps: [
      "1️⃣ Turn Pickup, Delivery, or Eat-In ON or OFF with 1 click.",
      "2️⃣ Set your Monday–Sunday opening & closing hours.",
      "3️⃣ Add a Holiday / Private Party Closure if you are closing for an event.",
    ],
  },
  customers: {
    emoji: "👥",
    simpleTitle: "Step 5: Your Customer List & VIP Regulars",
    whatYouDoHere:
      "Every customer who orders from your website is saved here automatically with their phone number, email, and how many times they have ordered.",
    threeEasySteps: [
      "1️⃣ Search any customer by name or phone number.",
      "2️⃣ Add walk-in or VIP party customers manually on the left.",
      "3️⃣ See who your biggest spenders and repeat regulars are.",
    ],
  },
  sms: {
    emoji: "📲",
    simpleTitle: "Step 6: Automatic Phone Text Alerts (SMS)",
    whatYouDoHere:
      "Already connected for you! No technical setup needed. Put your kitchen phone number here so you get a text alert every time a new order arrives.",
    threeEasySteps: [
      "1️⃣ Enter your mobile phone number to receive new-order text alerts.",
      "2️⃣ Check the boxes for which updates customers receive by text.",
      "3️⃣ Send a quick promo text message to all your customers anytime.",
    ],
  },
  email: {
    emoji: "✉️",
    simpleTitle: "Step 7: Send Promo & Weekend Special Emails",
    whatYouDoHere:
      "Send a friendly email with a discount code (like Weekend Jollof & Suya Special) to all your past customers in 1 click.",
    threeEasySteps: [
      "1️⃣ Type a catchy subject line (e.g. '15% Off Friday Night Suya & Jollof!').",
      "2️⃣ Choose 'All Customers' or 'VIP Guests' and add a promo code.",
      "3️⃣ Click 'Send Email Now' — see how many orders it brings in!",
    ],
  },
  payments: {
    emoji: "💳",
    simpleTitle: "Step 8: Receive Customer Payments, Tax & Delivery Fee",
    whatYouDoHere:
      "Connect your Stripe, PayPal, Square, or Clover account so customer payments go straight to your bank, and set your Delivery Fee.",
    threeEasySteps: [
      "1️⃣ Turn Stripe, PayPal, Square, or Clover ON.",
      "2️⃣ Set your Sales Tax % and Delivery Fee ($).",
      "3️⃣ Click 'Save Payment & Fee Settings'.",
    ],
  },
  integrations: {
    emoji: "🔌",
    simpleTitle: "Step 9: Plug & Play Apps (DoorDash Driver, Square, Clover & Vapi Voice AI)",
    whatYouDoHere:
      "Connect your kitchen to 4 powerful helpers in 1 click: call a DoorDash Driver for website deliveries (0% commission!), sync your Square or Clover register & kitchen printer, and let Vapi AI answer phone calls and take food orders 24/7.",
    threeEasySteps: [
      "1️⃣ Flip the ON/OFF switch on any of the 4 cards (DoorDash Driver, Square, Clover, or Vapi Phone AI).",
      "2️⃣ Tap the 1-Click Test button on any card to watch a simulated driver, POS sync, or phone call in action.",
      "3️⃣ When ready for real customers, switch from 'Practice / Demo Mode' to 'Live Mode' and paste your account ID.",
    ],
  },
  domain: {
    emoji: "🌐",
    simpleTitle: "Step 10: Website Address, Logo, About Us & Policies",
    whatYouDoHere:
      "Customize how your website looks! Upload your restaurant logo, write your 'About Us' story (shown right under your top banner), edit your footer contact info, and update your Refund/Privacy rules.",
    threeEasySteps: [
      "1️⃣ Pick your brand color and website layout style at the top.",
      "2️⃣ Scroll down to upload your Logo and edit your 'About Us' story.",
      "3️⃣ Edit your Footer contact info, Privacy Policy & Terms in plain words.",
    ],
  },
  team: {
    emoji: "👨‍🍳",
    simpleTitle: "Step 11: Kitchen, Cashier & Manager Staff Accounts",
    whatYouDoHere:
      "Create simple 4-digit PIN codes for your Head Chef, Cashier, or Manager so they only see the screens they need (without touching your bank or website settings).",
    threeEasySteps: [
      "1️⃣ Enter your staff member's name and choose their job (Chef, Cashier, Manager).",
      "2️⃣ Give them a simple 4-digit PIN code (like 5501).",
      "3️⃣ Click 'Preview Role' to see how simple their screen looks!",
    ],
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
  const [showGuide, setShowGuide] = useState(true);
  const currentGuide = TAB_PLAIN_GUIDES[activeTab] || TAB_PLAIN_GUIDES.orders;

  return (
    <div className="mb-6 space-y-3">
      {/* Quick 5-Card Action Roll for Beginners */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 px-3 py-0.5 text-[11px] font-bold text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              Easy Owner Shortcut Cards
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Tap any card below to jump straight to what you want to do today:
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:text-white"
          >
            <HelpCircle className="h-3.5 w-3.5 text-orange-400" />
            {showGuide ? "Hide Step-by-Step Help" : "Show Step-by-Step Help"}
          </button>
        </div>

        {/* Multi-Card Row of 6 Everyday Owner Actions */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => onSelectTab("orders")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              activeTab === "orders"
                ? "border-orange-500 bg-orange-500/15 text-white shadow"
                : "border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🛍️</span>
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-300">
                {pendingOrdersCount} Active
              </span>
            </div>
            <div className="mt-2 text-xs font-bold text-white">
              1. Check Orders
            </div>
            <div className="text-[10px] text-slate-400">
              Confirm & mark food ready
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("menu")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              activeTab === "menu"
                ? "border-orange-500 bg-orange-500/15 text-white shadow"
                : "border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🍲</span>
              {soldOutDishesCount > 0 ? (
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                  {soldOutDishesCount} Sold Out
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  All Live
                </span>
              )}
            </div>
            <div className="mt-2 text-xs font-bold text-white">
              2. Menu & Prices
            </div>
            <div className="text-[10px] text-slate-400">
              Add food or mark Sold Out
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("inventory")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              activeTab === "inventory"
                ? "border-orange-500 bg-orange-500/15 text-white shadow"
                : "border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">📦</span>
              {lowStockCount > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                  {lowStockCount} Low
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  Stock OK
                </span>
              )}
            </div>
            <div className="mt-2 text-xs font-bold text-white">
              3. Pots & Profit
            </div>
            <div className="text-[10px] text-slate-400">
              Kitchen stock & profit cards
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("limits")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              activeTab === "limits"
                ? "border-orange-500 bg-orange-500/15 text-white shadow"
                : "border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🕒</span>
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                Hours
              </span>
            </div>
            <div className="mt-2 text-xs font-bold text-white">
              4. Hours & Delivery
            </div>
            <div className="text-[10px] text-slate-400">
              Opening times & delivery fee
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("domain")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              activeTab === "domain"
                ? "border-orange-500 bg-orange-500/15 text-white shadow"
                : "border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🎨</span>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">
                Website
              </span>
            </div>
            <div className="mt-2 text-xs font-bold text-white">
              5. Logo & About Us
            </div>
            <div className="text-[10px] text-slate-400">
              Edit website look & policies
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("integrations")}
            className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
              activeTab === "integrations"
                ? "border-orange-500 bg-orange-500/15 text-white shadow"
                : "border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base">🔌</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                4 Apps
              </span>
            </div>
            <div className="mt-2 text-xs font-bold text-white">
              6. Plug & Play Apps
            </div>
            <div className="text-[10px] text-slate-400">
              DoorDash, Square, Clover & Vapi
            </div>
          </button>
        </div>

        {/* Contextual Plain-English Guide for the Active Page */}
        {showGuide && (
          <div className="rounded-xl border border-orange-500/30 bg-slate-950/90 p-4 space-y-3">
            <div>
              <div className="text-xs font-bold text-orange-300">
                {currentGuide.emoji} {currentGuide.simpleTitle}
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                {currentGuide.whatYouDoHere}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {currentGuide.threeEasySteps.map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-200"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OwnerBeginnerGuideBar;

