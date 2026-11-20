"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Globe,
  Layers,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

const PROBLEMS_AND_SOLUTIONS = [
  {
    problemTag: "Problem #1: Marketplace Commissions",
    problemTitle: "Paying 25%–30% of every order to third-party apps",
    problemDesc:
      "Marketplace apps take nearly a third of your revenue, hide your customer data, and list your competitors right next to your menu.",
    solutionTitle: "Commission-Free Storefront on Your Own Custom Domain",
    solutionDesc:
      "Launch a fast, mobile-first ordering site on your own domain (e.g. orders.yourrestaurant.com) with automatic SSL. Funds go 100% directly to your Stripe, PayPal, Square, or Clover account.",
    metrics: "Save $3,000–$8,500+/mo in fees",
    icon: Globe,
    accent: "from-orange-500 to-rose-600",
    badgeTone: "text-orange-300 border-orange-500/30 bg-orange-500/10",
  },
  {
    problemTag: "Problem #2: Kitchen Overload & Sold-Out Chaos",
    problemTitle: "Too many tickets at peak hour & customers ordering 86'd dishes",
    problemDesc:
      "Friday night rushes overwhelm the line when online orders flood in all at once, or guests order items that just ran out in the kitchen.",
    solutionTitle: "Smart Order Throttling, Blackout Windows & 1-Click 86ing",
    solutionDesc:
      "Set hourly/daily order caps, active ticket limits, and blackout schedules. Link ingredients to dishes so when stock hits zero, dependent menu items automatically 86 themselves across web and POS.",
    metrics: "Zero kitchen bottlenecks",
    icon: Clock,
    accent: "from-emerald-500 to-teal-600",
    badgeTone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    problemTag: "Problem #3: Missed Phone Calls & Busy Managers",
    problemTitle: "Staff tied up answering phones or clicking through 10 screens",
    problemDesc:
      "During service, nobody has time to answer routine phone orders or dig through complex back-office menus to change a price or text customers.",
    solutionTitle: "Owner AI Co-Pilot + 24/7 AI Phone & Web Ordering Agents",
    solutionDesc:
      "Your built-in Owner AI Agent executes any dashboard task by voice or chat ('Start preparing all confirmed orders', '86 Truffle Burger', 'Restock low items'). Plus, Vapi Voice AI & Web Concierge take guest orders 24/7.",
    metrics: "Save 12+ hrs/week of admin work",
    icon: Bot,
    accent: "from-amber-500 to-orange-600",
    badgeTone: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  },
  {
    problemTag: "Problem #4: Delivery Driver Headaches",
    problemTitle: "Wanting to offer delivery without hiring in-house drivers",
    problemDesc:
      "Managing your own delivery fleet is expensive and unpredictable, but marketplace delivery apps eat your entire profit margin.",
    solutionTitle: "On-Demand DoorDash Drive White-Label Dispatch",
    solutionDesc:
      "Keep direct online orders on your website and automatically dispatch flat-fee DoorDash Drive couriers the moment an order is confirmed—with real-time live Dasher tracking links texted to your guest.",
    metrics: "Flat-fee dispatch, 0% commission",
    icon: Truck,
    accent: "from-rose-500 to-pink-600",
    badgeTone: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  },
  {
    problemTag: "Problem #5: Double Entry Across POS & Kitchen",
    problemTitle: "Re-typing online tickets into Square or Clover POS",
    problemDesc:
      "Juggling separate tablets and manually punching web orders into your kitchen printer leads to costly mistakes and slow ticket times.",
    solutionTitle: "2-Way Square & Clover POS Sync",
    solutionDesc:
      "Platerift syncs your menu catalog, prices, and 86 status with Square and Clover and pushes paid web & phone orders straight to your Kitchen Display System (KDS).",
    metrics: "100% unified kitchen flow",
    icon: Layers,
    accent: "from-sky-500 to-indigo-600",
    badgeTone: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  },
  {
    problemTag: "Problem #6: One-Time Guests Who Never Return",
    problemTitle: "No way to bring guests back on slow Tuesday nights",
    problemDesc:
      "When guests order on third-party apps, you never get their phone number or email, making it impossible to build repeat regulars.",
    solutionTitle: "Built-In Guest CRM, VIP Loyalty, Twilio SMS & Email Blasts",
    solutionDesc:
      "Every order automatically builds your guest CRM with spend history, VIP tags, loyalty points, recurring scheduled reorders, automated Twilio SMS order alerts, and 1-click promo campaigns.",
    metrics: "2.4x higher repeat order rate",
    icon: MessageSquare,
    accent: "from-purple-500 to-violet-600",
    badgeTone: "text-purple-300 border-purple-500/30 bg-purple-500/10",
  },
];

const DEMO_RESTAURANTS = [
  {
    name: "Bella Napoli Trattoria",
    slug: "bella-napoli",
    cuisine: "Artisanal Wood-Fired Pizza & Pasta",
    emoji: "🍕",
    domain: "orders.bellanapoli.com",
    subdomain: "bella-napoli.platerift.com",
    highlight: "Editorial Warmth theme • DoorDash Drive + Square POS",
  },
  {
    name: "Sakura Izakaya & Sushi",
    slug: "sakura-sushi",
    cuisine: "Authentic Tokyo Ramen & Omakase Sushi",
    emoji: "🍣",
    domain: "eat.sakurasushi.io",
    subdomain: "sakura-sushi.platerift.com",
    highlight: "Midnight Luxe theme • Clover KDS + Vapi Voice AI",
  },
  {
    name: "Fuego Craft Taqueria",
    slug: "fuego-taqueria",
    cuisine: "Birria Tacos, Quesabirria & Craft Aguas Frescas",
    emoji: "🌮",
    domain: "tacos.fuegotaqueria.com",
    subdomain: "fuego-taqueria.platerift.com",
    highlight: "Vibrant Streetfood theme • Food Truck Commissary Stock",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Launch Your Branded Storefront in 60 Seconds",
    desc: "Pick a culinary theme, connect your custom domain, and import or build your menu with modifiers, dietary tags, and prep times.",
  },
  {
    step: "02",
    title: "Connect Direct Payouts & POS",
    desc: "Link your Stripe, PayPal, Square, or Clover account so 100% of every order goes straight to your bank, and enable DoorDash Drive for delivery.",
  },
  {
    step: "03",
    title: "Run Service Hands-Free with Your Owner AI Agent",
    desc: "Accept web, QR dine-in, and AI phone orders while your Owner AI Co-Pilot helps you prep tickets, 86 items, track food cost, and text VIP guests.",
  },
];

export default function MarketingLandingPage() {
  const [liveDemos, setLiveDemos] = useState(DEMO_RESTAURANTS);

  useEffect(() => {
    fetch("/api/restaurants?view=public", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.restaurants) && data.restaurants.length > 0) {
          setLiveDemos(
            data.restaurants.map(
              (r: {
                name: string;
                slug: string;
                cuisine: string;
                logoEmoji?: string;
                customDomain?: string;
                subdomain?: string;
                tagline?: string;
              }) => {
                const preset = DEMO_RESTAURANTS.find((d) => d.slug === r.slug);
                return {
                  name: r.name,
                  slug: r.slug,
                  cuisine: r.cuisine,
                  emoji: r.logoEmoji || preset?.emoji || "🍽️",
                  domain:
                    r.customDomain ||
                    preset?.domain ||
                    `${r.slug}.platerift.com`,
                  subdomain: r.subdomain || `${r.slug}.platerift.com`,
                  highlight:
                    preset?.highlight ||
                    r.tagline ||
                    "Custom Domain Storefront • Direct Online Ordering",
                };
              }
            )
          );
        }
      })
      .catch(() => {
        // Keep default demo cards
      });
  }, []);

  const primaryDemoDomain =
    liveDemos[0]?.domain || "orders.bellanapoli.com";

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090b10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">
                Platerift
              </span>
              <span className="ml-2 hidden sm:inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300">
                Hospitality OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <a href="#problems-solved" className="hover:text-white transition">
              Solutions
            </a>
            <a href="#owner-ai" className="hover:text-white transition">
              Owner AI
            </a>
            <a href="#how-it-works" className="hover:text-white transition">
              How It Works
            </a>
            <a href="#live-demos" className="hover:text-white transition">
              Live Demos
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/dashboard/${encodeURIComponent(primaryDemoDomain)}`}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0f131b] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-orange-500/40 hover:text-white transition"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-orange-400" />
              Try Owner Portal
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-rose-700 transition"
            >
              <span>Platform Admin</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.06] pt-14 pb-16 sm:pt-22 sm:pb-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/15 via-[#090b10] to-[#090b10]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 text-xs font-medium text-orange-300">
            <Sparkles className="h-3.5 w-3.5" />
            Built for Independent Restaurants, Multi-Unit Groups &amp; Food
            Trucks
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
            Stop Paying 30% Commissions.{" "}
            <span className="font-serif italic font-medium bg-gradient-to-r from-orange-300 via-amber-200 to-rose-300 bg-clip-text text-transparent">
              Own Your Orders, Kitchen &amp; Guests.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base text-slate-300/90 leading-relaxed">
            Launch a custom-domain ordering storefront with smart kitchen
            throttling, ingredient &amp; food-cost tracking, DoorDash Drive
            dispatch, Square &amp; Clover POS sync, and an{" "}
            <strong className="font-semibold text-white">
              Owner AI Co-Pilot
            </strong>{" "}
            that executes operational tasks on command.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/dashboard/${encodeURIComponent(primaryDemoDomain)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-orange-500/25 hover:from-orange-600 hover:to-rose-700 transition"
            >
              <LayoutDashboard className="h-4 w-4" />
              Explore Live Owner Dashboard
            </Link>
            <Link
              href={`/store/${encodeURIComponent(primaryDemoDomain)}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0f131b] px-6 py-3.5 text-sm font-semibold text-slate-100 hover:border-white/30 hover:bg-white/[0.06] transition"
            >
              <Store className="h-4 w-4 text-emerald-400" />
              View Sample Storefront
            </Link>
          </div>

          <div className="mt-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-orange-300 transition"
            >
              <span>Or onboard a new restaurant in Platform Admin</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Value Strip */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-left">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f131b]/90 p-4">
              <div className="text-xs font-medium text-slate-400">
                Commission Fees
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">
                0%
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Direct payouts to your bank
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f131b]/90 p-4">
              <div className="text-xs font-medium text-slate-400">
                Payment Gateways
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-white">
                4 Native
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Stripe, PayPal, Square &amp; Clover
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f131b]/90 p-4">
              <div className="text-xs font-medium text-slate-400">
                AI Automation
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-orange-400">
                3 Agents
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Owner Co-Pilot, Web &amp; Phone AI
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f131b]/90 p-4">
              <div className="text-xs font-medium text-slate-400">
                Setup Time
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-sky-400">
                60 Sec
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Instant custom domain &amp; SSL
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Section: Every Restaurant Problem & How Platerift Solves It */}
      <section
        id="problems-solved"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
            Problem → Solution
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            How Platerift Eliminates the 6 Biggest Restaurant Bottlenecks
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-400">
            Replace disconnected tablets, manual POS re-entry, and 30%
            marketplace fees with one cohesive operating system.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS_AND_SOLUTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.problemTag}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0f131b]/90 p-6 shadow-xl transition hover:-translate-y-0.5 hover:border-orange-500/30"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${item.badgeTone}`}
                    >
                      {item.problemTag}
                    </span>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-md`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Pain point callout (clean border-left typography, zero double box) */}
                  <div className="border-l-2 border-rose-500/45 pl-3 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/90">
                      Before: {item.problemTitle}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.problemDesc}
                    </p>
                  </div>

                  {/* Solution */}
                  <div className="border-t border-white/[0.06] pt-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      With Platerift
                    </div>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      {item.solutionTitle}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.solutionDesc}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-xs">
                  <span className="font-medium text-slate-400">Impact</span>
                  <span className="font-semibold text-emerald-400">
                    {item.metrics}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Spotlight Section: Owner AI Agent + Customer AI Agents */}
      <section
        id="owner-ai"
        className="border-y border-white/[0.06] bg-gradient-to-b from-[#0f131b]/70 to-[#090b10] py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                <Bot className="h-3.5 w-3.5" />
                Hands-Free Restaurant Management
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                Meet Your Built-In{" "}
                <span className="text-orange-400">Owner AI Agent</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Manage rush service without digging through back-office menus.
                Tell your{" "}
                <strong className="text-white">Platerift Owner AI Agent</strong>{" "}
                what needs to happen by voice or chat and it updates live state
                immediately.
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                {[
                  '"Start preparing all confirmed orders"',
                  '"86 the Truffle Mushroom Pizza"',
                  '"Add Smoky Jollof & Suya $18.50"',
                  '"Restock all low stock items to par"',
                  '"Pause online ordering for 30 minutes"',
                  '"Send SMS blast: 15% off tonight!"',
                ].map((cmd) => (
                  <div
                    key={cmd}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0f131b] px-3.5 py-2.5 font-mono text-slate-200"
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                    <span>{cmd}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  href={`/dashboard/${encodeURIComponent(primaryDemoDomain)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-rose-700 transition"
                >
                  Test Owner AI Agent Live
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Interactive Preview Card of the 3 AI Agents */}
            <div className="lg:col-span-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-orange-500/30 bg-[#0f131b] p-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        1. Owner Portal AI Co-Pilot
                      </h3>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Back-of-House
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Advances kitchen tickets, updates prices, 86s items,
                      restocks inventory, adjusts hours, and sends SMS/email
                      promos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0f131b] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        2. Storefront AI Menu Concierge
                      </h3>
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        Web Ordering
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Answers guest allergy and dietary questions, recommends
                      popular pairings, and builds the customer&apos;s bag
                      directly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0f131b] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        3. Vapi 24/7 Inbound Phone AI
                      </h3>
                      <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                        Voice Line
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Answers inbound calls using live menu availability and
                      operating hours, injects tickets into KDS, and texts a
                      checkout link.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (3 Simple Steps) */}
      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
            Simple Onboarding
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            From Sign-Up to Taking Direct Orders in 3 Steps
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {WORKFLOW_STEPS.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-white/[0.08] bg-[#0f131b]/90 p-6"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30 font-mono text-xs font-bold text-orange-300">
                {item.step}
              </span>
              <h3 className="mt-4 text-base font-bold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Live Restaurant Demos */}
      <section
        id="live-demos"
        className="border-t border-white/[0.06] bg-[#0c0f16]/80 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Live Environments
              </span>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Explore Live Demo Restaurants on Platerift
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-400">
                Test both sides of the platform: order on a branded storefront
                or run live service in the Owner Portal.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0f131b] px-4 py-2.5 text-xs font-semibold text-white hover:border-white/25 transition"
            >
              Open Super Admin Console
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {liveDemos.map((demo) => (
              <div
                key={demo.slug}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0f131b] p-6 shadow-xl transition hover:-translate-y-0.5 hover:border-white/[0.16]"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#090b10] text-2xl">
                      {demo.emoji}
                    </span>
                    <Link
                      href={`/?domain=${encodeURIComponent(demo.domain)}`}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                      title={`Launch custom domain storefront: ${demo.domain}`}
                    >
                      <Globe className="h-3 w-3" />
                      {demo.domain}
                    </Link>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">
                    {demo.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">{demo.cuisine}</p>
                  <p className="mt-1 font-mono text-[11px] text-sky-400">
                    Host: {demo.subdomain}
                  </p>
                  <p className="mt-3 rounded-xl border border-white/[0.07] bg-[#090b10] px-3 py-2 text-[11px] text-slate-300">
                    {demo.highlight}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  <Link
                    href={`/dashboard/${encodeURIComponent(demo.domain)}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3 py-2.5 text-xs font-semibold text-white hover:from-orange-600 hover:to-rose-700 transition"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Owner Portal
                  </Link>
                  <Link
                    href={`/store/${encodeURIComponent(demo.domain)}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#090b10] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                    Storefront
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#090b10] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 text-white">
              <UtensilsCrossed className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-slate-300">Platerift</span>
            <span>— Direct Ordering &amp; AI Hospitality Operations</span>
          </div>
          <div className="flex items-center gap-5 text-slate-400">
            <Link
              href={`/dashboard/${encodeURIComponent(primaryDemoDomain)}`}
              className="hover:text-white transition"
            >
              Owner Portal Demo
            </Link>
            <Link
              href={`/store/${encodeURIComponent(primaryDemoDomain)}`}
              className="hover:text-white transition"
            >
              Storefront Demo
            </Link>
            <Link href="/admin" className="hover:text-white transition">
              Super Admin Console
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

