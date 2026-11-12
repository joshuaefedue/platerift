"use client";

import React from "react";
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
    name: "Bella Napoli Pizzeria",
    slug: "bella-napoli",
    cuisine: "Artisanal Wood-Fired Pizza & Pasta",
    emoji: "🍕",
    domain: "orders.bellanapoli.com",
    highlight: "Editorial Warmth theme • DoorDash Drive + Square POS",
  },
  {
    name: "Sakura Izakaya & Ramen",
    slug: "sakura-izakaya",
    cuisine: "Authentic Tokyo Ramen & Omakase Sushi",
    emoji: "🍜",
    domain: "order.sakuraramen.io",
    highlight: "Midnight Luxe theme • Clover KDS + Vapi Voice AI",
  },
  {
    name: "Fuego Street Taqueria",
    slug: "fuego-taqueria",
    cuisine: "Birria Tacos, Quesabirria & Craft Aguas Frescas",
    emoji: "🌮",
    domain: "eat.fuegotaqueria.com",
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
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white">
                Platerift
              </span>
              <span className="ml-2 hidden sm:inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                For Restaurant Owners
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#problems-solved" className="hover:text-white transition">
              How We Solve Your Problems
            </a>
            <a href="#owner-ai" className="hover:text-white transition">
              Owner AI Agent
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
              href="/dashboard/bella-napoli"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-orange-500/40 hover:text-white transition"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-orange-400" />
              Try Owner Portal
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-rose-700 transition"
            >
              <span>Platform Admin</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-900 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/15 via-slate-950 to-slate-950" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-300">
            <Sparkles className="h-3.5 w-3.5" />
            Built for Independent Restaurants, Multi-Unit Groups & Food Trucks
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.12]">
            Stop Paying 30% Commissions.{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-rose-400 bg-clip-text text-transparent">
              Own Your Orders, Kitchen & Guests.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Platerift gives your restaurant its own custom-domain ordering
            storefront, smart kitchen throttling, real-time ingredient &amp;
            food-cost tracking, DoorDash Drive dispatch, Square/Clover POS sync,
            and an{" "}
            <strong className="text-white">Owner AI Co-Pilot</strong> that runs
            your dashboard tasks on command.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/dashboard/bella-napoli"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-500/25 hover:from-orange-600 hover:to-rose-700 transition"
            >
              <LayoutDashboard className="h-4 w-4" />
              Explore Live Owner Dashboard
            </Link>
            <Link
              href="/store/bella-napoli"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/90 px-6 py-3.5 text-sm font-bold text-slate-100 hover:border-slate-500 hover:bg-slate-800 transition"
            >
              <Store className="h-4 w-4 text-emerald-400" />
              View Sample Customer Storefront
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-5 py-3.5 text-sm font-semibold text-slate-300 hover:border-orange-500/40 hover:text-white transition"
            >
              Onboard a New Restaurant
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Value Strip */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-left">
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold text-slate-400">
                Commission Fees
              </div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-400">
                0%
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                100% direct payouts to your bank
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold text-slate-400">
                Payment Gateways
              </div>
              <div className="mt-1 text-2xl font-extrabold text-white">
                4 Native
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Stripe, PayPal, Square &amp; Clover
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold text-slate-400">
                AI Automation
              </div>
              <div className="mt-1 text-2xl font-extrabold text-orange-400">
                3 Agents
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Owner Co-Pilot, Web &amp; Phone AI
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold text-slate-400">
                Setup Time
              </div>
              <div className="mt-1 text-2xl font-extrabold text-sky-400">
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
          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
            Problem → Solution Breakdown
          </span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            How Platerift Solves the 6 Biggest Headaches in Running a Restaurant
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-400">
            Instead of stitching together 7 disconnected tools, every module in
            Platerift is engineered to eliminate a specific profit leak or
            operational bottleneck.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS_AND_SOLUTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.problemTag}
                className="flex flex-col justify-between rounded-3xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl transition hover:border-slate-700"
              >
                <div className="space-y-4">
                  {/* Problem Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${item.badgeTone}`}
                    >
                      {item.problemTag}
                    </span>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-md`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                      The Restaurant Pain Point
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-white">
                      {item.problemTitle}
                    </h3>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      {item.problemDesc}
                    </p>
                  </div>

                  {/* Solution Block */}
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      The Platerift Solution
                    </div>
                    <h4 className="mt-1 text-sm font-bold text-white">
                      {item.solutionTitle}
                    </h4>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      {item.solutionDesc}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3.5 text-xs">
                  <span className="font-semibold text-slate-400">Impact:</span>
                  <span className="font-bold text-emerald-400">
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
        className="border-y border-slate-900 bg-gradient-to-b from-slate-900/60 to-slate-950 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                <Bot className="h-3.5 w-3.5" />
                Hands-Free Restaurant Management
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                Meet Your Built-In{" "}
                <span className="text-orange-400">Owner AI Agent</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                You shouldn&apos;t need to click through 15 settings tabs while
                expediting on the line. Just ask your{" "}
                <strong className="text-white">Platerift Owner AI Agent</strong>{" "}
                by voice or text, and it executes the exact task on your live
                dashboard immediately.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
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
                    className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 font-mono text-slate-200"
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                    <span>{cmd}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard/bella-napoli"
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-bold text-white hover:bg-orange-600 transition"
                >
                  Test the Owner AI Agent Live
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Interactive Preview Card of the 3 AI Agents */}
            <div className="lg:col-span-6 grid grid-cols-1 gap-4">
              <div className="rounded-3xl border border-orange-500/30 bg-slate-900/90 p-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 text-white">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        1. Owner Portal AI Co-Pilot
                      </h3>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        Back-of-House
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Advances kitchen tickets, updates prices, 86s items,
                      restocks inventory, updates hours, and sends SMS/email
                      promos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        2. Storefront AI Menu &amp; Ordering Concierge
                      </h3>
                      <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        Front-of-House Web
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Answers guest allergy/dietary questions, recommends
                      popular pairings, and adds dishes directly to the
                      customer&apos;s cart.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        3. Vapi 24/7 Inbound Phone Ordering AI
                      </h3>
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                        Phone Line
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Answers inbound phone calls using your live menu and
                      operating hours, creates tickets in your kitchen, and
                      texts the caller a payment link.
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
          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
            Simple Setup
          </span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            From Sign-Up to Taking Direct Orders in 3 Steps
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {WORKFLOW_STEPS.map((item) => (
            <div
              key={item.step}
              className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/30 font-mono text-xs font-extrabold text-orange-300">
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
        className="border-t border-slate-900 bg-slate-900/30 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Try It Right Now
              </span>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Explore Live Demo Restaurants on Platerift
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-400">
                Test both sides of the platform: place an order on the customer
                storefront or manage operations inside the Owner Portal.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Open Super Admin Provisioning Console
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {DEMO_RESTAURANTS.map((demo) => (
              <div
                key={demo.slug}
                className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-3xl">{demo.emoji}</span>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                      {demo.domain}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">
                    {demo.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">{demo.cuisine}</p>
                  <p className="mt-3 rounded-xl border border-slate-800/90 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300">
                    {demo.highlight}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  <Link
                    href={`/dashboard/${demo.slug}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3 py-2.5 text-xs font-bold text-white hover:from-orange-600 hover:to-rose-700 transition"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Owner Portal
                  </Link>
                  <Link
                    href={`/store/${demo.slug}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 hover:border-emerald-500/50 hover:text-white transition"
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
      <footer className="border-t border-slate-900 bg-slate-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 text-white">
              <UtensilsCrossed className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-slate-300">Platerift</span>
            <span>— All-in-One Direct Ordering &amp; AI Operations Platform</span>
          </div>
          <div className="flex items-center gap-5 text-slate-400">
            <Link href="/dashboard/bella-napoli" className="hover:text-white">
              Owner Portal Demo
            </Link>
            <Link href="/store/bella-napoli" className="hover:text-white">
              Storefront Demo
            </Link>
            <Link href="/admin" className="hover:text-white">
              Super Admin Console
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
