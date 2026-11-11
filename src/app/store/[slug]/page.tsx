"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  History,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";
import {
  Customer,
  LayoutStyle,
  MenuItem,
  Order,
  OrderingAvailabilityCheck,
  OrderLineItem,
  OrderType,
  PlatformIntegrationsConfig,
  ReorderFrequency,
  RestaurantTenant,
  ScheduledReorder,
  SmsLog,
} from "@/lib/types";
import TenantAiChatbot from "@/components/TenantAiChatbot";
import {
  StorefrontAboutSection,
  StorefrontBrandLogo,
  StorefrontFooter,
} from "@/components/StorefrontFooterAndAbout";

function formatSpacedBrand(name: string): string {
  const firstWord = (name.split(" ")[0] || "AURA").toUpperCase();
  return firstWord.split("").join(" ");
}

export default function CustomerOrderingStorefront() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "bella-napoli";

  const [restaurant, setRestaurant] = useState<RestaurantTenant | null>(null);
  const [platformIntegrations, setPlatformIntegrations] =
    useState<PlatformIntegrationsConfig | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allRestaurantOrders, setAllRestaurantOrders] = useState<Order[]>([]);
  const [availability, setAvailability] =
    useState<OrderingAvailabilityCheck | null>(null);
  const [loading, setLoading] = useState(true);

  // Storefront Filter & Layout Preview Override
  const [selectedDietary, setSelectedDietary] = useState("ALL");
  const [previewLayout, setPreviewLayout] = useState<LayoutStyle | "">("");

  // Time Simulator Bar (for testing closed days/times on storefront)
  const [simDay, setSimDay] = useState("");
  const [simTime, setSimTime] = useState("");

  // Customer Authentication & Account State
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [scheduledReorders, setScheduledReorders] = useState<
    ScheduledReorder[]
  >([]);
  const [demoCustomers, setDemoCustomers] = useState<Customer[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountTab, setAccountTab] = useState<
    "history" | "scheduled" | "profile" | "auth"
  >("history");
  const [authFormMode, setAuthFormMode] = useState<"login" | "register">(
    "login"
  );
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("••••••••");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("+1 (312) 555-0199");
  const [authAddress, setAuthAddress] = useState(
    "900 N Michigan Ave Apt 14B, Chicago, IL"
  );
  const [authNotes, setAuthNotes] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);

  // Editable Profile Form State
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [profileSmsOptIn, setProfileSmsOptIn] = useState(true);
  const [profileEmailOptIn, setProfileEmailOptIn] = useState(true);

  // Schedule Re-Order Configurator Modal State
  const [scheduleModalSource, setScheduleModalSource] = useState<{
    sourceOrderNumber: string;
    title: string;
    items: OrderLineItem[];
    subtotal: number;
    tax: number;
    deliveryFee: number;
    tip: number;
    total: number;
    orderType: OrderType;
    deliveryAddress?: string;
    paymentMethod: "stripe" | "paypal" | "square" | "clover";
    specialInstructions: string;
  } | null>(null);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDate, setSchedDate] = useState(() =>
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [schedTime, setSchedTime] = useState("19:00");
  const [schedFrequency, setSchedFrequency] =
    useState<ReorderFrequency>("weekly");
  const [schedOrderType, setSchedOrderType] = useState<OrderType>("delivery");
  const [schedAddress, setSchedAddress] = useState("");
  const [schedNotes, setSchedNotes] = useState("");
  const [schedPaymentMethod, setSchedPaymentMethod] = useState<
    "stripe" | "paypal" | "square" | "clover"
  >("stripe");

  // Item Modifier (Variants, Sides & Add-Ons) Modal State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<
    Record<string, { optionLabel: string; priceDelta: number }>
  >({});
  const [selectedMultiMods, setSelectedMultiMods] = useState<
    Record<string, { optionLabel: string; priceDelta: number }[]>
  >({});
  const [customizeQty, setCustomizeQty] = useState(1);
  const [customizeItemNote, setCustomizeItemNote] = useState("");

  // Cart & Checkout State
  const [cart, setCart] = useState<OrderLineItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [tableNumber, setTableNumber] = useState("12");
  const [deliveryAddress, setDeliveryAddress] = useState(
    "900 N Michigan Ave Apt 14B, Chicago, IL"
  );
  const [customerName, setCustomerName] = useState("Sophia Vance");
  const [customerEmail, setCustomerEmail] = useState(
    "sophia.vance@example.com"
  );
  const [customerPhone, setCustomerPhone] = useState("+1 (312) 555-0821");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tipPercent, setTipPercent] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState<
    "stripe" | "paypal" | "square" | "clover"
  >("stripe");

  // Checkout Scheduling Option ("Now" vs "Schedule for Later")
  const [checkoutTiming, setCheckoutTiming] = useState<"asap" | "scheduled">(
    "asap"
  );
  const [checkoutSchedDate, setCheckoutSchedDate] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [checkoutSchedTime, setCheckoutSchedTime] = useState("19:00");
  const [checkoutSaveRecurring, setCheckoutSaveRecurring] = useState(false);
  const [checkoutRecurringFreq, setCheckoutRecurringFreq] =
    useState<ReorderFrequency>("weekly");

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Completed Order Tracker
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [sentSmsToast, setSentSmsToast] = useState<SmsLog | null>(null);

  const syncCustomerToCheckoutFields = useCallback((cust: Customer | null) => {
    if (!cust) return;
    setCustomerName(cust.name);
    setCustomerEmail(cust.email);
    setCustomerPhone(cust.phone);
    if (cust.defaultAddress) {
      setDeliveryAddress(cust.defaultAddress);
    }
    setProfileName(cust.name);
    setProfilePhone(cust.phone);
    setProfileAddress(cust.defaultAddress || "");
    setProfileNotes(cust.notes || "");
    setProfileSmsOptIn(cust.smsOptIn);
    setProfileEmailOptIn(cust.emailOptIn);
  }, []);

  const loadCustomerAccount = useCallback(
    async (targetSlug: string, emailOverride?: string, signedOut?: boolean) => {
      try {
        const query = new URLSearchParams();
        if (emailOverride) query.set("email", emailOverride);
        if (signedOut) query.set("signedOut", "1");

        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(
            targetSlug
          )}/customer-account?${query.toString()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (res.ok) {
          setDemoCustomers(data.demoCustomers || []);
          if (signedOut) {
            setActiveCustomer(null);
            setCustomerOrders([]);
            setScheduledReorders([]);
          } else if (data.customer) {
            setActiveCustomer(data.customer);
            setCustomerOrders(data.orders || []);
            setScheduledReorders(data.scheduledReorders || []);
            syncCustomerToCheckoutFields(data.customer);
          }
        }
      } catch (e) {
        console.error("Failed to load customer account:", e);
      }
    },
    [syncCustomerToCheckoutFields]
  );

  const loadStorefront = useCallback(
    async (overrideDay?: string, overrideTime?: string) => {
      try {
        const query = new URLSearchParams();
        if (overrideDay) query.set("simDay", overrideDay);
        if (overrideTime) query.set("simTime", overrideTime);

        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(slug)}?${query.toString()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (res.ok && data.restaurant) {
          const rest: RestaurantTenant = data.restaurant;
          setRestaurant(rest);
          if (data.platformIntegrations) {
            setPlatformIntegrations(data.platformIntegrations);
          }
          setMenuItems(data.menuItems || []);
          setAllRestaurantOrders(data.orders || []);
          setAvailability(data.availability || null);

          // Ensure selected orderType matches an enabled fulfillment channel
          setOrderType((prev) => {
            const isTypeAllowed = (t: OrderType) =>
              (t === "pickup" && rest.features.pickup) ||
              (t === "delivery" && rest.features.delivery) ||
              (t === "dine_in" && rest.features.dineInQr);

            if (
              rest.features.defaultFulfillment &&
              isTypeAllowed(rest.features.defaultFulfillment) &&
              !isTypeAllowed(prev)
            ) {
              return rest.features.defaultFulfillment;
            }
            if (isTypeAllowed(prev)) return prev;
            if (rest.features.pickup) return "pickup";
            if (rest.features.delivery) return "delivery";
            if (rest.features.dineInQr) return "dine_in";
            return "pickup";
          });
          if (placedOrder) {
            const refreshed = (data.orders || []).find(
              (o: Order) => o.id === placedOrder.id
            );
            if (refreshed) setPlacedOrder(refreshed);
          }
        }
      } catch (e) {
        console.error("Failed to load storefront:", e);
      } finally {
        setLoading(false);
      }
    },
    [slug, placedOrder]
  );

  useEffect(() => {
    loadStorefront();
    const savedEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem(`platerift_cust_${slug}`)
        : null;
    if (savedEmail === "__SIGNED_OUT__") {
      loadCustomerAccount(slug, undefined, true);
    } else {
      loadCustomerAccount(slug, savedEmail || undefined);
    }
  }, [slug, loadStorefront, loadCustomerAccount]);

  const showFeedback = (msg: string) => {
    setAccountFeedback(msg);
    setTimeout(() => setAccountFeedback(null), 5000);
  };

  const handleCustomerLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !authEmail.trim()) return;
    setAuthBusy(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(
          restaurant.slug
        )}/customer-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: authFormMode,
            email: authEmail.trim(),
            name: authName.trim() || undefined,
            phone: authPhone.trim() || undefined,
            defaultAddress: authAddress.trim() || undefined,
            notes: authNotes.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.customer) {
        setActiveCustomer(data.customer);
        setCustomerOrders(data.orders || []);
        setScheduledReorders(data.scheduledReorders || []);
        if (data.demoCustomers) setDemoCustomers(data.demoCustomers);
        syncCustomerToCheckoutFields(data.customer);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `platerift_cust_${slug}`,
            data.customer.email
          );
        }
        setAccountTab("history");
        showFeedback(
          authFormMode === "register"
            ? `Welcome to ${restaurant.name}, ${data.customer.name}! +50 Loyalty Points added.`
            : `Welcome back, ${data.customer.name}!`
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSwitchDemoCustomer = async (cust: Customer) => {
    if (!restaurant) return;
    setAuthBusy(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`platerift_cust_${slug}`, cust.email);
      }
      await loadCustomerAccount(restaurant.slug, cust.email, false);
      setAccountTab("history");
      showFeedback(`Switched to customer account: ${cust.name}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOutCustomer = () => {
    setActiveCustomer(null);
    setCustomerOrders([]);
    setScheduledReorders([]);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`platerift_cust_${slug}`, "__SIGNED_OUT__");
    }
    setAccountTab("auth");
    showFeedback("Signed out of customer account.");
  };

  const handleSaveCustomerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !activeCustomer) return;
    setAuthBusy(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(
          restaurant.slug
        )}/customer-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_profile",
            customerId: activeCustomer.id,
            name: profileName,
            email: activeCustomer.email,
            phone: profilePhone,
            defaultAddress: profileAddress,
            notes: profileNotes,
            smsOptIn: profileSmsOptIn,
            emailOptIn: profileEmailOptIn,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.customer) {
        setActiveCustomer(data.customer);
        syncCustomerToCheckoutFields(data.customer);
        showFeedback(
          "Profile, default delivery address & preferences saved!"
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // Load a past order's items into the active cart for editing/checkout
  const handleLoadOrderIntoCart = (pastOrder: Order) => {
    setCart(pastOrder.items);
    setOrderType(pastOrder.orderType);
    if (pastOrder.deliveryAddress) {
      setDeliveryAddress(pastOrder.deliveryAddress);
    }
    if (pastOrder.specialInstructions) {
      setSpecialInstructions(pastOrder.specialInstructions);
    }
    setShowAccountModal(false);
    showFeedback(
      `Loaded ${pastOrder.items.length} selection(s) from Order #${pastOrder.orderNumber} into your Provisioning Desk!`
    );
    setTimeout(() => {
      document
        .getElementById("provisioning-desk")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  // 1-Click Instant Re-Order of a past order
  const handleInstantReorderNow = async (pastOrder: Order) => {
    if (!restaurant) return;
    setAuthBusy(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(
          restaurant.slug
        )}/customer-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reorder_now",
            orderId: pastOrder.id,
            customerName: activeCustomer?.name || pastOrder.customerName,
            customerEmail: activeCustomer?.email || pastOrder.customerEmail,
            customerPhone: activeCustomer?.phone || pastOrder.customerPhone,
            deliveryAddress:
              activeCustomer?.defaultAddress || pastOrder.deliveryAddress,
            paymentMethod: pastOrder.paymentMethod,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.order) {
        setPlacedOrder(data.order);
        if (data.smsSent) setSentSmsToast(data.smsSent);
        if (data.customer) setActiveCustomer(data.customer);
        if (data.orders) setCustomerOrders(data.orders);
        if (data.scheduledReorders)
          setScheduledReorders(data.scheduledReorders);
        setShowAccountModal(false);
        await loadStorefront(simDay || undefined, simTime || undefined);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // Open the Schedule Re-Order modal from a past order
  const openScheduleModalFromOrder = (pastOrder: Order) => {
    const defaultTitle = `${
      pastOrder.items[0]?.name || restaurant?.name || "Signature"
    }${pastOrder.items.length > 1 ? ` + ${pastOrder.items.length - 1} more` : ""} Re-Order`;
    setScheduleModalSource({
      sourceOrderNumber: pastOrder.orderNumber,
      title: defaultTitle,
      items: pastOrder.items,
      subtotal: pastOrder.subtotal,
      tax: pastOrder.tax,
      deliveryFee: pastOrder.deliveryFee,
      tip: pastOrder.tip,
      total: pastOrder.total,
      orderType: pastOrder.orderType,
      deliveryAddress:
        pastOrder.deliveryAddress || activeCustomer?.defaultAddress,
      paymentMethod: pastOrder.paymentMethod,
      specialInstructions: pastOrder.specialInstructions,
    });
    setSchedTitle(defaultTitle);
    setSchedOrderType(pastOrder.orderType);
    setSchedAddress(
      pastOrder.deliveryAddress ||
        activeCustomer?.defaultAddress ||
        deliveryAddress
    );
    setSchedPaymentMethod(pastOrder.paymentMethod);
    setSchedNotes(pastOrder.specialInstructions || "");
  };

  // Open the Schedule Re-Order modal from the current cart
  const openScheduleModalFromCart = () => {
    if (cart.length === 0 || !restaurant) return;
    const defaultTitle = `${cart[0].name}${
      cart.length > 1 ? ` + ${cart.length - 1} more` : ""
    } Scheduled Order`;
    setScheduleModalSource({
      sourceOrderNumber: "CART",
      title: defaultTitle,
      items: cart,
      subtotal,
      tax: taxAmount,
      deliveryFee,
      tip: tipAmount,
      total: grandTotal,
      orderType,
      deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
      paymentMethod,
      specialInstructions,
    });
    setSchedTitle(defaultTitle);
    setSchedOrderType(orderType);
    setSchedAddress(deliveryAddress);
    setSchedPaymentMethod(paymentMethod);
    setSchedNotes(specialInstructions);
  };

  const handleCreateScheduledReorder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !scheduleModalSource) return;
    setAuthBusy(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(
          restaurant.slug
        )}/customer-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "schedule_reorder",
            customerId: activeCustomer?.id || `cust_${Date.now()}`,
            customerName: activeCustomer?.name || customerName,
            customerEmail: activeCustomer?.email || customerEmail,
            customerPhone: activeCustomer?.phone || customerPhone,
            sourceOrderNumber: scheduleModalSource.sourceOrderNumber,
            title: schedTitle || scheduleModalSource.title,
            orderType: schedOrderType,
            deliveryAddress:
              schedOrderType === "delivery" ? schedAddress : undefined,
            items: scheduleModalSource.items,
            subtotal: scheduleModalSource.subtotal,
            tax: scheduleModalSource.tax,
            deliveryFee: scheduleModalSource.deliveryFee,
            tip: scheduleModalSource.tip,
            total: scheduleModalSource.total,
            paymentMethod: schedPaymentMethod,
            frequency: schedFrequency,
            scheduledDate: schedDate,
            scheduledTime: schedTime,
            specialInstructions: schedNotes,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.scheduledReorders) {
        setScheduledReorders(data.scheduledReorders);
        setScheduleModalSource(null);
        setShowAccountModal(true);
        setAccountTab("scheduled");
        showFeedback(
          `Scheduled "${schedTitle}" for ${schedDate} at ${schedTime} (${schedFrequency.toUpperCase()})!`
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleTriggerScheduledNow = async (schedId: string) => {
    if (!restaurant) return;
    setAuthBusy(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(
          restaurant.slug
        )}/customer-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trigger_scheduled",
            scheduledId: schedId,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.order) {
        setPlacedOrder(data.order);
        if (data.smsSent) setSentSmsToast(data.smsSent);
        if (data.customer) setActiveCustomer(data.customer);
        if (data.orders) setCustomerOrders(data.orders);
        if (data.scheduledReorders)
          setScheduledReorders(data.scheduledReorders);
        setShowAccountModal(false);
        await loadStorefront(simDay || undefined, simTime || undefined);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateScheduledStatus = async (
    schedId: string,
    status: "active" | "paused" | "cancelled"
  ) => {
    if (!restaurant) return;
    setAuthBusy(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(
          restaurant.slug
        )}/customer-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_scheduled",
            scheduledId: schedId,
            status,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.scheduledReorders) {
        setScheduledReorders(data.scheduledReorders);
        showFeedback(`Scheduled order status updated to ${status}.`);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c10] text-zinc-200">
        <div className="flex items-center gap-3 text-sm font-medium text-zinc-400">
          <RefreshCw className="h-5 w-5 animate-spin text-gold-400" />
          Curating Storefront Experience...
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0c10] p-6 text-center text-white">
        <h2 className="font-serif text-3xl">Storefront Not Found</h2>
        <p className="mt-2 text-sm text-zinc-400">
          No restaurant tenant is mapped to &quot;{slug}&quot;.
        </p>
        <Link
          href="/admin"
          className="mt-5 rounded-full bg-gold-400 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-black"
        >
          Back to Super Admin Console
        </Link>
      </div>
    );
  }

  const activeLayout: LayoutStyle =
    (previewLayout as LayoutStyle) || restaurant.layoutStyle || "aura-luxury";
  const brandColor = restaurant.primaryColor || "#e5be65";

  // Advance Notice (Days & Hours) Lead-Time Calculations
  const advanceDays = Number(restaurant.advanceNoticeDays || 0);
  const advanceHours = Number(restaurant.advanceNoticeHours || 0);
  const requiresAdvanceNotice = advanceDays > 0 || advanceHours > 0;
  const advanceNoticeSummary = requiresAdvanceNotice
    ? [
        advanceDays > 0
          ? `${advanceDays} ${advanceDays === 1 ? "Day" : "Days"}`
          : "",
        advanceHours > 0
          ? `${advanceHours} ${advanceHours === 1 ? "Hour" : "Hours"}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const totalLeadMinutes =
    advanceDays * 24 * 60 + advanceHours * 60 + (restaurant.prepTimeMinutes || 0);
  const earliestReadyDateObj = new Date(
    Date.now() + totalLeadMinutes * 60 * 1000
  );
  const earliestReadyDateIso = `${earliestReadyDateObj.getFullYear()}-${String(
    earliestReadyDateObj.getMonth() + 1
  ).padStart(2, "0")}-${String(earliestReadyDateObj.getDate()).padStart(2, "0")}`;
  const earliestReadyTimeStr = `${String(
    earliestReadyDateObj.getHours()
  ).padStart(2, "0")}:${String(earliestReadyDateObj.getMinutes()).padStart(
    2,
    "0"
  )}`;
  const earliestReadyFormatted = earliestReadyDateObj.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Helper to generate quick advance dates starting from earliestReadyDateObj
  const getAdvanceDateIso = (extraDays: number) => {
    const base = new Date(
      Math.max(Date.now(), earliestReadyDateObj.getTime()) +
        extraDays * 24 * 60 * 60 * 1000
    );
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(base.getDate()).padStart(2, "0")}`;
  };

  const quickAdvanceDates = [
    { label: "Earliest", dateIso: earliestReadyDateIso },
    { label: "+1 Day", dateIso: getAdvanceDateIso(1) },
    { label: "+2 Days", dateIso: getAdvanceDateIso(2) },
    { label: "+3 Days", dateIso: getAdvanceDateIso(3) },
    { label: "+7 Days", dateIso: getAdvanceDateIso(7) },
  ];

  // Compute day-of-week schedule & available pickup time slots for the selected advance date
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ] as const;
  const parsedSchedDateObj = new Date(
    `${checkoutSchedDate || earliestReadyDateIso}T12:00:00`
  );
  const selectedDayOfWeekName = !isNaN(parsedSchedDateObj.getTime())
    ? dayNames[parsedSchedDateObj.getDay()]
    : "Monday";
  const selectedDaySchedule =
    restaurant.weeklySchedule.find((d) => d.day === selectedDayOfWeekName) ||
    restaurant.weeklySchedule[0];

  const isPickupAvailableOnSelectedDay = Boolean(
    selectedDaySchedule?.enabled &&
      (selectedDaySchedule?.pickupEnabled ?? true)
  );
  const dayPickupStart =
    selectedDaySchedule?.pickupStartTime ||
    selectedDaySchedule?.openTime ||
    "11:00";
  const dayPickupEnd =
    selectedDaySchedule?.pickupEndTime ||
    selectedDaySchedule?.closeTime ||
    "21:30";
  const dayPickupInterval =
    selectedDaySchedule?.pickupSlotIntervalMinutes || 30;

  const availablePickupSlotsForSelectedDay: string[] = (() => {
    if (!selectedDaySchedule || !isPickupAvailableOnSelectedDay) return [];
    if (
      selectedDaySchedule.customPickupSlots &&
      selectedDaySchedule.customPickupSlots.length > 0
    ) {
      return selectedDaySchedule.customPickupSlots;
    }
    const toMins = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const startM = toMins(dayPickupStart);
    const endM = toMins(dayPickupEnd);
    const breakOn = Boolean(selectedDaySchedule.breakEnabled);
    const bStart = toMins(selectedDaySchedule.breakStart || "15:00");
    const bEnd = toMins(selectedDaySchedule.breakEnd || "16:30");
    const slots: string[] = [];
    for (
      let m = startM;
      m <= endM;
      m += Math.max(15, dayPickupInterval)
    ) {
      if (breakOn && m >= bStart && m < bEnd) continue;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  })();

  const getSlotCapacityInfo = (slot: string) => {
    const maxOrders =
      selectedDaySchedule?.pickupSlotCapacities?.[slot] ??
      selectedDaySchedule?.pickupSlotMaxOrders ??
      5;
    const targetScheduled = `${checkoutSchedDate} ${slot}`;
    const bookedOrders = allRestaurantOrders.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.scheduledFor &&
        o.scheduledFor.trim() === targetScheduled
    ).length;
    const remainingOrders = Math.max(0, maxOrders - bookedOrders);
    const isFull = remainingOrders <= 0;
    return { maxOrders, bookedOrders, remainingOrders, isFull };
  };

  const openAddItemModal = (item: MenuItem) => {
    if (!item.available) return;
    if (availability && !availability.allowed) return;
    if (!item.modifiers || item.modifiers.length === 0) {
      addItemToCart(item, []);
      return;
    }
    const singleDefaults: Record<
      string,
      { optionLabel: string; priceDelta: number }
    > = {};
    const multiDefaults: Record<
      string,
      { optionLabel: string; priceDelta: number }[]
    > = {};

    item.modifiers.forEach((group) => {
      const isMulti =
        group.multiSelect ||
        group.type === "side" ||
        group.type === "addon" ||
        (!group.required && group.type !== "variant");
      if (isMulti) {
        multiDefaults[group.name] = [];
      } else if (group.options.length > 0) {
        singleDefaults[group.name] = {
          optionLabel: group.options[0].label,
          priceDelta: group.options[0].priceDelta,
        };
      }
    });
    setSelectedMods(singleDefaults);
    setSelectedMultiMods(multiDefaults);
    setCustomizeQty(1);
    setCustomizeItemNote("");
    setCustomizingItem(item);
  };

  const addItemToCart = (
    item: MenuItem,
    mods: { groupName: string; optionLabel: string; priceDelta: number }[],
    qtyToAdd = 1,
    itemNote = ""
  ) => {
    const addCount = Math.max(1, qtyToAdd);
    const modDelta = mods.reduce((s, m) => s + m.priceDelta, 0);
    const unitWithMods = Number((item.price + modDelta).toFixed(2));
    const trimmedNote = itemNote.trim() || undefined;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (c) =>
          c.menuItemId === item.id &&
          JSON.stringify(c.selectedModifiers) === JSON.stringify(mods) &&
          (c.notes || undefined) === trimmedNote
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        const nextQty = updated[existingIndex].quantity + addCount;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: nextQty,
          itemTotal: Number((unitWithMods * nextQty).toFixed(2)),
        };
        return updated;
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          quantity: addCount,
          unitPrice: item.price,
          selectedModifiers: mods,
          itemTotal: Number((unitWithMods * addCount).toFixed(2)),
          notes: trimmedNote,
        },
      ];
    });
    setCustomizingItem(null);
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== idx);
      }
      const modDelta = item.selectedModifiers.reduce(
        (s, m) => s + m.priceDelta,
        0
      );
      const unitWithMods = item.unitPrice + modDelta;
      next[idx] = {
        ...item,
        quantity: newQty,
        itemTotal: Number((unitWithMods * newQty).toFixed(2)),
      };
      return next;
    });
  };

  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (code === "NAPOLIVIP15") {
      setDiscountPercent(15);
    } else if (code === "WEEKEND20") {
      setDiscountPercent(20);
    } else if (
      code === "TRUFFLE10" ||
      code === "OMAKASE10" ||
      code === "WELCOME10"
    ) {
      setDiscountPercent(10);
    } else if (code) {
      setDiscountPercent(10);
    }
  };

  // Platform Super Admin + Tenant Feature + Owner Integration Gating
  const doordashDriveActive =
    (platformIntegrations
      ? platformIntegrations.doordashDrive.setupCompleted &&
        platformIntegrations.doordashDrive.availableToOwners
      : true) &&
    restaurant.features.doordashDrive !== false &&
    (restaurant.integrationsConfig?.doordashDrive?.enabled ?? true);

  const squareCheckoutActive =
    (platformIntegrations
      ? platformIntegrations.square.setupCompleted &&
        platformIntegrations.square.availableToOwners
      : true) &&
    restaurant.features.squarePos !== false &&
    (restaurant.integrationsConfig?.square?.enabled ?? true) &&
    (restaurant.integrationsConfig?.square?.acceptSquareCheckout ?? true);

  const cloverCheckoutActive =
    (platformIntegrations
      ? platformIntegrations.clover.setupCompleted &&
        platformIntegrations.clover.availableToOwners
      : true) &&
    restaurant.features.cloverPos !== false &&
    (restaurant.integrationsConfig?.clover?.enabled ?? true) &&
    (restaurant.integrationsConfig?.clover?.acceptCloverCheckout ?? true);

  const vapiVoiceActive =
    (platformIntegrations
      ? platformIntegrations.vapi.setupCompleted &&
        platformIntegrations.vapi.availableToOwners
      : true) &&
    restaurant.features.vapiVoiceAi !== false &&
    (restaurant.integrationsConfig?.vapi?.enabled ?? true);

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Number(
    cart.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2)
  );
  const discountAmount = Number(
    ((subtotal * discountPercent) / 100).toFixed(2)
  );
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = Number(
    (
      (discountedSubtotal * restaurant.paymentConfig.taxRatePercent) /
      100
    ).toFixed(2)
  );
  const freeDeliveryThreshold = doordashDriveActive
    ? restaurant.integrationsConfig?.doordashDrive?.freeDeliveryThreshold ??
      restaurant.paymentConfig.freeDeliveryMin
    : restaurant.paymentConfig.freeDeliveryMin;
  const configuredDeliveryFee = doordashDriveActive
    ? restaurant.integrationsConfig?.doordashDrive?.customerDeliveryFeeShare ??
      restaurant.paymentConfig.deliveryFee
    : restaurant.paymentConfig.deliveryFee;

  const deliveryFee =
    orderType === "delivery" && subtotal > 0
      ? discountedSubtotal >= freeDeliveryThreshold
        ? 0
        : configuredDeliveryFee
      : 0;
  const tipAmount =
    restaurant.features.tipping && subtotal > 0
      ? Number(((discountedSubtotal * tipPercent) / 100).toFixed(2))
      : 0;
  const grandTotal = Number(
    (discountedSubtotal + taxAmount + deliveryFee + tipAmount).toFixed(2)
  );

  // Order Minimum Progress Calculation (AURA style)
  const minSpend = restaurant.minOrderAmount || 15;
  const minProgressPercent = Math.min((subtotal / minSpend) * 100, 100);
  const minMet = subtotal >= minSpend;
  const minRemaining = Math.max(0, minSpend - subtotal).toFixed(2);

  const handleCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (checkoutTiming === "scheduled") {
      const chosenDate = new Date(`${checkoutSchedDate}T${checkoutSchedTime}`);
      if (
        !isNaN(chosenDate.getTime()) &&
        chosenDate.getTime() < earliestReadyDateObj.getTime() - 2 * 60 * 1000
      ) {
        setCheckoutError(
          `⏳ ${restaurant.name} requires at least ${
            requiresAdvanceNotice
              ? `${advanceNoticeSummary} advance notice`
              : `${restaurant.prepTimeMinutes} mins prep time`
          }. Earliest available ready time is ${earliestReadyFormatted}.`
        );
        return;
      }

      if (orderType === "pickup") {
        if (!isPickupAvailableOnSelectedDay) {
          setCheckoutError(
            `🛍️ Pickup is not available on ${selectedDayOfWeekName}s at ${restaurant.name}. Please choose another day or switch to Delivery.`
          );
          return;
        }
        if (
          selectedDaySchedule?.customPickupSlots &&
          selectedDaySchedule.customPickupSlots.length > 0
        ) {
          if (
            !selectedDaySchedule.customPickupSlots.includes(checkoutSchedTime)
          ) {
            setCheckoutError(
              `🛍️ Available ${selectedDayOfWeekName} pickup times are: ${selectedDaySchedule.customPickupSlots.join(
                ", "
              )}.`
            );
            return;
          }
        } else if (
          checkoutSchedTime < dayPickupStart ||
          checkoutSchedTime > dayPickupEnd
        ) {
          setCheckoutError(
            `🛍️ ${selectedDayOfWeekName} pickup hours at ${restaurant.name} are ${dayPickupStart} – ${dayPickupEnd}.`
          );
          return;
        }
      }

      const slotCap = getSlotCapacityInfo(checkoutSchedTime);
      if (slotCap.isFull) {
        setCheckoutError(
          `⏳ The ${checkoutSchedTime} time slot on ${checkoutSchedDate} (${selectedDayOfWeekName}) has reached its maximum capacity of ${slotCap.maxOrders} order(s). Please select another available time slot.`
        );
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      const scheduledForVal =
        checkoutTiming === "scheduled"
          ? `${checkoutSchedDate} ${checkoutSchedTime}`
          : requiresAdvanceNotice
          ? `${earliestReadyDateIso} ${earliestReadyTimeStr}`
          : undefined;

      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName,
            customerEmail,
            customerPhone,
            orderType,
            tableNumber: orderType === "dine_in" ? tableNumber : undefined,
            deliveryAddress:
              orderType === "delivery" ? deliveryAddress : undefined,
            items: cart,
            subtotal,
            tax: taxAmount,
            deliveryFee,
            tip: tipAmount,
            discount: discountAmount,
            total: grandTotal,
            paymentMethod,
            specialInstructions,
            scheduledFor: scheduledForVal,
            simDay: simDay || undefined,
            simTime: simTime || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || "Order could not be completed.");
      } else {
        // If customer also checked "Save as recurring scheduled re-order", create the ScheduledReorder
        if (checkoutTiming === "scheduled" && checkoutSaveRecurring) {
          await fetch(
            `/api/restaurants/${encodeURIComponent(
              restaurant.slug
            )}/customer-account`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "schedule_reorder",
                customerId:
                  data.order.customerId ||
                  activeCustomer?.id ||
                  `cust_${Date.now()}`,
                customerName,
                customerEmail,
                customerPhone,
                sourceOrderNumber: data.order.orderNumber,
                title: `${cart[0]?.name || restaurant.name} (${checkoutRecurringFreq.toUpperCase()})`,
                orderType,
                deliveryAddress:
                  orderType === "delivery" ? deliveryAddress : undefined,
                items: cart,
                subtotal,
                tax: taxAmount,
                deliveryFee,
                tip: tipAmount,
                total: grandTotal,
                paymentMethod,
                frequency: checkoutRecurringFreq,
                scheduledDate: checkoutSchedDate,
                scheduledTime: checkoutSchedTime,
                specialInstructions,
              }),
            }
          );
        }

        setPlacedOrder(data.order);
        if (data.smsSent) {
          setSentSmsToast(data.smsSent);
        }
        setCart([]);
        setShowCheckoutModal(false);
        await loadStorefront(simDay || undefined, simTime || undefined);
        await loadCustomerAccount(restaurant.slug, customerEmail, false);
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  const filteredMenu = menuItems.filter((item) => {
    if (selectedDietary === "ALL") return true;
    return item.dietaryTags.includes(selectedDietary);
  });

  const categories = Array.from(new Set(filteredMenu.map((m) => m.category)));
  const allDietaryTags = Array.from(
    new Set(menuItems.flatMap((m) => m.dietaryTags))
  );

  const activeScheduledCount = scheduledReorders.filter(
    (s) => s.status === "active"
  ).length;

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-300 font-sans antialiased selection:bg-gold-500 selection:text-black">
      {/* ================= TOP CONCIERGE & CUSTOM DOMAIN BAR ================= */}
      <div className="bg-zinc-950 border-b border-zinc-800/80 px-3 sm:px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 tracking-widest uppercase text-zinc-400 text-[10px] sm:text-[11px] max-w-full min-w-0">
            <Sparkles
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: brandColor }}
            />
            <span className="truncate">
              {restaurant.tagline} — Direct Online Ordering & Provisioning
            </span>
          </div>

          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto max-w-full pb-0.5 sm:pb-0 sm:flex-wrap sm:gap-2.5">
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 font-mono text-[10px] text-zinc-300">
              <Lock className="h-2.5 w-2.5 text-emerald-400" />
              https://{restaurant.customDomain}
            </span>

            {/* Layout Switcher Preview */}
            <select
              value={activeLayout}
              onChange={(e) => setPreviewLayout(e.target.value as LayoutStyle)}
              className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-gold-300"
              title="Preview Brand Layout Style"
            >
              <option value="aura-luxury">Layout: AURA Bespoke Luxury</option>
              <option value="modern-grid">Layout: Banquet Visual Grid</option>
              <option value="editorial-list">
                Layout: Degustation Editorial List
              </option>
              <option value="compact-bistro">
                Layout: Express Bistro Cards
              </option>
            </select>

            {/* Day/Time Schedule Tester */}
            <select
              value={simDay}
              onChange={(e) => {
                setSimDay(e.target.value);
                loadStorefront(e.target.value, simTime);
              }}
              className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[10px] text-zinc-300"
            >
              <option value="">Live Day</option>
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={simTime}
              onChange={(e) => {
                setSimTime(e.target.value);
                loadStorefront(simDay, e.target.value);
              }}
              className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300"
            />

            <Link
              href={`/dashboard/${restaurant.slug}`}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:border-gold-400 transition"
            >
              <LayoutDashboard className="h-2.5 w-2.5" /> Owner Portal
            </Link>
            <Link
              href="/admin"
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[10px] text-zinc-400 hover:text-white transition"
            >
              Super Admin
            </Link>
          </div>
        </div>
      </div>

      {/* ================= STICKY AURA NAVBAR ================= */}
      <nav className="sticky top-0 z-40 bg-[#0b0c10]/85 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <a href="#" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <StorefrontBrandLogo
                restaurant={restaurant}
                brandColor={brandColor}
                compact
              />
            </a>

            <div className="hidden md:flex items-center gap-4 border-l border-zinc-800 pl-4 text-xs font-medium text-zinc-400">
              <a href="#about-section" className="hover:text-white transition">
                About
              </a>
              <Link
                href={`/store/${restaurant.slug}/privacy`}
                className="hover:text-white transition"
              >
                Privacy
              </Link>
              <Link
                href={`/store/${restaurant.slug}/terms`}
                className="hover:text-white transition"
              >
                Terms
              </Link>
              <a href="#contact-footer" className="hover:text-white transition">
                Contact
              </a>
            </div>

            {/* Event / Order Spec Pill */}
            <div className="hidden xl:flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5 text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <Calendar
                  className="w-3.5 h-3.5"
                  style={{ color: brandColor }}
                />
                <span className="text-zinc-200">
                  {availability
                    ? `${availability.checkedDay} ${availability.checkedTime}`
                    : "Today"}
                </span>
              </div>
              <span className="text-zinc-700">•</span>
              <div className="flex items-center gap-2 text-zinc-400">
                <Users className="w-3.5 h-3.5" style={{ color: brandColor }} />
                <span className="text-zinc-200 uppercase font-mono text-[11px]">
                  {orderType.replace("_", " ")}
                </span>
              </div>
              <span className="text-zinc-700">•</span>
              <div className="flex items-center gap-2 text-zinc-400">
                <MapPin className="w-3.5 h-3.5" style={{ color: brandColor }} />
                <span className="text-zinc-200 truncate max-w-[160px]">
                  {restaurant.address}
                </span>
              </div>
            </div>
          </div>

          {/* Actions, Customer Account & Cart Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {restaurant.features.dietaryFilters &&
              allDietaryTags.length > 0 && (
                <select
                  value={selectedDietary}
                  onChange={(e) => setSelectedDietary(e.target.value)}
                  className="hidden lg:inline-block rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs uppercase tracking-wider text-zinc-300 focus:outline-none"
                >
                  <option value="ALL">All Dietary</option>
                  {allDietaryTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}

            {/* CUSTOMER ACCOUNT / ORDER HISTORY / RE-ORDER BUTTON */}
            {activeCustomer ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAccountTab("history");
                    setShowAccountModal(true);
                  }}
                  className="flex items-center gap-2 sm:gap-2.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 hover:border-zinc-500 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs transition"
                  title="View Order History, 1-Click Re-Orders & Scheduled Orders"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-black"
                    style={{ backgroundColor: brandColor }}
                  >
                    {activeCustomer.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div className="text-left hidden sm:block">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white leading-none">
                        {activeCustomer.name.split(" ")[0]}
                      </span>
                      {activeCustomer.vipStatus && (
                        <span
                          className="rounded px-1.5 py-0.2 text-[9px] font-mono uppercase font-bold text-black"
                          style={{ backgroundColor: brandColor }}
                        >
                          VIP
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-zinc-400 leading-none mt-1">
                      {activeCustomer.loyaltyPoints} pts •{" "}
                      {customerOrders.length} orders
                    </p>
                  </div>
                  {activeScheduledCount > 0 && (
                    <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                      <Repeat className="h-2.5 w-2.5" /> {activeScheduledCount}
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAccountTab("auth");
                  setShowAccountModal(true);
                }}
                style={{ borderColor: `${brandColor}60`, color: brandColor }}
                className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-zinc-900 border px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider hover:bg-zinc-800 transition"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Sign In / VIP Account</span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}

            <button
              onClick={() => {
                if (cart.length > 0) {
                  setCheckoutError(null);
                  setShowCheckoutModal(true);
                } else {
                  document
                    .getElementById("provisioning-desk")
                    ?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition"
            >
              <UtensilsCrossed
                className="w-4 h-4 shrink-0"
                style={{ color: brandColor }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-white hidden sm:inline">
                {restaurant.name.split(" ")[0]} Order
              </span>
              <span
                className="w-5 h-5 rounded-full text-black text-[11px] font-bold flex items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                {totalCount}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Feedback Toast */}
      {accountFeedback && (
        <div className="fixed inset-x-4 top-20 sm:inset-x-auto sm:top-24 sm:right-6 z-50 max-w-md rounded-2xl border border-zinc-700 bg-zinc-950/95 px-4 py-3 text-xs text-white shadow-2xl backdrop-blur-md flex items-center gap-3">
          <CheckCircle2
            className="h-4 w-4 shrink-0"
            style={{ color: brandColor }}
          />
          <span>{accountFeedback}</span>
          <button
            onClick={() => setAccountFeedback(null)}
            className="ml-auto text-zinc-500 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Automated SMS Notification Toast when Order is Placed */}
      {sentSmsToast && (
        <div className="fixed inset-x-4 bottom-20 sm:inset-x-auto sm:bottom-6 sm:left-6 z-50 max-w-md rounded-2xl border border-zinc-700 bg-zinc-950/95 p-4 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="rounded-xl p-2 text-black"
                style={{ backgroundColor: brandColor }}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: brandColor }}
                >
                  📲 Automated SMS Sent to {sentSmsToast.customerPhone}
                </p>
                <p className="mt-1 text-xs text-zinc-300">
                  {sentSmsToast.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSentSmsToast(null)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= EDITORIAL HERO BANNER ================= */}
      <section className="relative border-b border-zinc-900 py-8 px-4 sm:py-14 sm:px-6 overflow-hidden">
        {/* Ambient Brand Color Glow */}
        <div
          className="absolute -top-24 left-1/4 w-[600px] h-[350px] rounded-full blur-[140px] pointer-events-none opacity-20"
          style={{ backgroundColor: brandColor }}
        />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 sm:gap-8 relative z-10">
          <div className="space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] tracking-widest uppercase"
                style={{ color: brandColor }}
              >
                {restaurant.cuisine}
              </span>
              {availability && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider border ${
                    availability.allowed
                      ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                      : "bg-rose-950/70 border-rose-800/70 text-rose-300"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {availability.allowed
                    ? requiresAdvanceNotice
                      ? `Open • ${advanceNoticeSummary} Advance Notice`
                      : `Open • ~${restaurant.prepTimeMinutes}m Prep`
                    : availability.title}
                </span>
              )}
              {requiresAdvanceNotice && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-700/60 text-[11px] font-mono text-amber-300">
                  ⏳ Earliest Ready: {earliestReadyFormatted}
                </span>
              )}
              {doordashDriveActive && restaurant.features.delivery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-[11px] font-mono text-rose-200">
                  🚗 DoorDash Drive Courier • 0% Commission
                </span>
              )}
              {vapiVoiceActive && (
                <a
                  href={`tel:${restaurant.integrationsConfig?.vapi?.inboundPhoneNumber || restaurant.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-700/60 text-[11px] font-mono text-violet-200 hover:bg-violet-900/60 transition"
                >
                  🎙️ 24/7 AI Phone Order:{" "}
                  {restaurant.integrationsConfig?.vapi?.inboundPhoneNumber ||
                    restaurant.phone}
                </a>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-white font-normal leading-[1.15]">
              {restaurant.name} gastronomy, crafted for your{" "}
              <span className="italic" style={{ color: brandColor }}>
                private table.
              </span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base font-light leading-relaxed">
              {restaurant.description}
            </p>

            {/* Quick Customer Re-Order & Scheduled Order Bar in Hero */}
            <div className="pt-2 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <button
                onClick={() => {
                  setAccountTab(activeCustomer ? "history" : "auth");
                  setShowAccountModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white transition"
              >
                <History className="h-3.5 w-3.5 shrink-0" style={{ color: brandColor }} />
                <span>
                  {activeCustomer
                    ? `Past Orders & 1-Click Re-Order (${customerOrders.length})`
                    : "Sign In to View Order History & Re-Order"}
                </span>
              </button>
              <button
                onClick={() => {
                  setAccountTab(activeCustomer ? "scheduled" : "auth");
                  setShowAccountModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900/90 border border-zinc-800 hover:border-zinc-600 px-3.5 sm:px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white transition"
              >
                <Repeat className="h-3.5 w-3.5 shrink-0" style={{ color: brandColor }} />
                <span>Scheduled & Recurring Orders ({activeScheduledCount})</span>
              </button>
              {activeCustomer && customerOrders.length > 0 && (
                <button
                  onClick={() => handleInstantReorderNow(customerOrders[0])}
                  style={{ backgroundColor: brandColor, color: "#000" }}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition shadow"
                >
                  <Zap className="h-3.5 w-3.5" /> Re-Order Last (#
                  {customerOrders[0].orderNumber})
                </button>
              )}
            </div>
          </div>

          {/* Quick Section Anchor Tags & Mobile Dietary Filter */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2">
            {restaurant.features.dietaryFilters &&
              allDietaryTags.length > 0 && (
                <select
                  value={selectedDietary}
                  onChange={(e) => setSelectedDietary(e.target.value)}
                  className="lg:hidden shrink-0 rounded-full bg-zinc-900 border border-zinc-700 px-3.5 py-2.5 text-xs uppercase tracking-wider text-zinc-200 focus:outline-none"
                  aria-label="Filter by dietary preference"
                >
                  <option value="ALL">All Dietary</option>
                  {allDietaryTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            {categories.map((cat, idx) => (
              <a
                key={cat}
                href={`#section-cat-${idx}`}
                className="shrink-0 px-4 sm:px-5 py-2.5 rounded-full bg-zinc-900 hover:border-zinc-600 border border-zinc-800 text-xs font-medium uppercase tracking-wider text-zinc-300 hover:text-white transition whitespace-nowrap"
              >
                {cat}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ABOUT US SECTION (IMMEDIATELY AFTER HERO) ================= */}
      <StorefrontAboutSection
        restaurant={restaurant}
        brandColor={brandColor}
      />

      {/* Store Availability Warning Banner if Ordering is Paused / Closed / Limit Reached */}
      {availability && !availability.allowed && (
        <div className="border-b border-rose-900/60 bg-rose-950/30 px-4 sm:px-6 py-4">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-rose-200">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <div>
                <h3 className="text-sm font-serif text-white">
                  {availability.title} ({availability.reasonCode})
                </h3>
                <p className="text-xs text-rose-300">{availability.message}</p>
              </div>
            </div>
            <Link
              href={`/dashboard/${restaurant.slug}`}
              className="rounded-full border border-rose-700 bg-rose-900/50 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
            >
              Adjust Schedule / Limits in Owner Portal →
            </Link>
          </div>
        </div>
      )}

      {/* Live Placed Order Status Tracker */}
      {placedOrder && (
        <div className="mx-auto mt-6 sm:mt-8 max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl border border-zinc-800 bg-[#0f1117] p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest"
                    style={{ color: brandColor }}
                  >
                    Live Provisioning Tracker • Order #{placedOrder.orderNumber}
                  </span>
                  {placedOrder.scheduledFor && (
                    <span className="rounded-full bg-amber-950/80 border border-amber-700/70 px-2.5 py-0.5 text-[10px] font-mono text-amber-300">
                      📅 Scheduled For: {placedOrder.scheduledFor}
                    </span>
                  )}
                  {placedOrder.posSync?.squareOrderId && (
                    <span className="rounded-full bg-sky-950/80 border border-sky-700/70 px-2.5 py-0.5 text-[10px] font-mono text-sky-300">
                      ⬛ Square POS: {placedOrder.posSync.squareOrderId}
                    </span>
                  )}
                  {placedOrder.posSync?.cloverOrderId && (
                    <span className="rounded-full bg-emerald-950/80 border border-emerald-700/70 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300">
                      🍀 Clover KDS: {placedOrder.posSync.cloverOrderId}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-2xl text-white">
                  Thank you, {placedOrder.customerName}. Status:{" "}
                  <span
                    className="italic uppercase"
                    style={{ color: brandColor }}
                  >
                    {placedOrder.status.replace(/_/g, " ")}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Settled ${placedOrder.total.toFixed(2)} via{" "}
                  <strong className="uppercase text-zinc-200">
                    {placedOrder.paymentMethod}
                  </strong>{" "}
                  ({placedOrder.paymentReference}) • SMS notifications active
                  for {placedOrder.customerPhone}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => openScheduleModalFromOrder(placedOrder)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                >
                  <Repeat className="h-3.5 w-3.5" style={{ color: brandColor }} />{" "}
                  Schedule Recurring Re-Order
                </button>
                <button
                  onClick={() => loadStorefront(simDay, simTime)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
                </button>
                <Link
                  href={`/dashboard/${restaurant.slug}`}
                  style={{ backgroundColor: brandColor }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-black hover:opacity-90"
                >
                  Update in Kitchen Portal →
                </Link>
              </div>
            </div>

            {/* DoorDash Drive Live Dasher Card inside Storefront Tracker */}
            {placedOrder.deliveryTracking && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">
                      🚗 DoorDash Drive White-Label Courier
                    </span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase text-emerald-300">
                      Stage:{" "}
                      {placedOrder.deliveryTracking.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      ID: {placedOrder.deliveryTracking.externalDeliveryId}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200">
                    Dasher:{" "}
                    <strong className="text-white">
                      {placedOrder.deliveryTracking.dasherName}
                    </strong>{" "}
                    ({placedOrder.deliveryTracking.dasherVehicle}) •{" "}
                    <span className="text-emerald-300 font-semibold">
                      ETA ~{placedOrder.deliveryTracking.dropoffEtaMinutes} mins
                    </span>{" "}
                    • Contact: {placedOrder.deliveryTracking.dasherPhone}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {placedOrder.deliveryTracking.status !== "delivered" && (
                    <button
                      type="button"
                      onClick={async () => {
                        const stageOrder = [
                          "quote_created",
                          "dasher_confirmed",
                          "dasher_at_store",
                          "picked_up",
                          "delivered",
                        ] as const;
                        const curIdx = stageOrder.indexOf(
                          placedOrder.deliveryTracking!.status as (typeof stageOrder)[number]
                        );
                        const nextStage =
                          stageOrder[
                            Math.min(curIdx + 1, stageOrder.length - 1)
                          ];
                        const res = await fetch(
                          `/api/restaurants/${encodeURIComponent(
                            restaurant.slug
                          )}/integrations`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "advance_doordash_status",
                              orderId: placedOrder.id,
                              nextStage,
                            }),
                          }
                        );
                        if (res.ok) {
                          await loadStorefront(simDay, simTime);
                        }
                      }}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30 transition"
                    >
                      ⚡ Advance Dasher Stage →
                    </button>
                  )}
                  <a
                    href={placedOrder.deliveryTracking.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-400 transition"
                  >
                    📍 Live GPS Tracking Map ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ORDERING WORKSPACE ================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-28 lg:pb-12 grid lg:grid-cols-12 gap-8 lg:gap-10">
        {/* CATERING / CULINARY MENU (8 Cols) */}
        <div className="lg:col-span-8 space-y-12 sm:space-y-16">
          {categories.map((categoryName, catIdx) => {
            const sectionItems = filteredMenu.filter(
              (m) => m.category === categoryName
            );

            const useVisualCards =
              activeLayout === "modern-grid" ||
              (activeLayout === "aura-luxury" && catIdx === 0);

            const useCompactBistro = activeLayout === "compact-bistro";

            return (
              <section
                key={categoryName}
                id={`section-cat-${catIdx}`}
                className="space-y-6"
              >
                <div className="flex justify-between items-end border-b border-zinc-800/80 pb-4">
                  <div>
                    <span
                      className="text-xs font-mono uppercase tracking-widest"
                      style={{ color: brandColor }}
                    >
                      {catIdx === 0
                        ? "Signature Culinary Selection"
                        : "Curated Course"}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif text-white mt-1">
                      {categoryName}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Prepared fresh to order in {restaurant.name}&apos;s
                      kitchen.
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono tracking-wider">
                    {sectionItems.length}{" "}
                    {sectionItems.length === 1 ? "Selection" : "Selections"}
                  </span>
                </div>

                {useVisualCards ? (
                  /* VISUAL BANQUET CARDS (AURA Section 1 Style) */
                  <div className="grid md:grid-cols-2 gap-6">
                    {sectionItems.map((item) => {
                      const canOrder =
                        item.available &&
                        (!availability || availability.allowed);
                      return (
                        <div
                          key={item.id}
                          className={`bg-zinc-900/40 border rounded-2xl overflow-hidden transition flex flex-col justify-between group ${
                            item.available
                              ? "border-zinc-800/80 hover:border-zinc-700"
                              : "border-rose-900/40 opacity-75"
                          }`}
                        >
                          <div>
                            <div className="aspect-[16/10] relative overflow-hidden bg-zinc-900">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${
                                  !item.available ? "grayscale" : ""
                                }`}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-mono tracking-wider text-zinc-200 border border-zinc-700">
                                ⏱ {item.prepTimeMinutes}m Prep
                                {item.currentStockCount !== null &&
                                  item.available &&
                                  ` • ${item.currentStockCount} Left`}
                              </span>

                              {!item.available && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center">
                                  <div className="rounded-xl border border-rose-500/40 bg-zinc-950/95 px-4 py-2.5">
                                    <p className="text-xs font-mono uppercase tracking-widest text-rose-400">
                                      86&apos;d • Unavailable
                                    </p>
                                    {item.unavailableReason && (
                                      <p className="mt-1 text-[11px] text-zinc-300">
                                        {item.unavailableReason}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="p-4 sm:p-6 space-y-3">
                              <div className="flex justify-between items-baseline gap-3">
                                <h3 className="font-serif text-xl text-white tracking-wide">
                                  {item.name}
                                </h3>
                                <span
                                  className="font-serif font-medium text-xl shrink-0"
                                  style={{ color: brandColor }}
                                >
                                  ${item.price.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                {item.description}
                              </p>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {item.dietaryTags.map((tag, tIdx) => (
                                  <span
                                    key={tag}
                                    style={
                                      tIdx === 0
                                        ? {
                                            color: brandColor,
                                            borderColor: `${brandColor}40`,
                                          }
                                        : undefined
                                    }
                                    className={`text-[10px] px-2.5 py-0.5 rounded font-mono ${
                                      tIdx === 0
                                        ? "bg-zinc-800/80 border"
                                        : "bg-zinc-800 text-zinc-400"
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              {/* Variant & Side Options Preview Strip */}
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2.5 space-y-1.5 text-[11px]">
                                  {item.modifiers.map((grp) => {
                                    const isSide =
                                      grp.type === "side" ||
                                      grp.name.toLowerCase().includes("side");
                                    const isVariant =
                                      grp.type === "variant" ||
                                      (!isSide && grp.required);
                                    return (
                                      <div
                                        key={grp.name}
                                        className="flex flex-wrap items-baseline gap-1.5"
                                      >
                                        <span
                                          className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${
                                            isVariant
                                              ? "text-amber-300"
                                              : isSide
                                              ? "text-emerald-300"
                                              : "text-sky-300"
                                          }`}
                                        >
                                          {isVariant
                                            ? "Variants:"
                                            : isSide
                                            ? "Side Options:"
                                            : `${grp.name}:`}
                                        </span>
                                        <span className="text-zinc-300 line-clamp-1">
                                          {grp.options
                                            .map((o) =>
                                              o.priceDelta > 0
                                                ? `${o.label} (+$${o.priceDelta.toFixed(2)})`
                                                : o.label
                                            )
                                            .join(" • ")}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-4 sm:p-6 pt-0">
                            <button
                              disabled={!canOrder}
                              onClick={() => openAddItemModal(item)}
                              className={`w-full py-3 rounded-xl font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                canOrder
                                  ? "bg-zinc-800 hover:bg-gold-400 hover:text-black text-zinc-200"
                                  : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                              }`}
                            >
                              {item.available ? (
                                <>
                                  <Plus className="w-4 h-4" /> Select Variant &
                                  Sides
                                </>
                              ) : (
                                "Currently Unavailable"
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : useCompactBistro ? (
                  /* COMPACT EXPRESS BISTRO CARDS */
                  <div className="grid sm:grid-cols-2 gap-4">
                    {sectionItems.map((item) => {
                      const canOrder =
                        item.available &&
                        (!availability || availability.allowed);
                      const variantGroup = item.modifiers?.find(
                        (g) => g.type === "variant" || g.required
                      );
                      const sideGroup = item.modifiers?.find(
                        (g) =>
                          g.type === "side" ||
                          g.name.toLowerCase().includes("side")
                      );
                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl bg-zinc-900/40 border flex items-center justify-between gap-4 transition ${
                            item.available
                              ? "border-zinc-800/80 hover:border-zinc-700"
                              : "border-rose-900/40 opacity-65"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className={`h-16 w-16 rounded-xl object-cover shrink-0 border border-zinc-800 ${
                                !item.available ? "grayscale" : ""
                              }`}
                            />
                            <div className="min-w-0 space-y-1">
                              <h4 className="font-serif text-base text-white truncate">
                                {item.name}
                              </h4>
                              <p className="text-xs text-zinc-400 line-clamp-1">
                                {!item.available && item.unavailableReason
                                  ? item.unavailableReason
                                  : item.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                                {variantGroup && (
                                  <span className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-amber-300">
                                    {variantGroup.options.length} Variants
                                  </span>
                                )}
                                {sideGroup && (
                                  <span className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-emerald-300">
                                    +{sideGroup.options.length} Sides
                                  </span>
                                )}
                              </div>
                              <span
                                className="block font-serif text-sm font-medium"
                                style={{ color: brandColor }}
                              >
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            disabled={!canOrder}
                            onClick={() => openAddItemModal(item)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider shrink-0 transition ${
                              canOrder
                                ? "bg-zinc-800 hover:bg-gold-400 hover:text-black text-zinc-200"
                                : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                            }`}
                          >
                            {item.available ? "+ Options" : "86'd"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* HORIZONTAL DEGUSTATION ROWS (AURA Section 2 & 3 Style) */
                  <div className="space-y-3">
                    {sectionItems.map((item) => {
                      const canOrder =
                        item.available &&
                        (!availability || availability.allowed);
                      return (
                        <div
                          key={item.id}
                          className={`p-5 rounded-2xl bg-zinc-900/30 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition ${
                            item.available
                              ? "border-zinc-800/70 hover:border-zinc-700"
                              : "border-rose-900/40 opacity-70"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className={`h-16 w-16 rounded-xl object-cover shrink-0 border border-zinc-800/80 ${
                                !item.available ? "grayscale" : ""
                              }`}
                            />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <h4 className="font-serif text-base text-white">
                                  {item.name}
                                </h4>
                                {item.dietaryTags.map((tag, tIdx) => (
                                  <span
                                    key={tag}
                                    style={
                                      tIdx === 0
                                        ? { color: brandColor }
                                        : undefined
                                    }
                                    className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {!item.available && (
                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300">
                                    Unavailable
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400">
                                {item.description}
                              </p>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px]">
                                  {item.modifiers.map((grp) => {
                                    const isSide =
                                      grp.type === "side" ||
                                      grp.name.toLowerCase().includes("side");
                                    const isVariant =
                                      grp.type === "variant" ||
                                      (!isSide && grp.required);
                                    return (
                                      <span
                                        key={grp.name}
                                        className="text-zinc-400"
                                      >
                                        <strong
                                          className={`font-mono text-[10px] uppercase ${
                                            isVariant
                                              ? "text-amber-300"
                                              : isSide
                                              ? "text-emerald-300"
                                              : "text-sky-300"
                                          }`}
                                        >
                                          {isVariant
                                            ? "Variants:"
                                            : isSide
                                            ? "Sides:"
                                            : `${grp.name}:`}
                                        </strong>{" "}
                                        {grp.options
                                          .slice(0, 3)
                                          .map((o) => o.label)
                                          .join(", ")}
                                        {grp.options.length > 3
                                          ? ` +${grp.options.length - 3} more`
                                          : ""}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {!item.available && item.unavailableReason && (
                                <p className="text-[11px] font-mono text-rose-400">
                                  Note: {item.unavailableReason}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                            <span
                              className="font-serif font-medium text-lg"
                              style={{ color: brandColor }}
                            >
                              ${item.price.toFixed(2)}
                            </span>
                            <button
                              disabled={!canOrder}
                              onClick={() => openAddItemModal(item)}
                              className={`px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                                canOrder
                                  ? "bg-zinc-800 hover:bg-gold-400 hover:text-black text-zinc-200"
                                  : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                              }`}
                            >
                              {item.available
                                ? "+ Variant & Sides"
                                : "Sold Out"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* ================= STICKY ORDER PROVISION CONSOLE (4 Cols) ================= */}
        <aside id="provisioning-desk" className="lg:col-span-4">
          <div className="sticky top-28 bg-[#0f1117] border border-zinc-800/90 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span
                  className="text-[10px] font-mono tracking-widest uppercase"
                  style={{ color: brandColor }}
                >
                  Provisioning Desk
                </span>
                <h3 className="font-serif text-2xl text-white">
                  Order Summary
                </h3>
              </div>
              <span className="rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1 font-mono text-xs text-zinc-300">
                {totalCount} {totalCount === 1 ? "item" : "items"}
              </span>
            </div>

            {/* Signed-In Customer Banner inside Provisioning Console */}
            {activeCustomer ? (
              <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <UserCheck
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: brandColor }}
                    />
                    <span className="text-xs font-semibold text-white truncate">
                      {activeCustomer.name}
                    </span>
                    {activeCustomer.vipStatus && (
                      <span
                        className="rounded px-1.5 py-0.2 text-[9px] font-mono uppercase font-bold text-black"
                        style={{ backgroundColor: brandColor }}
                      >
                        VIP
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {activeCustomer.loyaltyPoints} Loyalty Pts •{" "}
                    {customerOrders.length} Past Orders
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountTab("history");
                    setShowAccountModal(true);
                  }}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-200 hover:border-zinc-500 shrink-0"
                >
                  Re-Order
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAccountTab("auth");
                  setShowAccountModal(true);
                }}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3 text-left flex items-center justify-between hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4" style={{ color: brandColor }} />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Sign In for 1-Click Re-Orders
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Earn loyalty points & schedule recurring orders
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            )}

            {/* Fulfillment Mode Selector */}
            <div className="space-y-2">
              <div
                className={`grid gap-1.5 rounded-2xl bg-zinc-950/90 p-1.5 border border-zinc-800/80 ${
                  [
                    restaurant.features.pickup,
                    restaurant.features.delivery,
                    restaurant.features.dineInQr,
                  ].filter(Boolean).length === 1
                    ? "grid-cols-1"
                    : [
                        restaurant.features.pickup,
                        restaurant.features.delivery,
                        restaurant.features.dineInQr,
                      ].filter(Boolean).length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
                }`}
              >
                {restaurant.features.pickup && (
                  <button
                    type="button"
                    onClick={() => setOrderType("pickup")}
                    style={
                      orderType === "pickup"
                        ? { backgroundColor: brandColor, color: "#000" }
                        : undefined
                    }
                    className={`rounded-xl py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
                      orderType === "pickup"
                        ? "font-bold shadow"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    🛍️ Pickup
                  </button>
                )}
                {restaurant.features.delivery && (
                  <button
                    type="button"
                    onClick={() => setOrderType("delivery")}
                    style={
                      orderType === "delivery"
                        ? { backgroundColor: brandColor, color: "#000" }
                        : undefined
                    }
                    className={`rounded-xl py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
                      orderType === "delivery"
                        ? "font-bold shadow"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    🛵 Delivery
                  </button>
                )}
                {restaurant.features.dineInQr && (
                  <button
                    type="button"
                    onClick={() => setOrderType("dine_in")}
                    style={
                      orderType === "dine_in"
                        ? { backgroundColor: brandColor, color: "#000" }
                        : undefined
                    }
                    className={`rounded-xl py-1.5 text-[11px] font-mono uppercase tracking-wider transition ${
                      orderType === "dine_in"
                        ? "font-bold shadow"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    🍽️ Dine-In
                  </button>
                )}
              </div>

              {/* Active Fulfillment Mode Info / Owner Instructions */}
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-[10px] text-zinc-400">
                {orderType === "pickup" && (
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span>
                      🛍️{" "}
                      {restaurant.features.pickupInstructions ||
                        (restaurant.features.curbsidePickup !== false
                          ? "In-store counter & curbside pickup available"
                          : "In-store counter pickup")}
                    </span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      $0 Fee
                    </span>
                  </div>
                )}
                {orderType === "delivery" && (
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span>
                        🛵{" "}
                        {restaurant.features.deliveryInstructions ||
                          `Local delivery (${
                            restaurant.features.deliveryRadiusMiles || 5
                          } mi radius)`}
                      </span>
                      <span className="font-mono text-sky-400 font-semibold">
                        ${restaurant.paymentConfig.deliveryFee.toFixed(2)} Fee
                        (Free ${restaurant.paymentConfig.freeDeliveryMin}+)
                      </span>
                    </div>
                  </div>
                )}
                {orderType === "dine_in" && (
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span>
                      🍽️{" "}
                      {restaurant.features.dineInInstructions ||
                        "Order directly to your table via QR code"}
                    </span>
                    <span className="font-mono text-amber-300 font-semibold">
                      Table Service
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Advance Pickup / Delivery Date & Time Picker in Storefront Sidebar */}
            <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: brandColor }}
                  />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-200 font-semibold">
                    {orderType === "delivery"
                      ? "Delivery Date & Time"
                      : orderType === "pickup"
                      ? "Pickup Date & Time"
                      : "Dine-In Date & Time"}
                  </span>
                </div>
                {requiresAdvanceNotice && (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-300">
                    Min {advanceNoticeSummary} Notice
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckoutTiming("asap")}
                  style={
                    checkoutTiming === "asap"
                      ? { backgroundColor: brandColor, color: "#000" }
                      : undefined
                  }
                  className={`rounded-xl py-1.5 px-2 text-[10px] font-mono uppercase transition ${
                    checkoutTiming === "asap"
                      ? "font-bold shadow"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  {requiresAdvanceNotice
                    ? "⏳ Earliest Ready"
                    : `🔥 ASAP (~${restaurant.prepTimeMinutes}m)`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutTiming("scheduled");
                    if (
                      !checkoutSchedDate ||
                      checkoutSchedDate < earliestReadyDateIso
                    ) {
                      setCheckoutSchedDate(earliestReadyDateIso);
                      setCheckoutSchedTime(earliestReadyTimeStr);
                    }
                  }}
                  style={
                    checkoutTiming === "scheduled"
                      ? { backgroundColor: brandColor, color: "#000" }
                      : undefined
                  }
                  className={`rounded-xl py-1.5 px-2 text-[10px] font-mono uppercase transition ${
                    checkoutTiming === "scheduled"
                      ? "font-bold shadow"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  📅 Pick Advance Date
                </button>
              </div>

              {checkoutTiming === "asap" ? (
                <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-[11px] text-zinc-300">
                  <span>
                    Target{" "}
                    {orderType === "delivery"
                      ? "Delivery"
                      : orderType === "pickup"
                      ? "Pickup"
                      : "Ready"}
                    :
                  </span>
                  <strong className="font-mono text-white">
                    {earliestReadyFormatted}
                  </strong>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1 border-t border-zinc-800/80">
                  {/* Quick Advance Date Presets */}
                  <div className="flex flex-wrap gap-1">
                    {quickAdvanceDates.map((qd) => {
                      const active = checkoutSchedDate === qd.dateIso;
                      return (
                        <button
                          key={qd.label}
                          type="button"
                          onClick={() => setCheckoutSchedDate(qd.dateIso)}
                          style={
                            active
                              ? {
                                  borderColor: brandColor,
                                  color: brandColor,
                                }
                              : undefined
                          }
                          className={`rounded-lg border px-2 py-1 font-mono text-[10px] transition ${
                            active
                              ? "bg-zinc-900 font-bold"
                              : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {qd.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-400">
                        Advance Date ({selectedDayOfWeekName.slice(0, 3)})
                      </label>
                      <input
                        type="date"
                        min={earliestReadyDateIso}
                        value={checkoutSchedDate}
                        onChange={(e) => setCheckoutSchedDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-400">
                        {orderType === "delivery"
                          ? "Delivery Time"
                          : "Pickup Time"}
                      </label>
                      <input
                        type="time"
                        min={orderType === "pickup" ? dayPickupStart : undefined}
                        max={orderType === "pickup" ? dayPickupEnd : undefined}
                        value={checkoutSchedTime}
                        onChange={(e) => setCheckoutSchedTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Day-of-Week Available Pickup Time Slots Selector */}
                  {orderType === "pickup" && (
                    <div className="space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-400 uppercase">
                          🛍️ {selectedDayOfWeekName} Pickup Window:
                        </span>
                        <span
                          className={
                            isPickupAvailableOnSelectedDay
                              ? "font-bold text-amber-300"
                              : "font-bold text-rose-400"
                          }
                        >
                          {isPickupAvailableOnSelectedDay
                            ? `${dayPickupStart} – ${dayPickupEnd}`
                            : "Pickup Closed"}
                        </span>
                      </div>

                      {isPickupAvailableOnSelectedDay &&
                        availablePickupSlotsForSelectedDay.length > 0 && (
                          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5">
                            {availablePickupSlotsForSelectedDay.map((slot) => {
                              const activeSlot = checkoutSchedTime === slot;
                              const cap = getSlotCapacityInfo(slot);
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={cap.isFull}
                                  onClick={() => setCheckoutSchedTime(slot)}
                                  style={
                                    activeSlot && !cap.isFull
                                      ? {
                                          backgroundColor: brandColor,
                                          color: "#000",
                                        }
                                      : undefined
                                  }
                                  className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[10px] transition ${
                                    cap.isFull
                                      ? "cursor-not-allowed border-rose-900/50 bg-rose-950/30 text-rose-400/60 line-through"
                                      : activeSlot
                                      ? "border-transparent font-bold shadow"
                                      : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
                                  }`}
                                  title={
                                    cap.isFull
                                      ? `${slot} is FULL (${cap.bookedOrders}/${cap.maxOrders} orders booked)`
                                      : `${cap.remainingOrders} of ${cap.maxOrders} order spots left`
                                  }
                                >
                                  <span>{slot}</span>{" "}
                                  <span
                                    className={`text-[9px] ${
                                      cap.isFull
                                        ? "font-bold text-rose-400 no-underline"
                                        : activeSlot
                                        ? "opacity-80"
                                        : "text-emerald-400"
                                    }`}
                                  >
                                    {cap.isFull
                                      ? "(FULL)"
                                      : `(${cap.remainingOrders}/${cap.maxOrders})`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-950/25 px-3 py-1.5 text-[11px] text-emerald-300">
                    <span>
                      📅 Scheduled{" "}
                      {orderType === "delivery" ? "Delivery" : "Pickup"}:
                    </span>
                    <strong className="font-mono">
                      {checkoutSchedDate} • {checkoutSchedTime}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Tier Minimum Tracker (AURA style) */}
            <div className="space-y-2 bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-light">
                  Order Minimum (${minSpend.toFixed(0)})
                </span>
                <span
                  style={minMet ? { color: brandColor } : undefined}
                  className={
                    minMet
                      ? "font-semibold tracking-wide"
                      : "text-zinc-400 font-medium"
                  }
                >
                  {minMet ? "Requirement Met!" : `$${minRemaining} to minimum`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${minProgressPercent}%`,
                    backgroundColor: minMet ? brandColor : "#52525b",
                  }}
                />
              </div>
            </div>

            {/* Cart Item Entries */}
            {cart.length === 0 ? (
              <div className="py-7 text-center space-y-3 border-y border-zinc-800/60">
                <UtensilsCrossed className="mx-auto h-6 w-6 text-zinc-600" />
                <p className="text-xs text-zinc-500">
                  Select dishes from {restaurant.name}&apos;s menu or re-order
                  from your past history.
                </p>
                {activeCustomer && customerOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleLoadOrderIntoCart(customerOrders[0])}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[11px] font-mono text-zinc-200 hover:border-zinc-500"
                  >
                    <History
                      className="h-3.5 w-3.5"
                      style={{ color: brandColor }}
                    />
                    Load Last Order (#{customerOrders[0].orderNumber})
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start text-xs border-b border-zinc-800/50 pb-3"
                  >
                    <div className="pr-2">
                      <div className="text-zinc-200 font-medium font-serif text-sm">
                        {item.name}
                      </div>
                      {item.selectedModifiers.length > 0 && (
                        <div className="text-zinc-500 text-[11px] font-mono">
                          {item.selectedModifiers
                            .map((m) => m.optionLabel)
                            .join(" • ")}
                        </div>
                      )}
                      <div
                        className="mt-1 font-mono"
                        style={{ color: brandColor }}
                      >
                        ${(item.itemTotal / item.quantity).toFixed(2)} ×{" "}
                        {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(idx, -1)}
                        className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-zinc-200 px-1 text-xs">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(idx, 1)}
                        className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Promo Code & Tip Selector */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-1">
                {restaurant.features.promoCodes && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Promo Code (e.g. NAPOLIVIP15)"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono uppercase text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-mono uppercase text-zinc-200 hover:bg-zinc-700"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {restaurant.features.tipping && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 15, 18, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTipPercent(pct)}
                        style={
                          tipPercent === pct
                            ? {
                                borderColor: brandColor,
                                color: brandColor,
                              }
                            : undefined
                        }
                        className={`rounded-xl border py-1.5 text-[11px] font-mono transition ${
                          tipPercent === pct
                            ? "bg-zinc-900 font-bold"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400"
                        }`}
                      >
                        {pct === 0 ? "No Tip" : `${pct}% Tip`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ledger Calculation */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-2.5 text-xs text-zinc-400 font-light">
              <div className="flex justify-between">
                <span>Culinary Subtotal</span>
                <span className="text-zinc-200 font-mono">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Privilege Discount ({discountPercent}%)</span>
                  <span className="font-mono">
                    -${discountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>
                  Tax & Serviceware ({restaurant.paymentConfig.taxRatePercent}%)
                </span>
                <span className="text-zinc-200 font-mono">
                  ${taxAmount.toFixed(2)}
                </span>
              </div>
              {orderType === "delivery" && (
                <div className="flex justify-between">
                  <span>White-Glove Courier Delivery</span>
                  <span className="text-zinc-200 font-mono">
                    {deliveryFee === 0
                      ? "COMPLIMENTARY"
                      : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between">
                  <span>Hospitality Gratuity ({tipPercent}%)</span>
                  <span className="text-zinc-200 font-mono">
                    ${tipAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-zinc-800 pt-3 flex justify-between text-sm text-white font-medium">
                <span>Estimated Total</span>
                <span
                  className="font-serif text-xl font-normal"
                  style={{ color: brandColor }}
                >
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Checkout & Schedule Buttons */}
            <div className="space-y-2.5">
              {requiresAdvanceNotice && (
                <div className="rounded-2xl border border-amber-700/40 bg-amber-950/25 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-amber-300">
                    <span>⏳ {advanceNoticeSummary} Advance Notice</span>
                    <span>+{restaurant.prepTimeMinutes}m Prep</span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Earliest Ready: <strong className="text-white">{earliestReadyFormatted}</strong>
                  </p>
                  {restaurant.advanceNoticeNote && (
                    <p className="text-[10px] text-amber-200/80 italic">
                      {restaurant.advanceNoticeNote}
                    </p>
                  )}
                </div>
              )}

              <button
                disabled={
                  cart.length === 0 ||
                  (availability ? !availability.allowed : false)
                }
                onClick={() => {
                  if (
                    !checkoutSchedDate ||
                    checkoutSchedDate < earliestReadyDateIso
                  ) {
                    setCheckoutSchedDate(earliestReadyDateIso);
                    setCheckoutSchedTime(earliestReadyTimeStr);
                  }
                  setCheckoutError(null);
                  setShowCheckoutModal(true);
                }}
                style={
                  cart.length > 0 && (!availability || availability.allowed)
                    ? { backgroundColor: brandColor, color: "#000" }
                    : undefined
                }
                className={`w-full py-4 rounded-xl font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  cart.length > 0 && (!availability || availability.allowed)
                    ? "hover:opacity-90 shadow-lg"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {availability && !availability.allowed ? (
                  "Ordering Currently Paused"
                ) : (
                  <>
                    Confirm Order Details <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={openScheduleModalFromCart}
                  className="w-full py-2.5 rounded-xl border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition"
                >
                  <Calendar
                    className="w-3.5 h-3.5"
                    style={{ color: brandColor }}
                  />
                  Schedule / Recurring Order
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
              Instant SMS confirmation & kitchen tracking dispatched upon Stripe
              or PayPal settlement.
            </p>
          </div>
        </aside>
      </main>

      {/* ================= STOREFRONT FOOTER ================= */}
      <StorefrontFooter restaurant={restaurant} brandColor={brandColor} />

      {/* ================= MOBILE STICKY BOTTOM CART & CHECKOUT BAR (lg:hidden) ================= */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/90 bg-[#0b0c10]/95 px-3 py-2.5 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("provisioning-desk")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-black shadow"
              style={{ backgroundColor: brandColor }}
            >
              {totalCount}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">
                {cart.length > 0
                  ? `${totalCount} Selection${totalCount === 1 ? "" : "s"} • $${grandTotal.toFixed(2)}`
                  : "Provisioning Manifest"}
              </div>
              <div className="truncate font-mono text-[10px] text-zinc-400">
                {cart.length > 0
                  ? `${orderType.replace("_", " ").toUpperCase()} • Tap to review`
                  : "Tap to view order summary"}
              </div>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("provisioning-desk")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              View Cart
            </button>
            <button
              type="button"
              disabled={
                cart.length === 0 || (availability !== null && !availability.allowed)
              }
              onClick={() => {
                setCheckoutError(null);
                setShowCheckoutModal(true);
              }}
              style={
                cart.length > 0 && (!availability || availability.allowed)
                  ? { backgroundColor: brandColor, color: "#000" }
                  : undefined
              }
              className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                cart.length > 0 && (!availability || availability.allowed)
                  ? "shadow-lg hover:opacity-90"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500"
              }`}
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: CUSTOMER ACCOUNT, AUTHENTICATION, ORDER HISTORY & RE-ORDERS */}
      {/* ===================================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl sm:rounded-3xl border border-zinc-800 bg-[#0f1117] p-4 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 my-4 sm:my-8 text-zinc-200 max-h-[92dvh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-5">
              <div>
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: brandColor }}
                >
                  {restaurant.name} • Guest Concierge & VIP Portal
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl text-white mt-1">
                  {activeCustomer
                    ? `${activeCustomer.name}'s Culinary Account`
                    : "Customer Sign In & VIP Registration"}
                </h2>
                {activeCustomer && (
                  <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-zinc-400">
                    <span>{activeCustomer.email}</span>
                    <span>•</span>
                    <span>{activeCustomer.phone}</span>
                    {activeCustomer.vipStatus && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase text-black"
                        style={{ backgroundColor: brandColor }}
                      >
                        <Award className="h-3 w-3" /> VIP Member
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-mono text-zinc-200">
                      ✨ {activeCustomer.loyaltyPoints} Loyalty Pts ($
                      {(activeCustomer.loyaltyPoints * 0.05).toFixed(2)} Reward
                      Value)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeCustomer && (
                  <button
                    type="button"
                    onClick={handleSignOutCustomer}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 1-Click Demo Customer Switcher Bar (Always Accessible for Testing) */}
            {demoCustomers.length > 0 && (
              <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                    ⚡ Quick Demo Guest Switcher ({restaurant.name} Accounts)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthFormMode("register");
                      setAccountTab("auth");
                    }}
                    className="text-[11px] font-mono underline hover:text-white"
                    style={{ color: brandColor }}
                  >
                    + Register New Customer Account
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {demoCustomers.map((dc) => {
                    const isCurrent = activeCustomer?.id === dc.id;
                    return (
                      <button
                        key={dc.id}
                        type="button"
                        onClick={() => handleSwitchDemoCustomer(dc)}
                        style={
                          isCurrent
                            ? {
                                borderColor: brandColor,
                                backgroundColor: `${brandColor}18`,
                              }
                            : undefined
                        }
                        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                          isCurrent
                            ? "text-white font-semibold"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span>{dc.name}</span>
                        {dc.vipStatus && (
                          <span
                            className="rounded px-1 text-[9px] font-mono font-bold text-black"
                            style={{ backgroundColor: brandColor }}
                          >
                            VIP
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">
                          ({dc.totalOrders} orders)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation Tabs inside Account Modal */}
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto border-b border-zinc-800 px-1 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {activeCustomer && (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountTab("history")}
                    style={
                      accountTab === "history"
                        ? { backgroundColor: brandColor, color: "#000" }
                        : undefined
                    }
                    className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      accountTab === "history"
                        ? "shadow"
                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <History className="h-4 w-4" />
                    Order History & Re-Order ({customerOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountTab("scheduled")}
                    style={
                      accountTab === "scheduled"
                        ? { backgroundColor: brandColor, color: "#000" }
                        : undefined
                    }
                    className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      accountTab === "scheduled"
                        ? "shadow"
                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Repeat className="h-4 w-4" />
                    Scheduled & Recurring ({scheduledReorders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountTab("profile")}
                    style={
                      accountTab === "profile"
                        ? { backgroundColor: brandColor, color: "#000" }
                        : undefined
                    }
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      accountTab === "profile"
                        ? "shadow"
                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Profile, Loyalty & Addresses
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setAccountTab("auth")}
                style={
                  accountTab === "auth"
                    ? { backgroundColor: brandColor, color: "#000" }
                    : undefined
                }
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                  accountTab === "auth"
                    ? "shadow"
                    : "bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                <UserPlus className="h-4 w-4" />
                {activeCustomer
                  ? "Switch / Create Account"
                  : "Sign In / Register"}
              </button>
            </div>

            {/* TAB 1: PAST ORDER HISTORY & 1-CLICK RE-ORDER */}
            {accountTab === "history" && activeCustomer && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-xl text-white">
                      Complete Order History at {restaurant.name}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Re-order any past meal in 1 click, load items back into
                      your cart, or schedule a recurring delivery.
                    </p>
                  </div>
                </div>

                {customerOrders.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center space-y-2">
                    <ShoppingBag className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="text-sm font-serif text-white">
                      No orders placed yet under {activeCustomer.email}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Select dishes from the menu to place your first order and
                      unlock 1-click re-ordering!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4 hover:border-zinc-700 transition"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/80 pb-3.5">
                          <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="font-mono text-sm font-bold text-white">
                                Order #{ord.orderNumber}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase border ${
                                  ord.status === "completed" ||
                                  ord.status === "ready"
                                    ? "bg-emerald-950/70 border-emerald-700/70 text-emerald-300"
                                    : ord.status === "cancelled"
                                      ? "bg-rose-950/70 border-rose-700/70 text-rose-300"
                                      : "bg-amber-950/70 border-amber-700/70 text-amber-300"
                                }`}
                              >
                                {ord.status}
                              </span>
                              <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[10px] font-mono uppercase text-zinc-300">
                                {ord.orderType.replace("_", " ")}
                              </span>
                              <span className="text-xs text-zinc-500 font-mono">
                                {new Date(ord.createdAt).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                            {ord.deliveryAddress && (
                              <p className="text-[11px] text-zinc-400 mt-1">
                                📍 {ord.deliveryAddress}
                              </p>
                            )}
                            {ord.scheduledFor && (
                              <p className="text-[11px] font-mono text-amber-300 mt-1">
                                📅 Scheduled Fulfillment: {ord.scheduledFor}
                              </p>
                            )}
                            {(ord.deliveryTracking ||
                              ord.posSync?.squareOrderId ||
                              ord.posSync?.cloverOrderId ||
                              ord.posSync?.sourceChannel ===
                                "vapi_voice_call") && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {ord.deliveryTracking && (
                                  <a
                                    href={ord.deliveryTracking.trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/30 px-2.5 py-0.5 text-[10px] font-mono text-rose-200 hover:bg-rose-900/40"
                                  >
                                    🚗 DoorDash:{" "}
                                    {ord.deliveryTracking.dasherName} (
                                    {ord.deliveryTracking.status.replace(
                                      /_/g,
                                      " "
                                    )}
                                    ) ↗
                                  </a>
                                )}
                                {ord.posSync?.squareOrderId && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-950/30 px-2.5 py-0.5 text-[10px] font-mono text-sky-300">
                                    ⬛ Square: {ord.posSync.squareOrderId}
                                  </span>
                                )}
                                {ord.posSync?.cloverOrderId && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300">
                                    🍀 Clover KDS: {ord.posSync.cloverOrderId}
                                  </span>
                                )}
                                {ord.posSync?.sourceChannel ===
                                  "vapi_voice_call" && (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-950/30 px-2.5 py-0.5 text-[10px] font-mono text-violet-300">
                                    🎙️ Vapi AI Phone Order
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span
                              className="font-serif text-2xl font-medium"
                              style={{ color: brandColor }}
                            >
                              ${ord.total.toFixed(2)}
                            </span>
                            <p className="text-[10px] font-mono uppercase text-zinc-500">
                              Paid via {ord.paymentMethod}
                            </p>
                          </div>
                        </div>

                        {/* Ordered Dishes Breakdown */}
                        <div className="grid sm:grid-cols-2 gap-2.5">
                          {ord.items.map((line, lIdx) => (
                            <div
                              key={lIdx}
                              className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <span className="font-semibold text-white">
                                  {line.quantity}× {line.name}
                                </span>
                                {line.selectedModifiers &&
                                  line.selectedModifiers.length > 0 && (
                                    <p className="text-[10px] font-mono text-zinc-400">
                                      {line.selectedModifiers
                                        .map((m) => m.optionLabel)
                                        .join(" • ")}
                                    </p>
                                  )}
                              </div>
                              <span className="font-mono text-zinc-300">
                                ${line.itemTotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Re-Order & Schedule Re-Order Actions */}
                        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleLoadOrderIntoCart(ord)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Load into Cart
                          </button>

                          <button
                            type="button"
                            onClick={() => openScheduleModalFromOrder(ord)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500 transition"
                          >
                            <Calendar
                              className="h-3.5 w-3.5"
                              style={{ color: brandColor }}
                            />
                            Schedule / Recurring Re-Order
                          </button>

                          <button
                            type="button"
                            disabled={authBusy}
                            onClick={() => handleInstantReorderNow(ord)}
                            style={{
                              backgroundColor: brandColor,
                              color: "#000",
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition shadow"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            1-Click Re-Order Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SCHEDULED & RECURRING RE-ORDERS */}
            {accountTab === "scheduled" && activeCustomer && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl text-white">
                      Scheduled & Standing Recurring Orders
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Automate your favorite weekly dinners, office team
                      lunches, or future event provisioning.
                    </p>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={openScheduleModalFromCart}
                      style={{ backgroundColor: brandColor, color: "#000" }}
                      className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider"
                    >
                      + Schedule Active Cart ({totalCount} items)
                    </button>
                  )}
                </div>

                {scheduledReorders.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center space-y-3">
                    <Repeat className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="text-sm font-serif text-white">
                      No Scheduled Re-Orders Configured Yet
                    </p>
                    <p className="text-xs text-zinc-400">
                      Click &quot;Schedule / Recurring Re-Order&quot; on any
                      past order in your Order History to set up a future or
                      weekly standing order.
                    </p>
                    {customerOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          openScheduleModalFromOrder(customerOrders[0])
                        }
                        style={{ backgroundColor: brandColor, color: "#000" }}
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Schedule Last Order
                        (#{customerOrders[0].orderNumber})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scheduledReorders.map((sched) => (
                      <div
                        key={sched.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/80 pb-3.5">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-serif text-lg text-white">
                                {sched.title}
                              </h4>
                              <span
                                style={{
                                  color: brandColor,
                                  borderColor: `${brandColor}50`,
                                }}
                                className="rounded-full bg-zinc-900 border px-2.5 py-0.5 text-[10px] font-mono uppercase font-bold"
                              >
                                ↻ {sched.frequency}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase border ${
                                  sched.status === "active"
                                    ? "bg-emerald-950/70 border-emerald-700/70 text-emerald-300"
                                    : sched.status === "paused"
                                      ? "bg-amber-950/70 border-amber-700/70 text-amber-300"
                                      : "bg-zinc-900 border-zinc-700 text-zinc-400"
                                }`}
                              >
                                {sched.status}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-1 font-mono">
                              📅 Next Dispatch:{" "}
                              <strong className="text-white">
                                {sched.scheduledDate} at {sched.scheduledTime}
                              </strong>{" "}
                              • {sched.orderType.toUpperCase()} •{" "}
                              {sched.paymentMethod.toUpperCase()}
                            </p>
                            {sched.deliveryAddress && (
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                📍 {sched.deliveryAddress}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span
                              className="font-serif text-2xl"
                              style={{ color: brandColor }}
                            >
                              ${sched.total.toFixed(2)}
                            </span>
                            <p className="text-[10px] font-mono text-zinc-500">
                              Source #{sched.sourceOrderNumber}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {sched.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200"
                            >
                              {item.quantity}× {item.name} ($
                              {item.itemTotal.toFixed(2)})
                            </span>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-zinc-500">
                            {sched.lastTriggeredAt
                              ? `Last dispatched: ${new Date(
                                  sched.lastTriggeredAt
                                ).toLocaleDateString()}`
                              : "Ready for upcoming scheduled window"}
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            {sched.status === "active" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduledStatus(
                                    sched.id,
                                    "paused"
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-amber-300 hover:bg-zinc-800"
                              >
                                <PauseCircle className="h-3.5 w-3.5" /> Pause
                              </button>
                            )}
                            {sched.status === "paused" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduledStatus(
                                    sched.id,
                                    "active"
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-emerald-300 hover:bg-zinc-800"
                              >
                                <PlayCircle className="h-3.5 w-3.5" /> Resume
                              </button>
                            )}
                            {sched.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduledStatus(
                                    sched.id,
                                    "cancelled"
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={authBusy}
                              onClick={() =>
                                handleTriggerScheduledNow(sched.id)
                              }
                              style={{
                                backgroundColor: brandColor,
                                color: "#000",
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow"
                            >
                              <Zap className="h-3.5 w-3.5" /> Dispatch Order Now
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CUSTOMER PROFILE, LOYALTY TIER & SAVED PREFERENCES */}
            {accountTab === "profile" && activeCustomer && (
              <form
                onSubmit={handleSaveCustomerProfile}
                className="space-y-6"
              >
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      Loyalty Balance
                    </span>
                    <p
                      className="font-serif text-3xl mt-1"
                      style={{ color: brandColor }}
                    >
                      {activeCustomer.loyaltyPoints} pts
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Redeemable for $
                      {(activeCustomer.loyaltyPoints * 0.05).toFixed(2)} dining
                      credit
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      Lifetime Orders
                    </span>
                    <p className="font-serif text-3xl text-white mt-1">
                      {activeCustomer.totalOrders}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Total Spent: ${activeCustomer.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      Membership Tier
                    </span>
                    <p className="font-serif text-2xl text-white mt-1">
                      {activeCustomer.vipStatus
                        ? "👑 Black Card VIP"
                        : "✨ Member"}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Priority kitchen prep & sommelier perks
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400">
                      Mobile Phone (SMS Alerts)
                    </label>
                    <input
                      type="text"
                      required
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase text-zinc-400">
                      Default Delivery Address
                    </label>
                    <input
                      type="text"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      placeholder="Suite, Street, City..."
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase text-zinc-400">
                      Saved Dietary Preferences & Kitchen Notes
                    </label>
                    <input
                      type="text"
                      value={profileNotes}
                      onChange={(e) => setProfileNotes(e.target.value)}
                      placeholder="e.g. Gluten-free crust, extra basil, buzzer #14B..."
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileSmsOptIn}
                      onChange={(e) => setProfileSmsOptIn(e.target.checked)}
                    />
                    <span>Receive automated SMS order status alerts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileEmailOptIn}
                      onChange={(e) => setProfileEmailOptIn(e.target.checked)}
                    />
                    <span>Receive VIP secret menu & promo email drops</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  style={{ backgroundColor: brandColor, color: "#000" }}
                  className="rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90"
                >
                  Save Customer Profile & Preferences
                </button>
              </form>
            )}

            {/* TAB 4: SIGN IN / REGISTER NEW CUSTOMER ACCOUNT */}
            {(accountTab === "auth" || !activeCustomer) && (
              <div className="grid md:grid-cols-2 gap-6 pt-2">
                <form
                  onSubmit={handleCustomerLoginOrRegister}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4"
                >
                  <div className="flex gap-2 rounded-xl bg-zinc-900 p-1">
                    <button
                      type="button"
                      onClick={() => setAuthFormMode("login")}
                      style={
                        authFormMode === "login"
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider ${
                        authFormMode === "login"
                          ? ""
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthFormMode("register")}
                      style={
                        authFormMode === "register"
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider ${
                        authFormMode === "register"
                          ? ""
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Create VIP Account
                    </button>
                  </div>

                  {authFormMode === "register" && (
                    <div>
                      <label className="block text-xs font-mono uppercase text-zinc-400">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Julian Sterling"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="sophia.vance@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400">
                      Password / VIP Passcode *
                    </label>
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>

                  {authFormMode === "register" && (
                    <>
                      <div>
                        <label className="block text-xs font-mono uppercase text-zinc-400">
                          SMS Mobile Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase text-zinc-400">
                          Default Delivery Address
                        </label>
                        <input
                          type="text"
                          value={authAddress}
                          onChange={(e) => setAuthAddress(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase text-zinc-400">
                          Dietary Notes / Allergies
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Gluten-free, no nuts..."
                          value={authNotes}
                          onChange={(e) => setAuthNotes(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={authBusy}
                    style={{ backgroundColor: brandColor, color: "#000" }}
                    className="w-full rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 shadow-lg"
                  >
                    {authFormMode === "register"
                      ? "Create Account (+50 Loyalty Pts)"
                      : `Sign In to ${restaurant.name}`}
                  </button>
                </form>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
                  <h4 className="font-serif text-xl text-white">
                    Member Benefits & Re-Order Concierge
                  </h4>
                  <ul className="space-y-3 text-xs text-zinc-300">
                    <li className="flex items-start gap-2.5">
                      <Zap
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{ color: brandColor }}
                      />
                      <span>
                        <strong>1-Click Instant Re-Order:</strong> Repeat any
                        past order with saved modifiers and delivery address in
                        seconds.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Repeat
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{ color: brandColor }}
                      />
                      <span>
                        <strong>Scheduled & Standing Orders:</strong> Set up
                        weekly Friday family dinners or recurring office lunches
                        with automatic kitchen dispatch.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Award
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{ color: brandColor }}
                      />
                      <span>
                        <strong>Loyalty Points & VIP Status:</strong> Earn 1
                        point per $1 spent plus automatic VIP tier upgrades and
                        exclusive promo codes.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: SCHEDULE RE-ORDER / RECURRING ORDER CONFIGURATOR             */}
      {/* ===================================================================== */}
      {scheduleModalSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
          <form
            onSubmit={handleCreateScheduledReorder}
            className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-zinc-800 bg-[#0f1117] p-5 sm:p-8 shadow-2xl space-y-5 my-4 sm:my-8 text-zinc-200 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: brandColor }}
                >
                  Automated Culinary Provisioning
                </span>
                <h3 className="font-serif text-xl sm:text-2xl text-white mt-0.5">
                  Schedule Future or Recurring Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalSource(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between font-semibold text-white">
                <span>
                  {scheduleModalSource.items.length} Selection(s) from #
                  {scheduleModalSource.sourceOrderNumber}
                </span>
                <span style={{ color: brandColor }}>
                  ${scheduleModalSource.total.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {scheduleModalSource.items
                  .map((i) => `${i.quantity}× ${i.name}`)
                  .join(" • ")}
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400">
                  Schedule Name / Occasion *
                </label>
                <input
                  type="text"
                  required
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="e.g. Friday Family Pizza Night"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400">
                    First Fulfillment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400">
                    Target Ready / Delivery Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Cadence / Re-Order Frequency
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: "once", label: "One-Time" },
                      { id: "weekly", label: "Weekly" },
                      { id: "biweekly", label: "Bi-Weekly" },
                      { id: "monthly", label: "Monthly" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSchedFrequency(f.id)}
                      style={
                        schedFrequency === f.id
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`rounded-xl border py-2 text-xs font-mono uppercase transition ${
                        schedFrequency === f.id
                          ? "font-bold border-transparent"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400">
                    Fulfillment Mode
                  </label>
                  <select
                    value={schedOrderType}
                    onChange={(e) =>
                      setSchedOrderType(e.target.value as OrderType)
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                    <option value="dine_in">Dine-In</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400">
                    Saved Payment Method
                  </label>
                  <select
                    value={schedPaymentMethod}
                    onChange={(e) =>
                      setSchedPaymentMethod(
                        e.target.value as "stripe" | "paypal"
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  >
                    <option value="stripe">Stripe Card (•••• 4242)</option>
                    <option value="paypal">PayPal Express</option>
                  </select>
                </div>
              </div>

              {schedOrderType === "delivery" && (
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400">
                    Delivery Address
                  </label>
                  <input
                    type="text"
                    required
                    value={schedAddress}
                    onChange={(e) => setSchedAddress(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400">
                  Special Kitchen Instructions
                </label>
                <input
                  type="text"
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  placeholder="Buzzer code, extra sauces..."
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authBusy}
              style={{ backgroundColor: brandColor, color: "#000" }}
              className="w-full rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest shadow-lg hover:opacity-90"
            >
              Confirm Scheduled Re-Order ({schedFrequency.toUpperCase()})
            </button>
          </form>
        </div>
      )}

      {/* MODAL 3: Item Variant & Side Option Selection (Dark AURA Theme) */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-zinc-800 bg-[#0f1117] p-5 sm:p-6 shadow-2xl space-y-5 text-zinc-200 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={customizingItem.imageUrl}
                  alt={customizingItem.name}
                  className="h-14 w-14 rounded-2xl object-cover border border-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest"
                    style={{ color: brandColor }}
                  >
                    Customize Variant & Side Options
                  </span>
                  <h3 className="font-serif text-xl text-white mt-0.5 truncate">
                    {customizingItem.name}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Base Price: ${customizingItem.price.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {customizingItem.modifiers.map((group) => {
                const isSide =
                  group.type === "side" ||
                  group.name.toLowerCase().includes("side");
                const isVariant =
                  group.type === "variant" || (!isSide && group.required);
                const isMulti =
                  group.multiSelect ||
                  isSide ||
                  group.type === "addon" ||
                  (!group.required && !isVariant);

                return (
                  <div
                    key={group.name}
                    className="rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-3.5 sm:p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-2">
                        <span>{group.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-mono uppercase ${
                            isVariant
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : isSide
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {isVariant
                            ? "Variant • Choose 1"
                            : isSide
                            ? "Side Options • Multi-Select"
                            : "Add-On • Optional"}
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {isMulti ? "Select any" : "Required *"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.options.map((opt) => {
                        if (isMulti) {
                          const currentArr =
                            selectedMultiMods[group.name] || [];
                          const isChecked = currentArr.some(
                            (x) => x.optionLabel === opt.label
                          );
                          return (
                            <label
                              key={opt.label}
                              style={
                                isChecked
                                  ? { borderColor: brandColor }
                                  : undefined
                              }
                              className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition ${
                                isChecked
                                  ? "bg-zinc-900 text-white font-semibold"
                                  : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const nextArr = isChecked
                                      ? currentArr.filter(
                                          (x) => x.optionLabel !== opt.label
                                        )
                                      : [
                                          ...currentArr,
                                          {
                                            optionLabel: opt.label,
                                            priceDelta: opt.priceDelta,
                                          },
                                        ];
                                    setSelectedMultiMods({
                                      ...selectedMultiMods,
                                      [group.name]: nextArr,
                                    });
                                  }}
                                  className="rounded border-zinc-700"
                                />
                                <span>{opt.label}</span>
                              </div>
                              <span
                                className="font-mono text-[11px]"
                                style={{
                                  color:
                                    opt.priceDelta > 0 ? brandColor : "#71717a",
                                }}
                              >
                                {opt.priceDelta > 0
                                  ? `+$${opt.priceDelta.toFixed(2)}`
                                  : "Included"}
                              </span>
                            </label>
                          );
                        }

                        const isSelected =
                          selectedMods[group.name]?.optionLabel === opt.label;
                        return (
                          <label
                            key={opt.label}
                            style={
                              isSelected
                                ? { borderColor: brandColor }
                                : undefined
                            }
                            className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition ${
                              isSelected
                                ? "bg-zinc-900 text-white font-semibold"
                                : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name={group.name}
                                checked={isSelected}
                                onChange={() =>
                                  setSelectedMods({
                                    ...selectedMods,
                                    [group.name]: {
                                      optionLabel: opt.label,
                                      priceDelta: opt.priceDelta,
                                    },
                                  })
                                }
                              />
                              <span>{opt.label}</span>
                            </div>
                            <span
                              className="font-mono text-[11px]"
                              style={{
                                color:
                                  opt.priceDelta > 0 ? brandColor : "#71717a",
                              }}
                            >
                              {opt.priceDelta > 0
                                ? `+$${opt.priceDelta.toFixed(2)}`
                                : "Included"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Special Kitchen Note & Quantity Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Dish Preparation Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={customizeItemNote}
                    onChange={(e) => setCustomizeItemNote(e.target.value)}
                    placeholder="e.g. Dressing on side, extra crispy..."
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Quantity
                  </label>
                  <div className="mt-1 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCustomizeQty((q) => Math.max(1, q - 1))
                      }
                      className="rounded-lg px-2 py-0.5 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs font-bold text-white">
                      {customizeQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomizeQty((q) => q + 1)}
                      className="rounded-lg px-2 py-0.5 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const singleList = Object.entries(selectedMods).map(
                ([groupName, val]) => ({
                  groupName,
                  optionLabel: val.optionLabel,
                  priceDelta: val.priceDelta,
                })
              );
              const multiList = Object.entries(selectedMultiMods).flatMap(
                ([groupName, arr]) =>
                  arr.map((val) => ({
                    groupName,
                    optionLabel: val.optionLabel,
                    priceDelta: val.priceDelta,
                  }))
              );
              const combinedMods = [...singleList, ...multiList];
              const modsDelta = combinedMods.reduce(
                (sum, m) => sum + m.priceDelta,
                0
              );
              const lineTotal =
                (customizingItem.price + modsDelta) * customizeQty;

              return (
                <button
                  onClick={() =>
                    addItemToCart(
                      customizingItem,
                      combinedMods,
                      customizeQty,
                      customizeItemNote
                    )
                  }
                  style={{ backgroundColor: brandColor, color: "#000" }}
                  className="w-full rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:opacity-95 transition"
                >
                  <span>
                    Add {customizeQty > 1 ? `${customizeQty}× ` : ""}Selection to
                    Order • ${lineTotal.toFixed(2)}
                  </span>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL 4: Per-Tenant Stripe & PayPal Checkout + Order Scheduling (Dark AURA Theme) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleCompletePayment}
            className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-zinc-800 bg-[#0f1117] p-5 sm:p-8 shadow-2xl space-y-5 my-4 sm:my-8 text-zinc-200 max-h-[92dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: brandColor }}
                >
                  Direct Merchant Settlement
                </span>
                <h3 className="font-serif text-xl sm:text-2xl text-white mt-0.5">
                  Finalize Order at {restaurant.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {checkoutError && (
              <div className="rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-xs font-medium text-rose-200">
                {checkoutError}
              </div>
            )}

            {/* Fulfillment Method & Timing Selector in Checkout Modal */}
            <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
              {/* Fulfillment Option Selector (Pickup / Delivery / Dine-In) */}
              <div className="space-y-1.5 border-b border-zinc-800/80 pb-3">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Fulfillment Option
                </label>
                <div
                  className={`grid gap-2 ${
                    [
                      restaurant.features.pickup,
                      restaurant.features.delivery,
                      restaurant.features.dineInQr,
                    ].filter(Boolean).length === 1
                      ? "grid-cols-1"
                      : [
                          restaurant.features.pickup,
                          restaurant.features.delivery,
                          restaurant.features.dineInQr,
                        ].filter(Boolean).length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3"
                  }`}
                >
                  {restaurant.features.pickup && (
                    <button
                      type="button"
                      onClick={() => setOrderType("pickup")}
                      style={
                        orderType === "pickup"
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`rounded-xl py-2 px-2 text-xs font-mono uppercase transition ${
                        orderType === "pickup"
                          ? "font-bold shadow"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      🛍️ Pickup
                    </button>
                  )}
                  {restaurant.features.delivery && (
                    <button
                      type="button"
                      onClick={() => setOrderType("delivery")}
                      style={
                        orderType === "delivery"
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`rounded-xl py-2 px-2 text-xs font-mono uppercase transition ${
                        orderType === "delivery"
                          ? "font-bold shadow"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      🛵 Delivery
                    </button>
                  )}
                  {restaurant.features.dineInQr && (
                    <button
                      type="button"
                      onClick={() => setOrderType("dine_in")}
                      style={
                        orderType === "dine_in"
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`rounded-xl py-2 px-2 text-xs font-mono uppercase transition ${
                        orderType === "dine_in"
                          ? "font-bold shadow"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      🍽️ Dine-In
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Fulfillment Timing
                </label>
                {requiresAdvanceNotice && (
                  <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                    Requires {advanceNoticeSummary} Notice
                  </span>
                )}
              </div>

              {requiresAdvanceNotice && (
                <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200 space-y-0.5">
                  <div>
                    ⏳ <strong>{restaurant.name}</strong> requires{" "}
                    <strong>{advanceNoticeSummary}</strong> advance notice (+
                    {restaurant.prepTimeMinutes}m prep) to get every order ready.
                  </div>
                  {restaurant.advanceNoticeNote && (
                    <div className="text-[10px] text-amber-300/90 italic">
                      &quot;{restaurant.advanceNoticeNote}&quot;
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutTiming("asap")}
                  style={
                    checkoutTiming === "asap"
                      ? { backgroundColor: brandColor, color: "#000" }
                      : undefined
                  }
                  className={`rounded-xl py-2 px-2 text-xs font-mono uppercase transition ${
                    checkoutTiming === "asap"
                      ? "font-bold"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  {requiresAdvanceNotice
                    ? `⏳ Earliest (${earliestReadyFormatted})`
                    : `🔥 Prepare Now (~${restaurant.prepTimeMinutes}m)`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutTiming("scheduled");
                    setCheckoutSchedDate(earliestReadyDateIso);
                    setCheckoutSchedTime(earliestReadyTimeStr);
                  }}
                  style={
                    checkoutTiming === "scheduled"
                      ? { backgroundColor: brandColor, color: "#000" }
                      : undefined
                  }
                  className={`rounded-xl py-2 px-2 text-xs font-mono uppercase transition ${
                    checkoutTiming === "scheduled"
                      ? "font-bold"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  📅 Choose Later Time
                </button>
              </div>

              {checkoutTiming === "scheduled" && (
                <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                  <div className="flex flex-wrap gap-1.5">
                    {quickAdvanceDates.map((qd) => {
                      const active = checkoutSchedDate === qd.dateIso;
                      return (
                        <button
                          key={qd.label}
                          type="button"
                          onClick={() => setCheckoutSchedDate(qd.dateIso)}
                          style={
                            active
                              ? {
                                  borderColor: brandColor,
                                  color: brandColor,
                                }
                              : undefined
                          }
                          className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] transition ${
                            active
                              ? "bg-zinc-900 font-bold"
                              : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {qd.label} ({qd.dateIso.slice(5)})
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-400">
                        Advance {orderType === "delivery" ? "Delivery" : "Pickup"} Date (Min: {earliestReadyDateIso})
                      </label>
                      <input
                        type="date"
                        required
                        min={earliestReadyDateIso}
                        value={checkoutSchedDate}
                        onChange={(e) => setCheckoutSchedDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-zinc-400">
                        {orderType === "delivery" ? "Delivery" : "Pickup"} Time
                      </label>
                      <input
                        type="time"
                        required
                        min={orderType === "pickup" ? dayPickupStart : undefined}
                        max={orderType === "pickup" ? dayPickupEnd : undefined}
                        value={checkoutSchedTime}
                        onChange={(e) => setCheckoutSchedTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {orderType === "pickup" && (
                    <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-400 uppercase">
                          🛍️ {selectedDayOfWeekName} Available Pickup Times:
                        </span>
                        <span
                          className={
                            isPickupAvailableOnSelectedDay
                              ? "font-bold text-amber-300"
                              : "font-bold text-rose-400"
                          }
                        >
                          {isPickupAvailableOnSelectedDay
                            ? `${dayPickupStart} – ${dayPickupEnd}`
                            : "Pickup Closed on this Day"}
                        </span>
                      </div>
                      {isPickupAvailableOnSelectedDay &&
                        availablePickupSlotsForSelectedDay.length > 0 && (
                          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5">
                            {availablePickupSlotsForSelectedDay.map((slot) => {
                              const activeSlot = checkoutSchedTime === slot;
                              const cap = getSlotCapacityInfo(slot);
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={cap.isFull}
                                  onClick={() => setCheckoutSchedTime(slot)}
                                  style={
                                    activeSlot && !cap.isFull
                                      ? {
                                          backgroundColor: brandColor,
                                          color: "#000",
                                        }
                                      : undefined
                                  }
                                  className={`shrink-0 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition ${
                                    cap.isFull
                                      ? "cursor-not-allowed border-rose-900/50 bg-rose-950/30 text-rose-400/60 line-through"
                                      : activeSlot
                                      ? "border-transparent font-bold shadow"
                                      : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"
                                  }`}
                                  title={
                                    cap.isFull
                                      ? `${slot} is FULL (${cap.bookedOrders}/${cap.maxOrders} orders booked)`
                                      : `${cap.remainingOrders} of ${cap.maxOrders} order spots left`
                                  }
                                >
                                  <span>{slot}</span>{" "}
                                  <span
                                    className={`text-[9px] ${
                                      cap.isFull
                                        ? "font-bold text-rose-400 no-underline"
                                        : activeSlot
                                        ? "opacity-80"
                                        : "text-emerald-400"
                                    }`}
                                  >
                                    {cap.isFull
                                      ? "(FULL)"
                                      : `(${cap.remainingOrders}/${cap.maxOrders})`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkoutSaveRecurring}
                        onChange={(e) =>
                          setCheckoutSaveRecurring(e.target.checked)
                        }
                      />
                      <span>Also save as recurring standing re-order</span>
                    </label>
                    {checkoutSaveRecurring && (
                      <select
                        value={checkoutRecurringFreq}
                        onChange={(e) =>
                          setCheckoutRecurringFreq(
                            e.target.value as ReorderFrequency
                          )
                        }
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-mono text-white"
                      >
                        <option value="weekly">Every Week</option>
                        <option value="biweekly">Every 2 Weeks</option>
                        <option value="monthly">Every Month</option>
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Guest Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  SMS Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              {orderType === "delivery" && (
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Residence / Suite Delivery Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  />
                  {doordashDriveActive && (
                    <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-200">
                      <span>
                        🚗 <strong>DoorDash Drive Partner Delivery:</strong>{" "}
                        Live GPS tracking link texted to your phone upon dispatch
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        0% Commission
                      </span>
                    </div>
                  )}
                </div>
              )}

              {orderType === "dine_in" && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Table / Suite Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Dietary & Sommelier Notes
                </label>
                <input
                  type="text"
                  placeholder="Allergies, plating instructions, gate code..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                Select Merchant Gateway ({restaurant.name})
              </label>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {restaurant.paymentConfig.stripe.enabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("stripe")}
                    style={
                      paymentMethod === "stripe"
                        ? { borderColor: brandColor }
                        : undefined
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      paymentMethod === "stripe"
                        ? "bg-zinc-900 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    <CreditCard
                      className="h-4 w-4"
                      style={{ color: brandColor }}
                    />
                    Stripe
                  </button>
                )}

                {restaurant.paymentConfig.paypal.enabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("paypal")}
                    style={
                      paymentMethod === "paypal"
                        ? { borderColor: brandColor }
                        : undefined
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      paymentMethod === "paypal"
                        ? "bg-zinc-900 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    <Globe className="h-4 w-4 text-sky-400" />
                    PayPal
                  </button>
                )}

                {squareCheckoutActive && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("square")}
                    style={
                      paymentMethod === "square"
                        ? { borderColor: brandColor }
                        : undefined
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      paymentMethod === "square"
                        ? "bg-zinc-900 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    <span>⬛</span>
                    Square
                  </button>
                )}

                {cloverCheckoutActive && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("clover")}
                    style={
                      paymentMethod === "clover"
                        ? { borderColor: brandColor }
                        : undefined
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                      paymentMethod === "clover"
                        ? "bg-zinc-900 text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    <span>🍀</span>
                    Clover
                  </button>
                )}
              </div>

              {paymentMethod === "stripe" ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-300 font-mono text-[11px]">
                    <span>
                      Connected Stripe:{" "}
                      {restaurant.paymentConfig.stripe.accountId}
                    </span>
                    <ShieldCheck
                      className="h-4 w-4"
                      style={{ color: brandColor }}
                    />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value="•••• •••• •••• 4242   |   EXP 12/28   |   CVC 888"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200"
                  />
                </div>
              ) : paymentMethod === "square" ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-1 text-xs text-zinc-300">
                  <p className="font-mono text-[11px] text-sky-300">
                    ⬛ Square POS Checkout • Location:{" "}
                    {restaurant.integrationsConfig?.square?.locationId ||
                      "L_MAIN_KITCHEN"}
                  </p>
                  <p className="text-zinc-500">
                    Synced with {restaurant.name}&apos;s Square Register &
                    Kitchen Display.
                  </p>
                </div>
              ) : paymentMethod === "clover" ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-1 text-xs text-zinc-300">
                  <p className="font-mono text-[11px] text-emerald-300">
                    🍀 Clover eCommerce Checkout • Merchant:{" "}
                    {restaurant.integrationsConfig?.clover?.merchantId ||
                      "CLV_MERCHANT"}
                  </p>
                  <p className="text-zinc-500">
                    Fires your order directly to {restaurant.name}&apos;s Clover
                    Kitchen Printer.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300 space-y-1">
                  <p className="font-mono text-[11px] text-sky-400">
                    PayPal Merchant:{" "}
                    {restaurant.paymentConfig.paypal.merchantEmail}
                  </p>
                  <p className="text-zinc-500">
                    Direct settlement to {restaurant.name}&apos;s verified
                    PayPal Business account.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submittingOrder}
              style={{ backgroundColor: brandColor, color: "#000" }}
              className="w-full rounded-xl py-4 text-xs font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 disabled:opacity-50"
            >
              {submittingOrder
                ? "Authorizing Settlement..."
                : checkoutTiming === "scheduled"
                  ? `Pay $${grandTotal.toFixed(2)} & Schedule for ${checkoutSchedDate}`
                  : `Authorize $${grandTotal.toFixed(2)} via ${paymentMethod.toUpperCase()}`}
            </button>
          </form>
        </div>
      )}

      {/* Tenant-Branded AI Chat & Voice Ordering Concierge */}
      <TenantAiChatbot
        restaurant={restaurant}
        menuItems={menuItems}
        cart={cart}
        orderType={orderType}
        brandColor={brandColor}
        onAddItemToCart={(item, modifiers, quantity) =>
          addItemToCart(item, modifiers, quantity)
        }
        onClearCart={() => setCart([])}
        onChangeOrderType={(newType) => setOrderType(newType)}
        onSelectSchedule={(timing, date, time) => {
          setCheckoutTiming(timing);
          if (date) setCheckoutSchedDate(date);
          if (time) setCheckoutSchedTime(time);
        }}
        onOpenCheckout={() => setShowCheckoutModal(true)}
      />
    </div>
  );
}
