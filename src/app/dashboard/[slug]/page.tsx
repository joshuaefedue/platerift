"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  ExternalLink,
  Globe,
  ImagePlus,
  Mail,
  Menu,
  MessageSquare,
  Package,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import {
  BlackoutWindow,
  Customer,
  EmailCampaign,
  MenuItem,
  MenuModifierGroup,
  Order,
  OrderingAvailabilityCheck,
  PlatformIntegrationsConfig,
  PlatformTwilioConfig,
  PortalTabId,
  RestaurantRole,
  RestaurantTenant,
  ROLE_DEFINITIONS,
  ScheduledReorder,
  SmsLog,
  UserAccount,
  UserRole,
} from "@/lib/types";
import { OwnerStorefrontPagesEditor } from "@/components/OwnerStorefrontPagesEditor";
import { OwnerInventoryManager } from "@/components/OwnerInventoryManager";
import { OwnerBeginnerGuideBar } from "@/components/OwnerBeginnerGuideBar";
import { OwnerIntegrationsHub } from "@/components/OwnerIntegrationsHub";
import { buildDefaultVariantAndSideGroups } from "@/lib/menuVariantsAndSides";

type ActiveTab = PortalTabId;

export default function RestaurantOwnerPortal() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "bella-napoli";

  const [restaurant, setRestaurant] = useState<RestaurantTenant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserAccount[]>([]);
  const [scheduledReorders, setScheduledReorders] = useState<
    ScheduledReorder[]
  >([]);
  const [platformTwilio, setPlatformTwilio] =
    useState<PlatformTwilioConfig | null>(null);
  const [platformIntegrations, setPlatformIntegrations] =
    useState<PlatformIntegrationsConfig | null>(null);
  const [loggedInStaff, setLoggedInStaff] = useState<UserAccount | null>(null);
  const [staffLoginInput, setStaffLoginInput] = useState("");
  const [simulatedRole, setSimulatedRole] =
    useState<RestaurantRole>("restaurant_owner");
  const [availability, setAvailability] =
    useState<OrderingAvailabilityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("orders");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    "ALL" | Order["status"]
  >("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  // Order Date Filter State
  const [orderDatePreset, setOrderDatePreset] = useState<
    | "all"
    | "today"
    | "yesterday"
    | "tomorrow"
    | "last7"
    | "last30"
    | "this_month"
    | "custom"
  >("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderDateBasis, setOrderDateBasis] = useState<"placed" | "scheduled">(
    "placed"
  );
  const [openActionDropdownId, setOpenActionDropdownId] = useState<
    string | null
  >(null);
  const [expandedSlotCapDay, setExpandedSlotCapDay] = useState<string | null>(
    null
  );

  // Menu Builder New Item Form
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Signature Mains");
  const [newItemPrice, setNewItemPrice] = useState("18.50");
  const [newItemPrepTime, setNewItemPrepTime] = useState("15");
  const [newItemStock, setNewItemStock] = useState("40");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImage, setNewItemImage] = useState(
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80"
  );
  const [newItemImageFileName, setNewItemImageFileName] = useState("");
  const [newItemTags, setNewItemTags] = useState("Popular, Chef Special");
  const [newItemModifiers, setNewItemModifiers] = useState<MenuModifierGroup[]>(
    () => buildDefaultVariantAndSideGroups("Signature Mains", slug)
  );
  const [menuFilterCategory, setMenuFilterCategory] = useState("ALL");
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editItemTagsInput, setEditItemTagsInput] = useState("");
  const [editItemImageFileName, setEditItemImageFileName] = useState("");

  // Schedule & Blackout Window Form
  const [bwTitle, setBwTitle] = useState("");
  const [bwDayOfWeek, setBwDayOfWeek] = useState("Friday");
  const [bwStartTime, setBwStartTime] = useState("17:00");
  const [bwEndTime, setBwEndTime] = useState("20:00");
  const [bwFullDay, setBwFullDay] = useState(false);
  const [bwReason, setBwReason] = useState(
    "Ordering temporarily turned off for a scheduled private event."
  );

  // Simulator state for testing time/day rules
  const [simDay, setSimDay] = useState("");
  const [simTime, setSimTime] = useState("");

  // Collapsible sections state for Fulfillment, Limits & Hours tab
  const [limitsSectionsOpen, setLimitsSectionsOpen] = useState<{
    fulfillment: boolean;
    advanceNotice: boolean;
    orderLimits: boolean;
    weeklySchedule: boolean;
    blackoutWindows: boolean;
  }>({
    fulfillment: true,
    advanceNotice: true,
    orderLimits: true,
    weeklySchedule: true,
    blackoutWindows: true,
  });

  const toggleLimitsSection = (
    key:
      | "fulfillment"
      | "advanceNotice"
      | "orderLimits"
      | "weeklySchedule"
      | "blackoutWindows"
  ) => {
    setLimitsSectionsOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Customer CRM Form
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [custSearch, setCustSearch] = useState("");

  // Manual/Broadcast SMS Form
  const [manualSmsPhone, setManualSmsPhone] = useState("+1 (312) 555-0821");
  const [manualSmsName, setManualSmsName] = useState("Sophia Vance");
  const [manualSmsBody, setManualSmsBody] = useState(
    "🔥 Flash tonight at {{restaurant_name}}: Show this text or order online for a free appetizer!"
  );
  const [broadcastSmsAll, setBroadcastSmsAll] = useState(false);

  // Email Campaign Form
  const [campName, setCampName] = useState("");
  const [campSubject, setCampSubject] = useState("");
  const [campSegment, setCampSegment] =
    useState<EmailCampaign["segment"]>("all");
  const [campPromoCode, setCampPromoCode] = useState("WEEKEND20");
  const [campDiscount, setCampDiscount] = useState(20);
  const [campBody, setCampBody] = useState(
    "<p>Treat yourself tonight! Order directly on our website and use code <strong>WEEKEND20</strong> for 20% off your entire order.</p>"
  );

  // Team & Role Management Form State
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("+1 (312) 555-0340");
  const [staffRole, setStaffRole] =
    useState<RestaurantRole>("general_manager");
  const [staffTitle, setStaffTitle] = useState("");
  const [staffPin, setStaffPin] = useState("5501");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  };

  const loadPortalData = useCallback(
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
          setRestaurant(data.restaurant);
          setMenuItems(data.menuItems || []);
          setOrders(data.orders || []);
          setCustomers(data.customers || []);
          setSmsLogs(data.smsLogs || []);
          setEmailCampaigns(data.emailCampaigns || []);
          setTeamMembers(data.teamMembers || []);
          setScheduledReorders(data.scheduledReorders || []);
          setPlatformTwilio(data.platformTwilio || null);
          setPlatformIntegrations(data.platformIntegrations || null);
          setAvailability(data.availability || null);
        }
      } catch (e) {
        console.error("Failed to load restaurant portal:", e);
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin text-orange-500" />
          Loading Restaurant Owner Portal...
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
        <h2 className="text-2xl font-bold">Restaurant Not Found</h2>
        <p className="mt-2 text-sm text-slate-400">
          Could not locate tenant &quot;{slug}&quot;.
        </p>
        <Link
          href="/admin"
          className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Return to Super Admin Console
        </Link>
      </div>
    );
  }

  // Handlers
  const saveRestaurantPatch = async (
    patch: Partial<RestaurantTenant>,
    successMsg: string
  ) => {
    const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(successMsg);
    }
  };

  const handleOrderStatusChange = async (
    orderId: string,
    nextStatus: Order["status"]
  ) => {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/orders`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      await loadPortalData(simDay || undefined, simTime || undefined);
      if (data.smsSent) {
        notify(
          `✅ Order updated to "${nextStatus.toUpperCase()}" & SMS sent to ${data.smsSent.customerPhone}!`
        );
      } else {
        notify(`✅ Order status updated to "${nextStatus.toUpperCase()}"`);
      }
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    const nextAvailable = !item.available;
    const defaultReason = nextAvailable
      ? ""
      : item.unavailableReason || "Temporarily sold out for today";

    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/menu`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          available: nextAvailable,
          unavailableReason: defaultReason,
        }),
      }
    );
    if (res.ok) {
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(
        nextAvailable
          ? `✅ "${item.name}" is now AVAILABLE on the menu!`
          : `🚫 "${item.name}" marked UNAVAILABLE (86'd) on the live storefront.`
      );
    }
  };

  const handleUpdateItemReason = async (item: MenuItem, reason: string) => {
    await fetch(`/api/restaurants/${encodeURIComponent(slug)}/menu`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        unavailableReason: reason,
      }),
    });
    await loadPortalData(simDay || undefined, simTime || undefined);
    notify(`Updated unavailable note for "${item.name}"`);
  };

  const handleNewItemPhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewItemImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setNewItemImage(reader.result);
        notify(`📸 Uploaded photo "${file.name}"`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExistingItemPhotoUpload = (
    item: MenuItem,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(slug)}/menu`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: item.id,
              imageUrl: reader.result,
            }),
          }
        );
        if (res.ok) {
          await loadPortalData(simDay || undefined, simTime || undefined);
          notify(`📸 Updated photo for "${item.name}"!`);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/menu`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemName,
          category: newItemCategory,
          price: parseFloat(newItemPrice),
          prepTimeMinutes: parseInt(newItemPrepTime, 10) || 15,
          dailyStockLimit: newItemStock ? parseInt(newItemStock, 10) : null,
          currentStockCount: newItemStock ? parseInt(newItemStock, 10) : null,
          description: newItemDesc,
          imageUrl: newItemImage,
          dietaryTags: newItemTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          modifiers: newItemModifiers,
          popular: true,
        }),
      }
    );
    if (res.ok) {
      const addedName = newItemName;
      setNewItemName("");
      setNewItemDesc("");
      setNewItemModifiers(
        buildDefaultVariantAndSideGroups(newItemCategory, slug)
      );
      setShowAddMenuModal(false);
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(
        `🍽️ Added "${addedName}" with Variant & Side Options to ${restaurant.name}'s menu!`
      );
    }
  };

  const handleDeleteMenuItem = async (itemId: string, itemName: string) => {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/menu?itemId=${encodeURIComponent(itemId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      if (editingMenuItem?.id === itemId) {
        setEditingMenuItem(null);
      }
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(`🗑️ Deleted "${itemName}" from menu.`);
    }
  };

  const handleStartEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem({ ...item });
    setEditItemTagsInput(item.dietaryTags.join(", "));
    setEditItemImageFileName("");
  };

  const handleEditItemPhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editingMenuItem) return;
    setEditItemImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditingMenuItem((prev) =>
          prev ? { ...prev, imageUrl: reader.result as string } : null
        );
        notify(`📸 Loaded new photo "${file.name}" for dish update`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenuItem || !editingMenuItem.name.trim()) return;
    const updatedTags = editItemTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/menu`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: editingMenuItem.id,
          name: editingMenuItem.name.trim(),
          category: editingMenuItem.category.trim(),
          price: Number(editingMenuItem.price) || 0,
          prepTimeMinutes: Number(editingMenuItem.prepTimeMinutes) || 15,
          dailyStockLimit:
            editingMenuItem.dailyStockLimit !== null &&
              editingMenuItem.dailyStockLimit !== undefined
              ? Number(editingMenuItem.dailyStockLimit)
              : null,
          currentStockCount:
            editingMenuItem.currentStockCount !== null &&
              editingMenuItem.currentStockCount !== undefined
              ? Number(editingMenuItem.currentStockCount)
              : null,
          description: editingMenuItem.description,
          imageUrl: editingMenuItem.imageUrl,
          dietaryTags: updatedTags,
          modifiers: editingMenuItem.modifiers,
          popular: editingMenuItem.popular,
          available: editingMenuItem.available,
          unavailableReason: editingMenuItem.unavailableReason,
        }),
      }
    );

    if (res.ok) {
      const savedName = editingMenuItem.name;
      setEditingMenuItem(null);
      setEditItemImageFileName("");
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(`✅ Updated "${savedName}" on ${restaurant.name}'s live menu!`);
    }
  };

  const handleAddBlackoutWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bwTitle) return;
    const newBw: BlackoutWindow = {
      id: `bw_${Date.now()}`,
      title: bwTitle,
      dayOfWeek: bwDayOfWeek,
      startTime: bwStartTime,
      endTime: bwEndTime,
      fullDay: bwFullDay,
      active: true,
      reasonMessage: bwReason,
    };
    const nextWindows = [...restaurant.blackoutWindows, newBw];
    await saveRestaurantPatch(
      { blackoutWindows: nextWindows },
      `⏰ Added blackout rule "${bwTitle}"`
    );
    setBwTitle("");
  };

  const handleToggleBlackoutWindow = async (bwId: string) => {
    const nextWindows = restaurant.blackoutWindows.map((w) =>
      w.id === bwId ? { ...w, active: !w.active } : w
    );
    await saveRestaurantPatch(
      { blackoutWindows: nextWindows },
      "Updated blackout window status"
    );
  };

  const handleRemoveBlackoutWindow = async (bwId: string) => {
    const nextWindows = restaurant.blackoutWindows.filter(
      (w) => w.id !== bwId
    );
    await saveRestaurantPatch(
      { blackoutWindows: nextWindows },
      "Removed blackout window"
    );
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustEmail) return;
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/customers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustName,
          email: newCustEmail,
          phone: newCustPhone || "+1 (555) 019-2834",
          notes: newCustNotes,
          vipStatus: true,
          tags: ["VIP", "Owner Added"],
        }),
      }
    );
    if (res.ok) {
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustNotes("");
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(`👤 Added customer "${newCustName}" to CRM!`);
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedMsg = manualSmsBody.replace(
      /\{\{restaurant_name\}\}/g,
      restaurant.name
    );
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/comms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_sms",
          broadcastToAll: broadcastSmsAll,
          customerName: manualSmsName,
          customerPhone: manualSmsPhone,
          message: formattedMsg,
        }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(
        broadcastSmsAll
          ? `📲 Broadcast SMS dispatched to ${data.sentCount} opted-in customers!`
          : `📲 Instant SMS sent to ${manualSmsPhone}!`
      );
    }
  };

  const handleSendEmailCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName || !campSubject) return;
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/comms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_email_campaign",
          name: campName,
          subject: campSubject,
          segment: campSegment,
          promoCode: campPromoCode,
          discountPercent: Number(campDiscount),
          bodyHtml: campBody,
        }),
      }
    );
    if (res.ok) {
      setCampName("");
      setCampSubject("");
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(`📧 Email campaign "${campName}" dispatched to ${campSegment.toUpperCase()} segment!`);
    }
  };

  const handleAddStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail) return;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "restaurant",
        restaurantId: restaurant.id,
        name: staffName,
        email: staffEmail,
        phone: staffPhone,
        role: staffRole,
        title: staffTitle || ROLE_DEFINITIONS[staffRole].label,
        pinCode: staffPin,
      }),
    });
    if (res.ok) {
      setStaffName("");
      setStaffEmail("");
      setStaffTitle("");
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(
        `👤 Added "${staffName}" as ${ROLE_DEFINITIONS[staffRole].label}!`
      );
    }
  };

  const handleUpdateStaffMember = async (
    userId: string,
    updates: Partial<UserAccount>
  ) => {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...updates }),
    });
    if (res.ok) {
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify("✅ Updated team member role & permissions!");
    }
  };

  const handleRemoveStaffMember = async (userId: string, name: string) => {
    const res = await fetch(
      `/api/users?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadPortalData(simDay || undefined, simTime || undefined);
      notify(`🗑️ Removed "${name}" from restaurant team.`);
    }
  };

  const handleRoleSwitch = (nextRole: RestaurantRole) => {
    setSimulatedRole(nextRole);
    const allowed = ROLE_DEFINITIONS[nextRole].allowedPortalTabs;
    if (!allowed.includes(activeTab) && allowed.length > 0) {
      setActiveTab(allowed[0]);
    }
    notify(`🔐 Switched active portal view to: ${ROLE_DEFINITIONS[nextRole].label}`);
  };

  const categories = Array.from(new Set(menuItems.map((m) => m.category)));
  const filteredMenu =
    menuFilterCategory === "ALL"
      ? menuItems
      : menuItems.filter((m) => m.category === menuFilterCategory);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(custSearch.toLowerCase()) ||
      c.phone.toLowerCase().includes(custSearch.toLowerCase())
  );

  // ---- Order Date Filter Helpers ----
  const toLocalDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const shiftDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };

  const getOrderDateKey = (ord: Order): string => {
    if (orderDateBasis === "scheduled") {
      const sched = ord.scheduledFor?.trim().slice(0, 10);
      if (sched && /^\d{4}-\d{2}-\d{2}$/.test(sched)) return sched;
    }
    const placed = new Date(ord.createdAt);
    return isNaN(placed.getTime()) ? "" : toLocalDateKey(placed);
  };

  const orderDateRange: { from: string; to: string } | null = (() => {
    const now = new Date();
    const today = toLocalDateKey(now);
    switch (orderDatePreset) {
      case "today":
        return { from: today, to: today };
      case "yesterday": {
        const y = toLocalDateKey(shiftDays(now, -1));
        return { from: y, to: y };
      }
      case "tomorrow": {
        const t = toLocalDateKey(shiftDays(now, 1));
        return { from: t, to: t };
      }
      case "last7":
        return { from: toLocalDateKey(shiftDays(now, -6)), to: today };
      case "last30":
        return { from: toLocalDateKey(shiftDays(now, -29)), to: today };
      case "this_month":
        return {
          from: toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
          to: toLocalDateKey(
            new Date(now.getFullYear(), now.getMonth() + 1, 0)
          ),
        };
      case "custom":
        if (!orderDateFrom && !orderDateTo) return null;
        return {
          from: orderDateFrom || "0000-01-01",
          to: orderDateTo || "9999-12-31",
        };
      default:
        return null;
    }
  })();

  const dateFilteredOrders = orderDateRange
    ? orders.filter((ord) => {
      const key = getOrderDateKey(ord);
      return (
        key !== "" && key >= orderDateRange.from && key <= orderDateRange.to
      );
    })
    : orders;

  const dateFilteredRevenue = dateFilteredOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total, 0);

  const navGroups = [
    {
      groupLabel: "Daily Kitchen & Food",
      items: [
        {
          id: "orders" as ActiveTab,
          label: "1. Customer Orders",
          badge: `${orders.length}`,
          icon: ShoppingBag,
        },
        {
          id: "menu" as ActiveTab,
          label: "2. Food Menu & Sold-Out",
          badge: `${menuItems.length}`,
          alertBadge:
            menuItems.filter((m) => !m.available).length > 0
              ? `${menuItems.filter((m) => !m.available).length} Sold Out`
              : undefined,
          icon: Utensils,
        },
        {
          id: "inventory" as ActiveTab,
          label: "3. Kitchen Stock & Profit",
          badge: `${restaurant.inventoryConfig?.items?.length || 8} Cards`,
          alertBadge:
            (restaurant.inventoryConfig?.items?.filter(
              (i) => i.currentStock <= i.reorderPoint
            ).length || 0) > 0
              ? `${
                  restaurant.inventoryConfig?.items?.filter(
                    (i) => i.currentStock <= i.reorderPoint
                  ).length
                } Low`
              : undefined,
          icon: Package,
        },
        {
          id: "limits" as ActiveTab,
          label: "4. Pickup, Delivery & Hours",
          badge: `${[
              restaurant.features.pickup,
              restaurant.features.delivery,
              restaurant.features.dineInQr,
            ].filter(Boolean).length
            } Active`,
          icon: CalendarClock,
        },
      ],
    },
    {
      groupLabel: "Customers & Promotions",
      items: [
        {
          id: "customers" as ActiveTab,
          label: "5. Customer List",
          badge: `${customers.length}`,
          icon: Users,
        },
        {
          id: "sms" as ActiveTab,
          label: "6. Phone Text Alerts (SMS)",
          badge: `${smsLogs.length}`,
          icon: MessageSquare,
        },
        {
          id: "email" as ActiveTab,
          label: "7. Promo Emails",
          badge: `${emailCampaigns.length}`,
          icon: Mail,
        },
      ],
    },
    {
      groupLabel: "Money, Website & Staff",
      items: [
        {
          id: "payments" as ActiveTab,
          label: "8. Receive Money (Cards)",
          badge:
            restaurant.paymentConfig.stripe.enabled &&
              restaurant.paymentConfig.paypal.enabled
              ? "2 Active"
              : "1 Active",
          icon: CreditCard,
        },
        {
          id: "integrations" as ActiveTab,
          label: "9. Plug & Play Apps (DoorDash, Square, Clover, Vapi)",
          badge: "4 Apps",
          icon: Sparkles,
        },
        {
          id: "domain" as ActiveTab,
          label: "10. Website, Logo & About Us",
          badge: "Live",
          icon: Globe,
        },
        {
          id: "team" as ActiveTab,
          label: "11. Kitchen & Cashier Staff",
          badge: `${teamMembers.length}`,
          icon: ShieldCheck,
        },
      ],
    },
  ];

  const allowedTabsForRole =
    ROLE_DEFINITIONS[simulatedRole]?.allowedPortalTabs ||
    ROLE_DEFINITIONS.restaurant_owner.allowedPortalTabs;

  const visibleNavGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => allowedTabsForRole.includes(item.id)),
    }))
    .filter((g) => g.items.length > 0);

  const activeNavItem = navGroups
    .flatMap((g) => g.items)
    .find((i) => i.id === activeTab);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-4 bottom-20 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 text-xs sm:inset-x-auto sm:bottom-6 sm:right-6 sm:px-5 sm:py-3.5 sm:text-sm font-medium text-emerald-300 shadow-2xl backdrop-blur-md">
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

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-slate-800/90 bg-slate-900/95 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Top Sidebar Brand & Tenant Info */}
        <div className="flex flex-col overflow-y-auto">
          <div className="border-b border-slate-800/90 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-orange-400" />
                Super Admin Console
              </Link>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-lg border border-white/15"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                {restaurant.logoEmoji}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-white">
                  {restaurant.name}
                </h1>
                <p className="truncate text-xs text-slate-400">
                  {restaurant.ownerName}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="truncate rounded bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-sky-400 border border-slate-800">
                    {restaurant.customDomain}
                  </span>
                </div>
              </div>
            </div>

            {/* Master Ordering ON/OFF Toggle inside Sidebar */}
            <button
              onClick={() =>
                saveRestaurantPatch(
                  {
                    orderingEnabled: !restaurant.orderingEnabled,
                    pauseReason: !restaurant.orderingEnabled
                      ? ""
                      : "Kitchen temporarily paused incoming online orders.",
                  },
                  !restaurant.orderingEnabled
                    ? "✅ Online ordering is now LIVE!"
                    : "⏸️ Online ordering PAUSED immediately."
                )
              }
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${restaurant.orderingEnabled
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                }`}
            >
              <span className="flex items-center gap-2">
                {restaurant.orderingEnabled ? (
                  <PlayCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <PauseCircle className="h-4 w-4 text-rose-400" />
                )}
                {restaurant.orderingEnabled
                  ? "Ordering: LIVE"
                  : "Ordering: PAUSED"}
              </span>
              <span className="rounded bg-slate-950/60 px-2 py-0.5 text-[10px]">
                {restaurant.orderingEnabled ? "Pause" : "Resume"}
              </span>
            </button>

            {/* Quick 1-Click Fulfillment Channel Toggles in Sidebar */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Fulfillment Options
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("limits")}
                  className="text-[10px] font-semibold text-orange-400 hover:underline"
                >
                  Configure →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    {
                      key: "pickup" as const,
                      label: "Pickup",
                      emoji: "🛍️",
                    },
                    {
                      key: "delivery" as const,
                      label: "Delivery",
                      emoji: "🛵",
                    },
                    {
                      key: "dineInQr" as const,
                      label: "Dine-In",
                      emoji: "🍽️",
                    },
                  ] as const
                ).map((ch) => {
                  const isOn = Boolean(restaurant.features[ch.key]);
                  return (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => {
                        const activeCount = [
                          restaurant.features.pickup,
                          restaurant.features.delivery,
                          restaurant.features.dineInQr,
                        ].filter(Boolean).length;
                        if (isOn && activeCount <= 1) {
                          notify(
                            "⚠️ At least one fulfillment option must remain enabled."
                          );
                          return;
                        }
                        const nextFeatures = {
                          ...restaurant.features,
                          [ch.key]: !isOn,
                        };
                        setRestaurant({
                          ...restaurant,
                          features: nextFeatures,
                        });
                        saveRestaurantPatch(
                          { features: nextFeatures },
                          `${ch.emoji} ${ch.label} fulfillment ${!isOn ? "ENABLED" : "DISABLED"
                          }!`
                        );
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-[10px] font-semibold transition ${isOn
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                          : "border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-300"
                        }`}
                      title={`Click to ${isOn ? "disable" : "enable"} ${ch.label}`}
                    >
                      <span>{ch.emoji}</span>
                      <span className="mt-0.5">{ch.label}</span>
                      <span className="font-mono text-[8px] uppercase">
                        {isOn ? "ON" : "OFF"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Staff Role Switcher & PIN Auth */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <span>
                  {loggedInStaff
                    ? `Signed In: ${loggedInStaff.name}`
                    : "Staff Role & PIN Login:"}
                </span>
                <ShieldCheck className="h-3.5 w-3.5 text-orange-400" />
              </div>
              <select
                value={simulatedRole}
                onChange={(e) =>
                  handleRoleSwitch(e.target.value as RestaurantRole)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="restaurant_owner">
                  👑 Restaurant Owner (All Tabs)
                </option>
                <option value="general_manager">
                  👔 General Manager (Ops & Staff)
                </option>
                <option value="kitchen_chef">
                  👨‍🍳 Head Chef (Orders & 86 Menu)
                </option>
                <option value="cashier_host">
                  🛎️ Cashier / Host (Orders & CRM)
                </option>
                <option value="marketing_manager">
                  📣 Marketing Lead (CRM, SMS, Email)
                </option>
              </select>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!staffLoginInput.trim()) return;
                  const res = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      actor: "staff",
                      emailOrPin: staffLoginInput.trim(),
                      restaurantId: restaurant.id,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok && data.user) {
                    setLoggedInStaff(data.user);
                    setStaffLoginInput("");
                    handleRoleSwitch(data.user.role as RestaurantRole);
                    notify(
                      `🔐 Authenticated as ${data.user.name} (${data.user.title})`
                    );
                  } else {
                    notify(data.error || "Invalid staff PIN or email");
                  }
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Staff PIN (e.g. 1101) or Email"
                  value={staffLoginInput}
                  onChange={(e) => setStaffLoginInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-mono text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase text-white hover:bg-orange-600 shrink-0"
                >
                  Auth
                </button>
              </form>
            </div>
          </div>

          {/* All Navigation Groups & Items (Filtered by Active Role) */}
          <nav className="p-4 space-y-6">
            {visibleNavGroups.map((group) => (
              <div key={group.groupLabel} className="space-y-1.5">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {group.groupLabel}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileSidebarOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${isActive
                            ? "bg-gradient-to-r from-orange-500/20 to-rose-500/10 text-orange-300 border border-orange-500/30 shadow-sm"
                            : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 border border-transparent"
                          }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-orange-400" : "text-slate-400"
                              }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>

                        <span className="flex items-center gap-1 shrink-0">
                          {item.alertBadge && (
                            <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                              {item.alertBadge}
                            </span>
                          )}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${isActive
                                ? "bg-orange-500/20 text-orange-200"
                                : "bg-slate-800 text-slate-400"
                              }`}
                          >
                            {item.badge}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer: Storefront & Custom Domain Shortcuts */}
        <div className="border-t border-slate-800/90 bg-slate-950/60 p-4 space-y-2.5">
          <Link
            href={`/store/${restaurant.slug}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-orange-600 hover:to-rose-700 transition"
          >
            <Store className="h-4 w-4" />
            Live Customer Storefront
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>

          <Link
            href={`/?domain=${encodeURIComponent(restaurant.customDomain)}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-sky-300 transition"
          >
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            Preview {restaurant.customDomain}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Bar for Active Section & Mobile Menu Button */}
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base sm:text-lg font-bold text-white">
                    {activeNavItem?.label || "Restaurant Portal"}
                  </h2>
                  <span className="truncate rounded-full bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-[11px] text-slate-400">
                    {restaurant.name}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">
                  Owner: {restaurant.ownerName} ({restaurant.ownerEmail}) •{" "}
                  {availability?.activeOrdersThisHour || 0}/
                  {restaurant.maxOrdersPerHour} orders this hour
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() =>
                  loadPortalData(simDay || undefined, simTime || undefined)
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2 sm:px-3 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">Refresh</span>
              </button>
              <Link
                href={`/store/${restaurant.slug}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-2.5 py-2 sm:px-3.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20"
              >
                <Store className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">View Storefront</span>
                <span className="sm:hidden">Store</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-8 lg:pb-8">
          {/* Beginner-Friendly Quick Action Cards & Step-by-Step Guide */}
          <OwnerBeginnerGuideBar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            restaurantName={restaurant.name}
            soldOutDishesCount={menuItems.filter((m) => !m.available).length}
            lowStockCount={
              restaurant.inventoryConfig?.items?.filter(
                (i) => i.currentStock <= i.reorderPoint
              ).length || 0
            }
            pendingOrdersCount={
              orders.filter(
                (o) => o.status !== "completed" && o.status !== "cancelled"
              ).length
            }
          />

          {/* Live Availability Status Strip */}
          {availability && (
            <div
              className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${availability.allowed
                  ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                  : "border-amber-500/40 bg-amber-950/30 text-amber-200"
                }`}
            >
              <div className="flex items-center gap-3">
                {availability.allowed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-bold">
                    {availability.title} ({availability.checkedDay}{" "}
                    {availability.checkedTime})
                  </p>
                  <p className="text-xs opacity-90">{availability.message}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("limits")}
                  className="rounded-lg bg-slate-900/80 px-3 py-1.5 border border-orange-500/40 text-orange-300 hover:bg-slate-900 transition"
                >
                  ⏳ Advance Notice:{" "}
                  <strong>
                    {restaurant.advanceNoticeDays > 0 ||
                      restaurant.advanceNoticeHours > 0
                      ? `${restaurant.advanceNoticeDays > 0
                        ? `${restaurant.advanceNoticeDays}d `
                        : ""
                      }${restaurant.advanceNoticeHours > 0
                        ? `${restaurant.advanceNoticeHours}h `
                        : ""
                      }(+${restaurant.prepTimeMinutes}m prep)`
                      : `Same-Day (~${restaurant.prepTimeMinutes}m prep)`}
                  </strong>
                </button>
                <div className="rounded-lg bg-slate-900/80 px-3 py-1.5 border border-slate-800">
                  Hourly Load:{" "}
                  <strong>
                    {availability.activeOrdersThisHour} /{" "}
                    {availability.maxOrdersPerHour}
                  </strong>
                </div>
                <div className="rounded-lg bg-slate-900/80 px-3 py-1.5 border border-slate-800">
                  Daily Load:{" "}
                  <strong>
                    {availability.ordersToday} / {availability.maxOrdersPerDay}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: LIVE ORDERS & KITCHEN QUEUE (LIST VIEW) */}
          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    🛍️ Incoming Customer Food Orders
                  </h2>
                  <p className="text-xs text-slate-300">
                    Click <strong>Actions</strong> on any order below to mark it{" "}
                    <strong>Confirmed → Preparing → Ready</strong>. We
                    automatically text the customer&apos;s phone at every step!
                  </p>
                </div>
                <Link
                  href={`/store/${restaurant.slug}`}
                  className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-500/20"
                >
                  + Place a Test Order on Your Website
                </Link>
              </div>

              {/* Unified Order Status Dropdown, Date Filter Dropdown & Search Bar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                  {/* 1. Order Status Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Order Status
                    </label>
                    <select
                      value={orderStatusFilter}
                      onChange={(e) =>
                        setOrderStatusFilter(
                          e.target.value as
                            | "ALL"
                            | "confirmed"
                            | "preparing"
                            | "ready"
                            | "completed"
                            | "cancelled"
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="ALL">
                        All Orders ({dateFilteredOrders.length})
                      </option>
                      <option value="confirmed">
                        ✅ Confirmed (
                        {
                          dateFilteredOrders.filter(
                            (o) => o.status === "confirmed"
                          ).length
                        }
                        )
                      </option>
                      <option value="preparing">
                        🔥 Preparing (
                        {
                          dateFilteredOrders.filter(
                            (o) => o.status === "preparing"
                          ).length
                        }
                        )
                      </option>
                      <option value="ready">
                        🛎️ Ready for Pickup / Driver (
                        {
                          dateFilteredOrders.filter((o) => o.status === "ready")
                            .length
                        }
                        )
                      </option>
                      <option value="completed">
                        🏁 Completed (
                        {
                          dateFilteredOrders.filter(
                            (o) => o.status === "completed"
                          ).length
                        }
                        )
                      </option>
                      <option value="cancelled">
                        ❌ Cancelled (
                        {
                          dateFilteredOrders.filter(
                            (o) => o.status === "cancelled"
                          ).length
                        }
                        )
                      </option>
                    </select>
                  </div>

                  {/* 2. Date Filter Preset Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Date Filter
                    </label>
                    <select
                      value={orderDatePreset}
                      onChange={(e) =>
                        setOrderDatePreset(
                          e.target.value as
                            | "all"
                            | "today"
                            | "yesterday"
                            | "tomorrow"
                            | "last7"
                            | "last30"
                            | "this_month"
                            | "custom"
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="all">📅 All Time</option>
                      <option value="today">📅 Today</option>
                      <option value="yesterday">📅 Yesterday</option>
                      <option value="tomorrow">📅 Tomorrow (Scheduled)</option>
                      <option value="last7">📅 Last 7 Days</option>
                      <option value="last30">📅 Last 30 Days</option>
                      <option value="this_month">📅 This Month</option>
                      <option value="custom">📅 Custom Date Range...</option>
                    </select>
                  </div>

                  {/* 3. Date Basis Dropdown (Order Placed vs Pickup/Scheduled) */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Date Type
                    </label>
                    <select
                      value={orderDateBasis}
                      onChange={(e) =>
                        setOrderDateBasis(
                          e.target.value as "placed" | "scheduled"
                        )
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="placed">When Order Was Placed</option>
                      <option value="scheduled">
                        Pickup / Scheduled Date
                      </option>
                    </select>
                  </div>

                  {/* 4. Search Input */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Search Orders
                    </label>
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Order #, customer, dish..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Custom Date Inputs (when Custom Range is selected or dates are set) & Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {orderDatePreset === "custom" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>From:</span>
                          <input
                            type="date"
                            value={orderDateFrom}
                            max={orderDateTo || undefined}
                            onChange={(e) => {
                              setOrderDateFrom(e.target.value);
                              setOrderDatePreset("custom");
                            }}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-white [color-scheme:dark] focus:border-orange-500 focus:outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>To:</span>
                          <input
                            type="date"
                            value={orderDateTo}
                            min={orderDateFrom || undefined}
                            onChange={(e) => {
                              setOrderDateTo(e.target.value);
                              setOrderDatePreset("custom");
                            }}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-white [color-scheme:dark] focus:border-orange-500 focus:outline-none"
                          />
                        </label>
                      </div>
                    )}

                    {(orderStatusFilter !== "ALL" ||
                      orderDatePreset !== "all" ||
                      orderDateFrom ||
                      orderDateTo ||
                      orderSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderStatusFilter("ALL");
                          setOrderDatePreset("all");
                          setOrderDateFrom("");
                          setOrderDateTo("");
                          setOrderSearch("");
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-rose-300"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono ml-auto">
                    <span className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-300">
                      {orderDateRange
                        ? orderDateRange.from === orderDateRange.to
                          ? orderDateRange.from
                          : `${
                              orderDateRange.from === "0000-01-01"
                                ? "Any"
                                : orderDateRange.from
                            } → ${
                              orderDateRange.to === "9999-12-31"
                                ? "Any"
                                : orderDateRange.to
                            }`
                        : "All dates"}
                    </span>
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
                      {dateFilteredOrders.length} orders • $
                      {dateFilteredRevenue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
                  <ShoppingBag className="mx-auto h-10 w-10 text-slate-600" />
                  <p className="mt-3 text-sm font-semibold text-slate-300">
                    No orders yet for {restaurant.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open the Live Customer Storefront to place a test Stripe or
                    PayPal order.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-lg">
                  {/* Desktop List Column Header */}
                  <div className="hidden lg:grid lg:grid-cols-12 gap-4 rounded-t-2xl border-b border-slate-800 bg-slate-950/80 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-2">Order & Time</div>
                    <div className="col-span-2">Customer</div>
                    <div className="col-span-4">Items & Special Notes</div>
                    <div className="col-span-2">Total & Payment</div>
                    <div className="col-span-2 text-right">
                      Status & Actions
                    </div>
                  </div>

                  {/* Order List Rows */}
                  <div className="divide-y divide-slate-800/80">
                    {dateFilteredOrders.length === 0 && (
                      <div className="p-10 text-center">
                        <CalendarClock className="mx-auto h-8 w-8 text-slate-600" />
                        <p className="mt-2 text-sm font-semibold text-slate-300">
                          No orders in this date range
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Try a different preset or clear the date filter.
                        </p>
                      </div>
                    )}
                    {dateFilteredOrders
                      .filter((ord) =>
                        orderStatusFilter === "ALL"
                          ? true
                          : ord.status === orderStatusFilter
                      )
                      .filter((ord) => {
                        if (!orderSearch.trim()) return true;
                        const q = orderSearch.toLowerCase();
                        return (
                          ord.orderNumber.toLowerCase().includes(q) ||
                          ord.customerName.toLowerCase().includes(q) ||
                          ord.customerPhone.toLowerCase().includes(q) ||
                          ord.customerEmail.toLowerCase().includes(q) ||
                          ord.items.some((i) => i.name.toLowerCase().includes(q))
                        );
                      })
                      .map((ord) => (
                        <div
                          key={ord.id}
                          className="grid grid-cols-1 gap-4 p-4 transition hover:bg-slate-950/40 lg:grid-cols-12 lg:items-center lg:px-5 lg:py-4"
                        >
                          {/* Col 1: Order #, Fulfillment Type & Timestamp */}
                          <div className="lg:col-span-2 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-orange-500/20 px-2.5 py-1 font-mono text-xs font-bold text-orange-300 border border-orange-500/30">
                                #{ord.orderNumber}
                              </span>
                              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                                {ord.orderType.replace("_", " ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Clock className="h-3 w-3 text-slate-500" />
                              <span>
                                {new Date(ord.createdAt).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                •{" "}
                                {new Date(ord.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {ord.scheduledFor && (
                              <span className="inline-block rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                                📅 {ord.scheduledFor}
                              </span>
                            )}
                          </div>

                          {/* Col 2: Customer Details & Address */}
                          <div className="lg:col-span-2 space-y-0.5 min-w-0">
                            <div className="truncate text-xs font-bold text-white">
                              {ord.customerName}
                            </div>
                            <div className="truncate font-mono text-[11px] text-slate-400">
                              {ord.customerPhone}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              {ord.customerEmail}
                            </div>
                            {ord.deliveryAddress && (
                              <div
                                className="truncate text-[11px] text-sky-300 pt-0.5"
                                title={ord.deliveryAddress}
                              >
                                📍 {ord.deliveryAddress}
                              </div>
                            )}
                          </div>

                          {/* Col 3: Order Line Items & Notes */}
                          <div className="lg:col-span-4 space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                            <div className="space-y-1">
                              {ord.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="font-semibold text-white">
                                      {item.quantity}× {item.name}
                                    </span>
                                    {item.selectedModifiers?.length > 0 && (
                                      <span className="ml-1.5 text-[11px] text-slate-400">
                                        (
                                        {item.selectedModifiers
                                          .map((m) => m.optionLabel)
                                          .join(", ")}
                                        )
                                      </span>
                                    )}
                                  </div>
                                  <span className="shrink-0 font-mono text-[11px] text-slate-300">
                                    ${item.itemTotal.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {ord.specialInstructions && (
                              <p className="border-t border-slate-800/80 pt-1.5 text-[11px] italic text-amber-300">
                                Note: &quot;{ord.specialInstructions}&quot;
                              </p>
                            )}
                          </div>

                          {/* Col 4: Total, Payment Method & Reference */}
                          <div className="lg:col-span-2 space-y-1">
                            <div className="text-base font-bold text-white">
                              ${ord.total.toFixed(2)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono uppercase text-indigo-300 border border-indigo-500/30">
                                {ord.paymentMethod} • {ord.paymentStatus}
                              </span>
                            </div>
                            <div className="truncate font-mono text-[10px] text-slate-500">
                              Ref: {ord.paymentReference}
                            </div>

                            {/* POS / Voice AI Channel & DoorDash Driver Badges */}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {ord.posSync?.sourceChannel === "vapi_voice_call" && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                  📞 Vapi AI Phone Order
                                </span>
                              )}
                              {ord.posSync?.squareOrderId && (
                                <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 border border-sky-500/40 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                                  ⬛ Square POS
                                </span>
                              )}
                              {ord.posSync?.cloverOrderId && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                                  🍀 Clover KDS
                                </span>
                              )}
                            </div>

                            {/* DoorDash Driver Live Status & 1-Click Dispatch on Delivery Orders */}
                            {(ord.orderType === "delivery" ||
                              ord.deliveryTracking) && (
                              <div className="mt-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 p-2 space-y-1">
                                {ord.deliveryTracking ? (
                                  <>
                                    <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-rose-300">
                                      <span>
                                        🚗 DoorDash:{" "}
                                        {ord.deliveryTracking.status.replace(
                                          /_/g,
                                          " "
                                        )}
                                      </span>
                                      <a
                                        href={ord.deliveryTracking.trackingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline text-rose-200 hover:text-white"
                                      >
                                        Track
                                      </a>
                                    </div>
                                    <div className="text-[10px] text-slate-300">
                                      Driver: {ord.deliveryTracking.dasherName} •
                                      ETA {ord.deliveryTracking.dropoffEtaMinutes}m
                                    </div>
                                    {ord.deliveryTracking.status !== "delivered" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const res = await fetch(
                                            `/api/restaurants/${encodeURIComponent(
                                              restaurant.slug
                                            )}/integrations`,
                                            {
                                              method: "POST",
                                              headers: {
                                                "Content-Type": "application/json",
                                              },
                                              body: JSON.stringify({
                                                action: "advance_doordash_status",
                                                orderId: ord.id,
                                              }),
                                            }
                                          );
                                          const data = await res.json();
                                          if (res.ok && Array.isArray(data.orders)) {
                                            setOrders(data.orders);
                                            notify(
                                              `🚗 Updated DoorDash Driver status for Order #${ord.orderNumber}`
                                            );
                                          }
                                        }}
                                        className="w-full rounded bg-rose-500/25 border border-rose-500/40 px-2 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-500/35"
                                      >
                                        🚗 Advance Driver Status →
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await fetch(
                                        `/api/restaurants/${encodeURIComponent(
                                          restaurant.slug
                                        )}/integrations`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            action: "dispatch_doordash",
                                            orderId: ord.id,
                                          }),
                                        }
                                      );
                                      const data = await res.json();
                                      if (res.ok && Array.isArray(data.orders)) {
                                        setOrders(data.orders);
                                        notify(
                                          `🚗 DoorDash Driver dispatched for Order #${ord.orderNumber}!`
                                        );
                                      }
                                    }}
                                    className="w-full rounded bg-rose-500/20 border border-rose-500/40 px-2 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-500/30"
                                  >
                                    🚗 Call DoorDash Driver
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Col 5: Status Badge & Order Action Dropdown */}
                          <div className="lg:col-span-2 flex items-center justify-between sm:justify-start lg:justify-end gap-2 pt-2 lg:pt-0 border-t border-slate-800/60 lg:border-t-0">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${ord.status === "confirmed"
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  : ord.status === "preparing"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : ord.status === "ready"
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : ord.status === "completed"
                                        ? "bg-slate-800 text-slate-300 border border-slate-700"
                                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}
                            >
                              {ord.status}
                            </span>

                            {/* Order Action Dropdown Button */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionDropdownId(
                                    openActionDropdownId === ord.id
                                      ? null
                                      : ord.id
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:border-orange-500/50 hover:bg-slate-800 transition shadow-sm"
                              >
                                <span>Actions</span>
                                <ChevronDown
                                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${openActionDropdownId === ord.id
                                      ? "rotate-180 text-orange-400"
                                      : ""
                                    }`}
                                />
                              </button>

                              {openActionDropdownId === ord.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setOpenActionDropdownId(null)}
                                  />
                                  <div className="absolute right-0 sm:left-0 lg:left-auto lg:right-0 z-40 mt-2 w-56 origin-top-right rounded-xl border border-slate-700/90 bg-slate-900 p-1.5 shadow-2xl ring-1 ring-black/50">
                                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                                      Order #{ord.orderNumber} Actions
                                    </div>

                                    {(
                                      [
                                        {
                                          status: "confirmed" as const,
                                          label: "✅ Mark Confirmed",
                                          sub: "Sends confirmation SMS",
                                          tone: "text-sky-300 hover:bg-sky-500/15",
                                        },
                                        {
                                          status: "preparing" as const,
                                          label: "🔥 Start Preparing",
                                          sub: "Sends kitchen prep SMS",
                                          tone: "text-amber-300 hover:bg-amber-500/15",
                                        },
                                        {
                                          status: "ready" as const,
                                          label: "🛎️ Mark Ready",
                                          sub: "Sends ready-for-pickup SMS",
                                          tone: "text-emerald-300 hover:bg-emerald-500/15",
                                        },
                                        {
                                          status: "completed" as const,
                                          label: "🏁 Complete Order",
                                          sub: "Finalize & archive order",
                                          tone: "text-slate-200 hover:bg-slate-800",
                                        },
                                        {
                                          status: "cancelled" as const,
                                          label: "❌ Cancel & Refund",
                                          sub: "Sends cancellation SMS",
                                          tone: "text-rose-300 hover:bg-rose-500/15",
                                        },
                                      ]
                                    ).map((act) => {
                                      const isCurrent =
                                        ord.status === act.status;
                                      return (
                                        <button
                                          key={act.status}
                                          type="button"
                                          disabled={isCurrent}
                                          onClick={() => {
                                            setOpenActionDropdownId(null);
                                            handleOrderStatusChange(
                                              ord.id,
                                              act.status
                                            );
                                          }}
                                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${isCurrent
                                              ? "bg-slate-800/60 text-slate-500 cursor-default"
                                              : act.tone
                                            }`}
                                        >
                                          <div>
                                            <div className="font-semibold">
                                              {act.label}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                              {act.sub}
                                            </div>
                                          </div>
                                          {isCurrent && (
                                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-400">
                                              Current
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Customer Scheduled & Standing Recurring Re-Orders List */}
              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-orange-400" />
                      Customer Scheduled & Standing Recurring Re-Orders (
                      {scheduledReorders.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Upcoming scheduled orders & standing weekly/bi-weekly
                      re-orders created by customers from their storefront
                      account.
                    </p>
                  </div>
                </div>

                {scheduledReorders.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No scheduled re-orders configured yet for {restaurant.name}.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
                    {scheduledReorders.map((sched) => (
                      <div
                        key={sched.id}
                        className="flex flex-col gap-3 p-4 transition hover:bg-slate-900/60 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {sched.title}
                            </span>
                            <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-orange-300">
                              ↻ {sched.frequency} • {sched.status}
                            </span>
                            <span className="font-mono text-xs text-amber-300">
                              📅 {sched.scheduledDate} at {sched.scheduledTime} (
                              {sched.orderType.toUpperCase()})
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">
                            <strong>{sched.customerName}</strong> (
                            {sched.customerEmail}) • {sched.customerPhone}
                          </p>
                          <p className="text-xs text-slate-400">
                            {sched.items
                              .map((i) => `${i.quantity}× ${i.name}`)
                              .join(" • ")}{" "}
                            —{" "}
                            <strong className="text-white">
                              ${sched.total.toFixed(2)}
                            </strong>{" "}
                            <span className="ml-2 font-mono text-[11px] text-slate-500">
                              (Source #{sched.sourceOrderNumber})
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={async () => {
                              const res = await fetch(
                                `/api/restaurants/${encodeURIComponent(
                                  restaurant.slug
                                )}/customer-account`,
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "trigger_scheduled",
                                    scheduledId: sched.id,
                                  }),
                                }
                              );
                              if (res.ok) {
                                await loadPortalData(
                                  simDay || undefined,
                                  simTime || undefined
                                );
                                notify(
                                  `🚀 Dispatched scheduled order "${sched.title}" into Live Kitchen Queue & sent SMS!`
                                );
                              }
                            }}
                            className="rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition"
                          >
                            🚀 Dispatch to Kitchen Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MENU BUILDER & MARK ITEMS UNAVAILABLE */}
          {activeTab === "menu" && (
            <div className="space-y-6">
              {/* Top Action Bar: Category Filters + Add Menu Modal Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setMenuFilterCategory("ALL")}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      menuFilterCategory === "ALL"
                        ? "bg-orange-500 text-white shadow"
                        : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                    }`}
                  >
                    All Categories ({menuItems.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMenuFilterCategory(cat)}
                      className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        menuFilterCategory === cat
                          ? "bg-orange-500 text-white shadow"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                      }`}
                    >
                      {cat} (
                      {menuItems.filter((m) => m.category === cat).length})
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition"
                >
                  <Plus className="h-4 w-4" /> + Add Menu
                </button>
              </div>

              {/* Menu Items Grid: 3 Cards Per Row */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMenu.map((item) => {
                  const isEditingThis = editingMenuItem?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                        isEditingThis
                          ? "border-orange-500/60 bg-slate-900 shadow-xl ring-1 ring-orange-500/30"
                          : item.available
                          ? "border-slate-800 bg-slate-900/90 hover:border-slate-700"
                          : "border-rose-500/40 bg-rose-950/15"
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Card Top: Photo + Title + Price */}
                        <div className="flex items-start gap-3.5">
                          <label className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-800">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className={`h-full w-full object-cover transition group-hover:scale-105 ${
                                !item.available ? "grayscale opacity-50" : ""
                              }`}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 opacity-0 transition group-hover:opacity-100">
                              <ImagePlus className="h-4 w-4 text-orange-400" />
                              <span className="mt-0.5 text-[9px] font-semibold text-white">
                                Upload
                              </span>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleExistingItemPhotoUpload(item, e)
                              }
                              className="hidden"
                            />
                          </label>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                                {item.category}
                              </span>
                              <span className="font-mono text-sm font-black text-emerald-400">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>

                            <h4 className="font-bold text-white text-sm leading-snug">
                              {item.name}
                            </h4>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.popular && (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                                  ★ Popular
                                </span>
                              )}
                              {!item.available ? (
                                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/40">
                                  86&apos;d / SOLD OUT
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                                  Available
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {item.description}
                        </p>

                        {/* Meta: Prep Time, Stock, Dietary Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-slate-400">
                            ⏱ {item.prepTimeMinutes}m prep
                          </span>
                          {item.currentStockCount !== null && (
                            <span className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-slate-300">
                              Stock:{" "}
                              <strong className="text-white">
                                {item.currentStockCount}
                              </strong>
                              {item.dailyStockLimit
                                ? `/${item.dailyStockLimit}`
                                : ""}
                            </span>
                          )}
                          {item.dietaryTags.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>

                        {/* Active Variant & Side Option Summary Pills */}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="space-y-1 border-t border-slate-800/70 pt-2">
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
                                  className="flex flex-wrap items-center gap-1 text-[10px]"
                                >
                                  <span
                                    className={`rounded px-1.5 py-0.5 font-mono font-bold uppercase ${
                                      isVariant
                                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                        : isSide
                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                    }`}
                                  >
                                    {grp.name}:
                                  </span>
                                  {grp.options.slice(0, 3).map((opt) => (
                                    <span
                                      key={opt.label}
                                      className="rounded bg-slate-950 border border-slate-800 px-1.5 py-0.5 text-slate-300"
                                    >
                                      {opt.label}
                                      {opt.priceDelta > 0 && (
                                        <span className="ml-0.5 font-mono text-emerald-400">
                                          +${opt.priceDelta.toFixed(2)}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                  {grp.options.length > 3 && (
                                    <span className="text-slate-500">
                                      +{grp.options.length - 3} more
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Sold-Out Note Input when Unavailable */}
                        {!item.available && (
                          <div className="pt-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.unavailableReason}
                              onChange={(e) =>
                                setMenuItems((prev) =>
                                  prev.map((m) =>
                                    m.id === item.id
                                      ? {
                                          ...m,
                                          unavailableReason: e.target.value,
                                        }
                                      : m
                                  )
                                )
                              }
                              placeholder="Sold-out reason..."
                              className="min-w-0 flex-1 rounded-lg border border-rose-500/40 bg-slate-950 px-2.5 py-1 text-xs text-rose-200"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateItemReason(
                                  item,
                                  item.unavailableReason
                                )
                              }
                              className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Action Buttons */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditMenuItem(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-orange-500/50 hover:text-white transition"
                          >
                            <Pencil className="h-3.5 w-3.5 text-orange-400" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteMenuItem(item.id, item.name)
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                            title="Delete dish"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleItemAvailability(item)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                            item.available
                              ? "border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                              : "bg-emerald-600 text-white hover:bg-emerald-500"
                          }`}
                        >
                          {item.available ? (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Mark Sold Out
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Available
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* =========================================================
                  MODAL 1: ADD NEW MENU ITEM POPUP MODAL
                 ========================================================= */}
              {showAddMenuModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
                  <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 my-6 max-h-[90dvh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                          {restaurant.name} • Menu Builder
                        </span>
                        <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                          <Plus className="h-4 w-4 text-orange-400" /> Add New
                          Dish to Menu
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddMenuModal(false)}
                        className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateMenuItem} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Dish Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Party Jollof Rice & Grilled Chicken"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Category *
                          </label>
                          <input
                            type="text"
                            required
                            value={newItemCategory}
                            onChange={(e) => setNewItemCategory(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Price ($) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Prep Time (mins)
                          </label>
                          <input
                            type="number"
                            value={newItemPrepTime}
                            onChange={(e) => setNewItemPrepTime(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Daily Stock Limit
                          </label>
                          <input
                            type="number"
                            value={newItemStock}
                            onChange={(e) => setNewItemStock(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ingredients, preparation notes..."
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Dietary / Highlight Tags (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={newItemTags}
                            onChange={(e) => setNewItemTags(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Dish Photo
                          </label>
                          <div className="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-2">
                            <img
                              src={newItemImage}
                              alt="Dish preview"
                              className="h-10 w-10 rounded-lg object-cover border border-slate-800 shrink-0"
                            />
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition">
                              <Upload className="h-3.5 w-3.5 text-orange-400" />
                              <span>
                                {newItemImageFileName
                                  ? "Change Photo"
                                  : "Upload Dish Photo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleNewItemPhotoUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Variant Options & Side Options for New Dish */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                            Variant & Side Options ({newItemModifiers.length}{" "}
                            Groups)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setNewItemModifiers(
                                buildDefaultVariantAndSideGroups(
                                  newItemCategory,
                                  slug
                                )
                              )
                            }
                            className="text-[10px] font-semibold text-slate-400 hover:text-white underline"
                          >
                            Reset Presets
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {newItemModifiers.map((grp, gIdx) => {
                            const isSide =
                              grp.type === "side" ||
                              grp.name.toLowerCase().includes("side");
                            return (
                              <div
                                key={gIdx}
                                className="rounded-lg border border-slate-800 bg-slate-900 p-2.5 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    type="text"
                                    value={grp.name}
                                    onChange={(e) => {
                                      const next = [...newItemModifiers];
                                      next[gIdx] = {
                                        ...grp,
                                        name: e.target.value,
                                      };
                                      setNewItemModifiers(next);
                                    }}
                                    className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-white"
                                  />
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                                      isSide
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : "bg-amber-500/15 text-amber-300"
                                    }`}
                                  >
                                    {isSide ? "Side Option" : "Variant"}
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {grp.options.map((opt, oIdx) => (
                                    <div
                                      key={oIdx}
                                      className="flex items-center gap-1.5"
                                    >
                                      <input
                                        type="text"
                                        value={opt.label}
                                        onChange={(e) => {
                                          const next = [...newItemModifiers];
                                          const nextOpts = [...grp.options];
                                          nextOpts[oIdx] = {
                                            ...opt,
                                            label: e.target.value,
                                          };
                                          next[gIdx] = {
                                            ...grp,
                                            options: nextOpts,
                                          };
                                          setNewItemModifiers(next);
                                        }}
                                        placeholder="Option name"
                                        className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                                      />
                                      <input
                                        type="number"
                                        step="0.25"
                                        value={opt.priceDelta}
                                        onChange={(e) => {
                                          const next = [...newItemModifiers];
                                          const nextOpts = [...grp.options];
                                          nextOpts[oIdx] = {
                                            ...opt,
                                            priceDelta:
                                              parseFloat(e.target.value) || 0,
                                          };
                                          next[gIdx] = {
                                            ...grp,
                                            options: nextOpts,
                                          };
                                          setNewItemModifiers(next);
                                        }}
                                        className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] font-mono text-emerald-300"
                                        title="Price Delta (+$)"
                                      />
                                      {grp.options.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = [...newItemModifiers];
                                            next[gIdx] = {
                                              ...grp,
                                              options: grp.options.filter(
                                                (_, i) => i !== oIdx
                                              ),
                                            };
                                            setNewItemModifiers(next);
                                          }}
                                          className="text-slate-500 hover:text-rose-400 p-0.5"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...newItemModifiers];
                                      next[gIdx] = {
                                        ...grp,
                                        options: [
                                          ...grp.options,
                                          {
                                            label: isSide
                                              ? "New Side Option"
                                              : "New Variant Option",
                                            priceDelta: isSide ? 4.5 : 3.0,
                                          },
                                        ],
                                      };
                                      setNewItemModifiers(next);
                                    }}
                                    className="text-[11px] font-semibold text-orange-400 hover:text-orange-300"
                                  >
                                    + Add {isSide ? "Side" : "Variant"} Choice
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowAddMenuModal(false)}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-lg shadow-orange-500/20"
                        >
                          + Add Item to Live Menu
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* =========================================================
                  MODAL 2: EDIT / UPDATE EXISTING MENU ITEM POPUP MODAL
                 ========================================================= */}
              {editingMenuItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
                  <div className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 my-6 max-h-[90dvh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                          <Pencil className="h-3 w-3" /> Editing Menu Item
                        </span>
                        <h3 className="text-lg font-black text-white mt-0.5">
                          {editingMenuItem.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingMenuItem(null)}
                        className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form
                      onSubmit={handleSaveEditMenuItem}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Dish Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingMenuItem.name}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                name: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Category *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingMenuItem.category}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                category: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Price ($) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={editingMenuItem.price}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                price: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Prep Time (mins)
                          </label>
                          <input
                            type="number"
                            value={editingMenuItem.prepTimeMinutes}
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                prepTimeMinutes:
                                  parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Current Stock Remaining
                          </label>
                          <input
                            type="number"
                            value={editingMenuItem.currentStockCount ?? ""}
                            placeholder="Unlimited"
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                currentStockCount: e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Daily Stock Limit
                          </label>
                          <input
                            type="number"
                            value={editingMenuItem.dailyStockLimit ?? ""}
                            placeholder="Unlimited"
                            onChange={(e) =>
                              setEditingMenuItem({
                                ...editingMenuItem,
                                dailyStockLimit: e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={editingMenuItem.description}
                          onChange={(e) =>
                            setEditingMenuItem({
                              ...editingMenuItem,
                              description: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Dietary / Highlight Tags (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={editItemTagsInput}
                            onChange={(e) =>
                              setEditItemTagsInput(e.target.value)
                            }
                            placeholder="Popular, Gluten-Free, Chef Special"
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-300">
                            Dish Photo
                          </label>
                          <div className="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-2">
                            <img
                              src={editingMenuItem.imageUrl}
                              alt={editingMenuItem.name}
                              className="h-10 w-10 rounded-lg object-cover border border-slate-800 shrink-0"
                            />
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition">
                              <Upload className="h-3.5 w-3.5 text-orange-400" />
                              <span>
                                {editItemImageFileName
                                  ? "Change Photo"
                                  : "Upload New Photo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleEditItemPhotoUpload}
                                className="hidden"
                              />
                            </label>
                            {editItemImageFileName && (
                              <span className="truncate text-[10px] text-slate-400">
                                {editItemImageFileName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Variant Options & Side Options Editor for Existing Dish */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                              Dish Variant Options & Side Options
                            </h5>
                            <p className="text-[11px] text-slate-400">
                              Customize sizes/preparation variants and optional
                              side pairings for {editingMenuItem.name}.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  modifiers: [
                                    ...(editingMenuItem.modifiers || []),
                                    {
                                      name: "Variant Option",
                                      type: "variant",
                                      required: true,
                                      multiSelect: false,
                                      options: [
                                        {
                                          label: "Regular Option",
                                          priceDelta: 0,
                                        },
                                        {
                                          label: "Large Upgrade",
                                          priceDelta: 5.0,
                                        },
                                      ],
                                    },
                                  ],
                                })
                              }
                              className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25"
                            >
                              + Add Variant Group
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  modifiers: [
                                    ...(editingMenuItem.modifiers || []),
                                    {
                                      name: "Side Option",
                                      type: "side",
                                      required: false,
                                      multiSelect: true,
                                      options: [
                                        {
                                          label: "House Side Salad",
                                          priceDelta: 5.0,
                                        },
                                        {
                                          label: "Artisanal Side",
                                          priceDelta: 4.5,
                                        },
                                      ],
                                    },
                                  ],
                                })
                              }
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                            >
                              + Add Side Group
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {(editingMenuItem.modifiers || []).map(
                            (grp, gIdx) => {
                              const isSide =
                                grp.type === "side" ||
                                grp.name.toLowerCase().includes("side");
                              return (
                                <div
                                  key={gIdx}
                                  className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <input
                                      type="text"
                                      value={grp.name}
                                      onChange={(e) => {
                                        const next = [
                                          ...(editingMenuItem.modifiers || []),
                                        ];
                                        next[gIdx] = {
                                          ...grp,
                                          name: e.target.value,
                                        };
                                        setEditingMenuItem({
                                          ...editingMenuItem,
                                          modifiers: next,
                                        });
                                      }}
                                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold text-white"
                                    />
                                    <select
                                      value={
                                        grp.type ||
                                        (isSide ? "side" : "variant")
                                      }
                                      onChange={(e) => {
                                        const nextType = e.target.value as
                                          | "variant"
                                          | "side"
                                          | "addon";
                                        const next = [
                                          ...(editingMenuItem.modifiers || []),
                                        ];
                                        next[gIdx] = {
                                          ...grp,
                                          type: nextType,
                                          required: nextType === "variant",
                                          multiSelect: nextType !== "variant",
                                        };
                                        setEditingMenuItem({
                                          ...editingMenuItem,
                                          modifiers: next,
                                        });
                                      }}
                                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-mono uppercase text-slate-200"
                                    >
                                      <option value="variant">
                                        Variant (Pick 1)
                                      </option>
                                      <option value="side">
                                        Side Option (Multi)
                                      </option>
                                      <option value="addon">
                                        Add-On (Multi)
                                      </option>
                                    </select>
                                    {(editingMenuItem.modifiers || []).length >
                                      1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (
                                            editingMenuItem.modifiers || []
                                          ).filter((_, i) => i !== gIdx);
                                          setEditingMenuItem({
                                            ...editingMenuItem,
                                            modifiers: next,
                                          });
                                        }}
                                        className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                                        title="Remove Group"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="space-y-1.5">
                                    {grp.options.map((opt, oIdx) => (
                                      <div
                                        key={oIdx}
                                        className="flex items-center gap-1.5"
                                      >
                                        <input
                                          type="text"
                                          value={opt.label}
                                          onChange={(e) => {
                                            const next = [
                                              ...(editingMenuItem.modifiers ||
                                                []),
                                            ];
                                            const nextOpts = [...grp.options];
                                            nextOpts[oIdx] = {
                                              ...opt,
                                              label: e.target.value,
                                            };
                                            next[gIdx] = {
                                              ...grp,
                                              options: nextOpts,
                                            };
                                            setEditingMenuItem({
                                              ...editingMenuItem,
                                              modifiers: next,
                                            });
                                          }}
                                          placeholder="Option Label"
                                          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                                        />
                                        <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 px-2 py-1">
                                          <span className="text-[10px] font-mono text-slate-400 mr-0.5">
                                            +$
                                          </span>
                                          <input
                                            type="number"
                                            step="0.25"
                                            value={opt.priceDelta}
                                            onChange={(e) => {
                                              const next = [
                                                ...(editingMenuItem.modifiers ||
                                                  []),
                                              ];
                                              const nextOpts = [...grp.options];
                                              nextOpts[oIdx] = {
                                                ...opt,
                                                priceDelta:
                                                  parseFloat(e.target.value) ||
                                                  0,
                                              };
                                              next[gIdx] = {
                                                ...grp,
                                                options: nextOpts,
                                              };
                                              setEditingMenuItem({
                                                ...editingMenuItem,
                                                modifiers: next,
                                              });
                                            }}
                                            className="w-14 bg-transparent text-xs font-mono text-emerald-300 focus:outline-none"
                                          />
                                        </div>
                                        {grp.options.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = [
                                                ...(editingMenuItem.modifiers ||
                                                  []),
                                              ];
                                              next[gIdx] = {
                                                ...grp,
                                                options: grp.options.filter(
                                                  (_, i) => i !== oIdx
                                                ),
                                              };
                                              setEditingMenuItem({
                                                ...editingMenuItem,
                                                modifiers: next,
                                              });
                                            }}
                                            className="rounded p-1 text-slate-500 hover:text-rose-400"
                                            title="Delete Option"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [
                                          ...(editingMenuItem.modifiers || []),
                                        ];
                                        next[gIdx] = {
                                          ...grp,
                                          options: [
                                            ...grp.options,
                                            {
                                              label: isSide
                                                ? "New Side Option"
                                                : "New Variant Option",
                                              priceDelta: isSide ? 4.5 : 3.0,
                                            },
                                          ],
                                        };
                                        setEditingMenuItem({
                                          ...editingMenuItem,
                                          modifiers: next,
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 pt-1"
                                    >
                                      <Plus className="h-3 w-3" /> Add{" "}
                                      {isSide ? "Side" : "Variant"} Option
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editingMenuItem.popular}
                              onChange={(e) =>
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  popular: e.target.checked,
                                })
                              }
                              className="rounded border-slate-700 bg-slate-950 text-orange-500"
                            />
                            <span>Featured / Popular Dish</span>
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editingMenuItem.available}
                              onChange={(e) =>
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  available: e.target.checked,
                                })
                              }
                              className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                            />
                            <span>Available for Ordering</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingMenuItem(null)}
                            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-lg shadow-orange-500/20"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save & Update Dish
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2.5: INVENTORY, PREP-BATCH, COMMISSARY TRUCK LOADOUT & RECIPE COGS */}
          {activeTab === "inventory" && (
            <OwnerInventoryManager
              restaurant={restaurant}
              menuItems={menuItems}
              scheduledReorders={scheduledReorders}
              slug={slug}
              onChangeRestaurant={setRestaurant}
              onSavePatch={saveRestaurantPatch}
              onReloadPortal={() =>
                loadPortalData(simDay || undefined, simTime || undefined)
              }
              notify={notify}
            />
          )}

          {/* TAB 3: FULFILLMENT OPTIONS, ORDER LIMITS, ADVANCE NOTICE & SPECIFIC TIME/DAY BLACKOUT SCHEDULES */}
          {activeTab === "limits" && (
            <div className="space-y-5">
              {/* Collapsible Sections Quick-Toggle & Expand/Collapse All Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3">
                <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sections:
                  </span>
                  {(
                    [
                      {
                        key: "fulfillment" as const,
                        label: "1. Pickup, Delivery & Eat-In",
                      },
                      {
                        key: "advanceNotice" as const,
                        label: "2. Prep & Pre-Order Notice Time",
                      },
                      {
                        key: "orderLimits" as const,
                        label: "3. Max Orders Kitchen Can Handle",
                      },
                      {
                        key: "weeklySchedule" as const,
                        label: "4. Opening & Closing Hours",
                      },
                      {
                        key: "blackoutWindows" as const,
                        label: "5. Holiday & Event Closures",
                      },
                    ] as const
                  ).map((sec) => {
                    const isOpen = limitsSectionsOpen[sec.key];
                    return (
                      <button
                        key={sec.key}
                        type="button"
                        onClick={() => toggleLimitsSection(sec.key)}
                        className={`shrink-0 inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${isOpen
                            ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                          }`}
                      >
                        <span>{sec.label}</span>
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""
                            }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLimitsSectionsOpen({
                        fulfillment: true,
                        advanceNotice: true,
                        orderLimits: true,
                        weeklySchedule: true,
                        blackoutWindows: true,
                      })
                    }
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLimitsSectionsOpen({
                        fulfillment: false,
                        advanceNotice: false,
                        orderLimits: false,
                        weeklySchedule: false,
                        blackoutWindows: false,
                      })
                    }
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* SECTION 1: Fulfillment Options & Channel Controls Card */}
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleLimitsSection("fulfillment")}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-4 sm:p-6 text-left hover:bg-slate-800/30 transition"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <ShoppingBag className="h-3 w-3" /> 1. Storefront Fulfillment Control
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">
                      Fulfillment Options & Channel Settings
                    </h3>
                    <p className="text-xs text-slate-400">
                      Control which fulfillment methods (
                      <strong className="text-white">Pickup</strong>,{" "}
                      <strong className="text-white">Delivery</strong>,{" "}
                      <strong className="text-white">Dine-In / Table QR</strong>)
                      are offered on your customer storefront, along with fees,
                      minimums, and guest instructions.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {restaurant.features.pickup && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                          🛍️ Pickup ON
                        </span>
                      )}
                      {restaurant.features.delivery && (
                        <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-2.5 py-0.5 text-[11px] font-bold text-sky-300">
                          🛵 Delivery ON
                        </span>
                      )}
                      {restaurant.features.dineInQr && (
                        <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                          🍽️ Dine-In ON
                        </span>
                      )}
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${limitsSectionsOpen.fulfillment ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                  </div>
                </button>

                {limitsSectionsOpen.fulfillment && (
                  <div className="border-t border-slate-800/80 p-4 sm:p-6 pt-5 space-y-5">
                    {/* Quick Presets for Fulfillment Modes */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Quick Channel Presets:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          {
                            label: "All Channels (Pickup + Delivery + Dine-In)",
                            pickup: true,
                            delivery: true,
                            dineInQr: true,
                            defaultFulfillment: "pickup" as const,
                          },
                          {
                            label: "Pickup + Delivery Only",
                            pickup: true,
                            delivery: true,
                            dineInQr: false,
                            defaultFulfillment: "pickup" as const,
                          },
                          {
                            label: "Pickup Only",
                            pickup: true,
                            delivery: false,
                            dineInQr: false,
                            defaultFulfillment: "pickup" as const,
                          },
                          {
                            label: "Delivery Only",
                            pickup: false,
                            delivery: true,
                            dineInQr: false,
                            defaultFulfillment: "delivery" as const,
                          },
                        ].map((preset) => {
                          const isMatch =
                            Boolean(restaurant.features.pickup) === preset.pickup &&
                            Boolean(restaurant.features.delivery) ===
                            preset.delivery &&
                            Boolean(restaurant.features.dineInQr) === preset.dineInQr;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const nextFeatures = {
                                  ...restaurant.features,
                                  pickup: preset.pickup,
                                  delivery: preset.delivery,
                                  dineInQr: preset.dineInQr,
                                  defaultFulfillment: preset.defaultFulfillment,
                                };
                                setRestaurant({
                                  ...restaurant,
                                  features: nextFeatures,
                                });
                              }}
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${isMatch
                                  ? "bg-emerald-500 text-slate-950 shadow font-bold"
                                  : "border border-slate-800 bg-slate-950/80 text-slate-300 hover:border-emerald-500/40 hover:text-white"
                                }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3 Channel Configuration Cards: Pickup, Delivery, Dine-In */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {/* 1. PICKUP CHANNEL CARD */}
                      <div
                        className={`rounded-2xl border p-4 space-y-3.5 transition ${restaurant.features.pickup
                            ? "border-emerald-500/40 bg-slate-950/80"
                            : "border-slate-800 bg-slate-950/40 opacity-75"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-lg border border-emerald-500/30">
                              🛍️
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                In-Store & Curbside Pickup
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Direct counter or curbside pickup
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const activeCount = [
                                restaurant.features.pickup,
                                restaurant.features.delivery,
                                restaurant.features.dineInQr,
                              ].filter(Boolean).length;
                              if (restaurant.features.pickup && activeCount <= 1) {
                                notify(
                                  "⚠️ At least one fulfillment option must remain enabled."
                                );
                                return;
                              }
                              setRestaurant({
                                ...restaurant,
                                features: {
                                  ...restaurant.features,
                                  pickup: !restaurant.features.pickup,
                                },
                              });
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${restaurant.features.pickup
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                              }`}
                          >
                            {restaurant.features.pickup ? "ENABLED" : "DISABLED"}
                          </button>
                        </div>

                        {restaurant.features.pickup && (
                          <div className="space-y-3 border-t border-slate-800/80 pt-3">
                            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  restaurant.features.curbsidePickup ?? true
                                )}
                                onChange={(e) =>
                                  setRestaurant({
                                    ...restaurant,
                                    features: {
                                      ...restaurant.features,
                                      curbsidePickup: e.target.checked,
                                    },
                                  })
                                }
                                className="rounded border-slate-600 text-emerald-500"
                              />
                              <span>Allow Curbside / Carside Handoff Option</span>
                            </label>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-300">
                                Customer Pickup Instructions
                              </label>
                              <input
                                type="text"
                                placeholder="e.g., Pick up at the express counter or text us for curbside."
                                value={restaurant.features.pickupInstructions || ""}
                                onChange={(e) =>
                                  setRestaurant({
                                    ...restaurant,
                                    features: {
                                      ...restaurant.features,
                                      pickupInstructions: e.target.value,
                                    },
                                  })
                                }
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. DELIVERY CHANNEL CARD */}
                      <div
                        className={`rounded-2xl border p-4 space-y-3.5 transition ${restaurant.features.delivery
                            ? "border-emerald-500/40 bg-slate-950/80"
                            : "border-slate-800 bg-slate-950/40 opacity-75"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-lg border border-sky-500/30">
                              🛵
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                Local Delivery
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Courier or in-house driver delivery
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const activeCount = [
                                restaurant.features.pickup,
                                restaurant.features.delivery,
                                restaurant.features.dineInQr,
                              ].filter(Boolean).length;
                              if (restaurant.features.delivery && activeCount <= 1) {
                                notify(
                                  "⚠️ At least one fulfillment option must remain enabled."
                                );
                                return;
                              }
                              setRestaurant({
                                ...restaurant,
                                features: {
                                  ...restaurant.features,
                                  delivery: !restaurant.features.delivery,
                                },
                              });
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${restaurant.features.delivery
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                              }`}
                          >
                            {restaurant.features.delivery ? "ENABLED" : "DISABLED"}
                          </button>
                        </div>

                        {restaurant.features.delivery && (
                          <div className="space-y-3 border-t border-slate-800/80 pt-3">
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-300">
                                  Delivery Fee ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.50"
                                  min={0}
                                  value={restaurant.paymentConfig.deliveryFee}
                                  onChange={(e) =>
                                    setRestaurant({
                                      ...restaurant,
                                      paymentConfig: {
                                        ...restaurant.paymentConfig,
                                        deliveryFee: Math.max(
                                          0,
                                          Number(e.target.value) || 0
                                        ),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-300">
                                  Free Delivery Over ($)
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min={0}
                                  value={restaurant.paymentConfig.freeDeliveryMin}
                                  onChange={(e) =>
                                    setRestaurant({
                                      ...restaurant,
                                      paymentConfig: {
                                        ...restaurant.paymentConfig,
                                        freeDeliveryMin: Math.max(
                                          0,
                                          Number(e.target.value) || 0
                                        ),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-300">
                                  Delivery Min Order ($)
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min={0}
                                  value={
                                    restaurant.features.deliveryMinOrderAmount ??
                                    restaurant.minOrderAmount
                                  }
                                  onChange={(e) =>
                                    setRestaurant({
                                      ...restaurant,
                                      features: {
                                        ...restaurant.features,
                                        deliveryMinOrderAmount: Math.max(
                                          0,
                                          Number(e.target.value) || 0
                                        ),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-300">
                                  Delivery Radius (Miles)
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0.5}
                                  value={restaurant.features.deliveryRadiusMiles ?? 5}
                                  onChange={(e) =>
                                    setRestaurant({
                                      ...restaurant,
                                      features: {
                                        ...restaurant.features,
                                        deliveryRadiusMiles: Math.max(
                                          0.5,
                                          Number(e.target.value) || 5
                                        ),
                                      },
                                    })
                                  }
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-white"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-300">
                                Delivery Zone / Drop-off Note
                              </label>
                              <input
                                type="text"
                                placeholder="e.g., Insulated thermal bag delivery within 5 miles."
                                value={restaurant.features.deliveryInstructions || ""}
                                onChange={(e) =>
                                  setRestaurant({
                                    ...restaurant,
                                    features: {
                                      ...restaurant.features,
                                      deliveryInstructions: e.target.value,
                                    },
                                  })
                                }
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. DINE-IN / TABLE QR CHANNEL CARD */}
                      <div
                        className={`rounded-2xl border p-4 space-y-3.5 transition ${restaurant.features.dineInQr
                            ? "border-emerald-500/40 bg-slate-950/80"
                            : "border-slate-800 bg-slate-950/40 opacity-75"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-lg border border-amber-500/30">
                              🍽️
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                Dine-In & Table QR
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Order from table via QR code
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const activeCount = [
                                restaurant.features.pickup,
                                restaurant.features.delivery,
                                restaurant.features.dineInQr,
                              ].filter(Boolean).length;
                              if (restaurant.features.dineInQr && activeCount <= 1) {
                                notify(
                                  "⚠️ At least one fulfillment option must remain enabled."
                                );
                                return;
                              }
                              setRestaurant({
                                ...restaurant,
                                features: {
                                  ...restaurant.features,
                                  dineInQr: !restaurant.features.dineInQr,
                                },
                              });
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${restaurant.features.dineInQr
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                              }`}
                          >
                            {restaurant.features.dineInQr ? "ENABLED" : "DISABLED"}
                          </button>
                        </div>

                        {restaurant.features.dineInQr && (
                          <div className="space-y-3 border-t border-slate-800/80 pt-3">
                            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  restaurant.features.tableReservations
                                )}
                                onChange={(e) =>
                                  setRestaurant({
                                    ...restaurant,
                                    features: {
                                      ...restaurant.features,
                                      tableReservations: e.target.checked,
                                    },
                                  })
                                }
                                className="rounded border-slate-600 text-emerald-500"
                              />
                              <span>Allow Advance Table Reservation Requests</span>
                            </label>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-300">
                                Dine-In Guest Instructions
                              </label>
                              <input
                                type="text"
                                placeholder="e.g., Enter the table number stand on your table."
                                value={restaurant.features.dineInInstructions || ""}
                                onChange={(e) =>
                                  setRestaurant({
                                    ...restaurant,
                                    features: {
                                      ...restaurant.features,
                                      dineInInstructions: e.target.value,
                                    },
                                  })
                                }
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Bar: Default Storefront Mode, Scheduled Orders Toggle & Save Button */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-300">
                            Default Selected Mode on Storefront:
                          </label>
                          <select
                            value={
                              restaurant.features.defaultFulfillment ||
                              (restaurant.features.pickup
                                ? "pickup"
                                : restaurant.features.delivery
                                  ? "delivery"
                                  : "dine_in")
                            }
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                features: {
                                  ...restaurant.features,
                                  defaultFulfillment: e.target.value as
                                    | "pickup"
                                    | "delivery"
                                    | "dine_in",
                                },
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            {restaurant.features.pickup && (
                              <option value="pickup">🛍️ Pickup</option>
                            )}
                            {restaurant.features.delivery && (
                              <option value="delivery">🛵 Delivery</option>
                            )}
                            {restaurant.features.dineInQr && (
                              <option value="dine_in">🍽️ Dine-In</option>
                            )}
                          </select>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              restaurant.features.scheduledOrders ?? true
                            )}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                features: {
                                  ...restaurant.features,
                                  scheduledOrders: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-slate-600 text-emerald-500"
                          />
                          <span>
                            Allow Customers to Schedule Advance Pickup/Delivery Dates
                          </span>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          saveRestaurantPatch(
                            {
                              features: restaurant.features,
                              paymentConfig: restaurant.paymentConfig,
                            },
                            "✅ Saved fulfillment options, delivery fees & channel instructions!"
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
                      >
                        <Save className="h-4 w-4" /> Save Fulfillment Options
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Advance Notice Requirement Card (Days & Hours) */}
              <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/20 shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleLimitsSection("advanceNotice")}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-4 sm:p-6 text-left hover:bg-slate-800/30 transition"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                      <Clock className="h-3 w-3" /> 2. Order Lead Time & Preparation Notice
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">
                      Advance Notice Required to Get Every Order Ready
                    </h3>
                    <p className="text-xs text-slate-400">
                      Specify the exact number of{" "}
                      <strong className="text-white">days</strong> and/or{" "}
                      <strong className="text-white">hours</strong> of advance
                      notice your kitchen needs to prepare every incoming customer
                      order.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Live Earliest Ready Preview Badge */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-2 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Required Lead Time
                      </div>
                      <div className="mt-0.5 font-mono text-xs font-bold text-emerald-400">
                        {restaurant.advanceNoticeDays > 0 ||
                          restaurant.advanceNoticeHours > 0
                          ? `${restaurant.advanceNoticeDays} Day(s), ${restaurant.advanceNoticeHours} Hour(s) + ${restaurant.prepTimeMinutes}m Prep`
                          : `Same-Day (~${restaurant.prepTimeMinutes}m prep)`}
                      </div>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${limitsSectionsOpen.advanceNotice ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                  </div>
                </button>

                {limitsSectionsOpen.advanceNotice && (
                  <div className="border-t border-slate-800/80 p-4 sm:p-6 pt-5 space-y-5">
                    {/* Quick Preset Pills for Days / Hours Advance Notice */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Quick Advance Notice Presets
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "Same-Day / ASAP (0d 0h)", days: 0, hours: 0 },
                          { label: "1 Hour Notice", days: 0, hours: 1 },
                          { label: "2 Hours Notice", days: 0, hours: 2 },
                          { label: "4 Hours Notice", days: 0, hours: 4 },
                          { label: "12 Hours Notice", days: 0, hours: 12 },
                          { label: "1 Day (24h) Notice", days: 1, hours: 0 },
                          { label: "1 Day + 4 Hours", days: 1, hours: 4 },
                          { label: "2 Days (48h) Notice", days: 2, hours: 0 },
                          { label: "3 Days Notice", days: 3, hours: 0 },
                          { label: "7 Days (Catering) Notice", days: 7, hours: 0 },
                        ].map((preset) => {
                          const isSelected =
                            (restaurant.advanceNoticeDays || 0) === preset.days &&
                            (restaurant.advanceNoticeHours || 0) === preset.hours;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                setRestaurant({
                                  ...restaurant,
                                  advanceNoticeDays: preset.days,
                                  advanceNoticeHours: preset.hours,
                                })
                              }
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${isSelected
                                  ? "bg-orange-500 text-white shadow"
                                  : "border border-slate-800 bg-slate-950/80 text-slate-300 hover:border-orange-500/40 hover:text-white"
                                }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Days, Hours, Prep Time & Policy Message Inputs */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Advance Notice — Days
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={60}
                            value={restaurant.advanceNoticeDays ?? 0}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                advanceNoticeDays: Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-white focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-slate-400 shrink-0">
                            Days
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Advance Notice — Hours
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={168}
                            value={restaurant.advanceNoticeHours ?? 0}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                advanceNoticeHours: Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-white focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-slate-400 shrink-0">
                            Hours
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Additional Kitchen Prep Time (Minutes)
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={restaurant.prepTimeMinutes}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                prepTimeMinutes: Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-white focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-slate-400 shrink-0">
                            Mins
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Customer-Facing Advance Notice Policy Message (Shown on Storefront & Checkout)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., All dishes are crafted fresh to order — please allow the required advance notice."
                        value={restaurant.advanceNoticeNote || ""}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            advanceNoticeNote: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-slate-400">
                        Customers ordering on{" "}
                        <span className="font-mono text-sky-400">
                          {restaurant.customDomain}
                        </span>{" "}
                        will automatically see this advance notice requirement and
                        earliest available ready time.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          saveRestaurantPatch(
                            {
                              advanceNoticeDays: restaurant.advanceNoticeDays ?? 0,
                              advanceNoticeHours: restaurant.advanceNoticeHours ?? 0,
                              advanceNoticeNote: restaurant.advanceNoticeNote || "",
                              prepTimeMinutes: restaurant.prepTimeMinutes,
                            },
                            `⏳ Saved advance notice requirement (${restaurant.advanceNoticeDays || 0}d ${restaurant.advanceNoticeHours || 0}h + ${restaurant.prepTimeMinutes}m prep)!`
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition"
                      >
                        <Save className="h-3.5 w-3.5" /> Save Advance Notice Requirement
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Kitchen Order Limits & Live Schedule Simulator */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleLimitsSection("orderLimits")}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-4 sm:p-6 text-left hover:bg-slate-800/30 transition"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      <Clock className="h-3 w-3" /> 3. Throttling & Schedule Simulator
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">
                      Kitchen Order Limits & Schedule Simulator
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cap maximum hourly and daily online orders, set order
                      minimums, and test your schedule/blackout rules at any
                      simulated day or time.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                      <span className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-orange-300">
                        {restaurant.maxOrdersPerHour}/hr
                      </span>
                      <span className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-300">
                        {restaurant.maxOrdersPerDay}/day
                      </span>
                      <span className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-emerald-300">
                        Min ${restaurant.minOrderAmount}
                      </span>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${limitsSectionsOpen.orderLimits ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                  </div>
                </button>

                {limitsSectionsOpen.orderLimits && (
                  <div className="border-t border-slate-800/80 p-4 sm:p-6 pt-5">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Order Limits Card */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 space-y-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-400" /> Kitchen Order
                          Limits & Throttling
                        </h3>
                        <p className="text-xs text-slate-400">
                          Prevent kitchen overload by capping maximum hourly and daily
                          online orders.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Max Orders Per Hour
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={restaurant.maxOrdersPerHour}
                              onChange={(e) =>
                                setRestaurant({
                                  ...restaurant,
                                  maxOrdersPerHour: Number(e.target.value),
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Max Orders Per Day
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={restaurant.maxOrdersPerDay}
                              onChange={(e) =>
                                setRestaurant({
                                  ...restaurant,
                                  maxOrdersPerDay: Number(e.target.value),
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Min Order Amount ($)
                            </label>
                            <input
                              type="number"
                              value={restaurant.minOrderAmount}
                              onChange={(e) =>
                                setRestaurant({
                                  ...restaurant,
                                  minOrderAmount: Number(e.target.value),
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Est. Prep Time (Minutes)
                            </label>
                            <input
                              type="number"
                              value={restaurant.prepTimeMinutes}
                              onChange={(e) =>
                                setRestaurant({
                                  ...restaurant,
                                  prepTimeMinutes: Number(e.target.value),
                                })
                              }
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-200 pt-2">
                          <input
                            type="checkbox"
                            checked={restaurant.autoPauseOnLimit}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                autoPauseOnLimit: e.target.checked,
                              })
                            }
                            className="rounded border-slate-600 text-orange-500"
                          />
                          Automatically turn off ordering when hourly or daily order
                          limit is reached
                        </label>

                        <button
                          onClick={() =>
                            saveRestaurantPatch(
                              {
                                maxOrdersPerHour: restaurant.maxOrdersPerHour,
                                maxOrdersPerDay: restaurant.maxOrdersPerDay,
                                minOrderAmount: restaurant.minOrderAmount,
                                prepTimeMinutes: restaurant.prepTimeMinutes,
                                advanceNoticeDays: restaurant.advanceNoticeDays ?? 0,
                                advanceNoticeHours: restaurant.advanceNoticeHours ?? 0,
                                advanceNoticeNote: restaurant.advanceNoticeNote || "",
                                autoPauseOnLimit: restaurant.autoPauseOnLimit,
                              },
                              "✅ Saved kitchen order limits & advance notice settings!"
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                        >
                          <Save className="h-3.5 w-3.5" /> Save Order Limits
                        </button>
                      </div>

                      {/* Time & Day Availability Tester */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 space-y-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-sky-400" /> Test
                          Schedule & Blackout Rules Simulator
                        </h3>
                        <p className="text-xs text-slate-400">
                          Simulate any day of the week and time of day to verify how
                          your storefront responds when ordering is turned off for
                          specific hours or days.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Simulated Day
                            </label>
                            <select
                              value={simDay}
                              onChange={(e) => {
                                setSimDay(e.target.value);
                                loadPortalData(e.target.value, simTime);
                              }}
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            >
                              <option value="">Current Live Day</option>
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
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300">
                              Simulated Time (24h)
                            </label>
                            <input
                              type="time"
                              value={simTime}
                              onChange={(e) => {
                                setSimTime(e.target.value);
                                loadPortalData(simDay, e.target.value);
                              }}
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={() => {
                              setSimDay("");
                              setSimTime("");
                              loadPortalData("", "");
                            }}
                            className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                          >
                            Reset to Current Real Time
                          </button>
                          <span className="text-xs text-slate-400">
                            Result shown in status banner above ↑
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: Weekly Day-by-Day Operating Hours & Available Pickup Time Configuration */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleLimitsSection("weeklySchedule")}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-4 sm:p-6 text-left hover:bg-slate-800/30 transition"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                      <CalendarClock className="h-3 w-3" /> 4. Weekly Operating & Pickup Schedule
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">
                      Weekly Schedule & Available Pickup Times by Day of Week
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure operating hours, mid-day breaks, and custom{" "}
                      <strong className="text-orange-300">
                        available pickup time windows & per-slot order capacities
                      </strong>{" "}
                      for each day of the week (Monday – Sunday).
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 font-mono text-xs text-emerald-400 font-semibold">
                      {restaurant.weeklySchedule.filter((d) => d.enabled).length}/7 Days Open
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${limitsSectionsOpen.weeklySchedule ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                  </div>
                </button>

                {limitsSectionsOpen.weeklySchedule && (
                  <div className="border-t border-slate-800/80 p-4 sm:p-6 pt-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-xs text-slate-400">
                        Customize each day&apos;s store hours, pickup window, time
                        slot interval, and maximum orders per time slot below.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mon = restaurant.weeklySchedule[0];
                            if (!mon) return;
                            const next = restaurant.weeklySchedule.map((d, i) =>
                              i >= 1 && i <= 4
                                ? {
                                  ...d,
                                  pickupEnabled: mon.pickupEnabled ?? true,
                                  pickupStartTime:
                                    mon.pickupStartTime || mon.openTime,
                                  pickupEndTime:
                                    mon.pickupEndTime || mon.closeTime,
                                  pickupSlotIntervalMinutes:
                                    mon.pickupSlotIntervalMinutes || 30,
                                  pickupSlotMaxOrders:
                                    mon.pickupSlotMaxOrders ?? 5,
                                  customPickupSlots: [
                                    ...(mon.customPickupSlots || []),
                                  ],
                                  pickupSlotCapacities: {
                                    ...(mon.pickupSlotCapacities || {}),
                                  },
                                }
                                : d
                            );
                            setRestaurant({ ...restaurant, weeklySchedule: next });
                            notify(
                              "📋 Copied Monday's pickup times & slots to Tuesday – Friday!"
                            );
                          }}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                        >
                          Copy Mon Pickup to Tue–Fri
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveRestaurantPatch(
                              { weeklySchedule: restaurant.weeklySchedule },
                              "✅ Saved weekly operating hours & day-by-day pickup times!"
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                        >
                          <Save className="h-3.5 w-3.5" /> Save Weekly & Pickup Schedule
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {restaurant.weeklySchedule.map((dayItem, idx) => {
                        const pickupOn = dayItem.pickupEnabled ?? dayItem.enabled;
                        const pickupStart =
                          dayItem.pickupStartTime || dayItem.openTime || "11:00";
                        const pickupEnd =
                          dayItem.pickupEndTime || dayItem.closeTime || "21:30";
                        const slotInterval =
                          dayItem.pickupSlotIntervalMinutes || 30;
                        const slotMaxOrders = dayItem.pickupSlotMaxOrders ?? 5;
                        const slotCapMap = dayItem.pickupSlotCapacities || {};
                        const customSlotsStr = (
                          dayItem.customPickupSlots || []
                        ).join(", ");

                        // Generate the list of active pickup slots for this day so the owner can set per-slot order limits
                        const dayGeneratedSlots: string[] = (() => {
                          if (
                            dayItem.customPickupSlots &&
                            dayItem.customPickupSlots.length > 0
                          ) {
                            return dayItem.customPickupSlots;
                          }
                          const toMins = (hhmm: string) => {
                            const [h, m] = hhmm.split(":").map(Number);
                            return (h || 0) * 60 + (m || 0);
                          };
                          const sM = toMins(pickupStart);
                          const eM = toMins(pickupEnd);
                          const bOn = Boolean(dayItem.breakEnabled);
                          const bS = toMins(dayItem.breakStart || "15:00");
                          const bE = toMins(dayItem.breakEnd || "16:30");
                          const list: string[] = [];
                          for (
                            let m = sM;
                            m <= eM;
                            m += Math.max(15, slotInterval)
                          ) {
                            if (bOn && m >= bS && m < bE) continue;
                            const hh = String(Math.floor(m / 60)).padStart(2, "0");
                            const mm = String(m % 60).padStart(2, "0");
                            list.push(`${hh}:${mm}`);
                          }
                          return list;
                        })();
                        const isCapExpanded = expandedSlotCapDay === dayItem.day;

                        return (
                          <div
                            key={dayItem.day}
                            className={`rounded-xl border p-4 space-y-3 transition ${dayItem.enabled
                                ? "border-slate-800 bg-slate-950/60"
                                : "border-rose-500/30 bg-rose-950/15"
                              }`}
                          >
                            {/* Row 1: Day Enable & Store Operating Hours */}
                            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-3">
                              <div className="md:col-span-3 flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={dayItem.enabled}
                                  onChange={(e) => {
                                    const next = [...restaurant.weeklySchedule];
                                    next[idx] = {
                                      ...dayItem,
                                      enabled: e.target.checked,
                                    };
                                    setRestaurant({
                                      ...restaurant,
                                      weeklySchedule: next,
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-slate-600 text-orange-500"
                                />
                                <span className="font-bold text-sm text-white">
                                  {dayItem.day}
                                </span>
                                {!dayItem.enabled && (
                                  <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                    CLOSED ALL DAY
                                  </span>
                                )}
                              </div>

                              {dayItem.enabled ? (
                                <>
                                  <div className="md:col-span-4 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="text-slate-400">
                                      Store Hours:
                                    </span>
                                    <input
                                      type="time"
                                      value={dayItem.openTime}
                                      onChange={(e) => {
                                        const next = [...restaurant.weeklySchedule];
                                        next[idx] = {
                                          ...dayItem,
                                          openTime: e.target.value,
                                        };
                                        setRestaurant({
                                          ...restaurant,
                                          weeklySchedule: next,
                                        });
                                      }}
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                                    />
                                    <span className="text-slate-400">to</span>
                                    <input
                                      type="time"
                                      value={dayItem.closeTime}
                                      onChange={(e) => {
                                        const next = [...restaurant.weeklySchedule];
                                        next[idx] = {
                                          ...dayItem,
                                          closeTime: e.target.value,
                                        };
                                        setRestaurant({
                                          ...restaurant,
                                          weeklySchedule: next,
                                        });
                                      }}
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                                    />
                                  </div>

                                  <div className="md:col-span-5 flex flex-wrap items-center gap-2 text-xs">
                                    <label className="flex items-center gap-1.5 text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(dayItem.breakEnabled)}
                                        onChange={(e) => {
                                          const next = [...restaurant.weeklySchedule];
                                          next[idx] = {
                                            ...dayItem,
                                            breakEnabled: e.target.checked,
                                          };
                                          setRestaurant({
                                            ...restaurant,
                                            weeklySchedule: next,
                                          });
                                        }}
                                        className="rounded border-slate-600 text-orange-500"
                                      />
                                      Mid-day break:
                                    </label>
                                    {dayItem.breakEnabled && (
                                      <>
                                        <input
                                          type="time"
                                          value={dayItem.breakStart || "15:00"}
                                          onChange={(e) => {
                                            const next = [
                                              ...restaurant.weeklySchedule,
                                            ];
                                            next[idx] = {
                                              ...dayItem,
                                              breakStart: e.target.value,
                                            };
                                            setRestaurant({
                                              ...restaurant,
                                              weeklySchedule: next,
                                            });
                                          }}
                                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                                        />
                                        <span>to</span>
                                        <input
                                          type="time"
                                          value={dayItem.breakEnd || "16:30"}
                                          onChange={(e) => {
                                            const next = [
                                              ...restaurant.weeklySchedule,
                                            ];
                                            next[idx] = {
                                              ...dayItem,
                                              breakEnd: e.target.value,
                                            };
                                            setRestaurant({
                                              ...restaurant,
                                              weeklySchedule: next,
                                            });
                                          }}
                                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                                        />
                                      </>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="md:col-span-9 text-xs text-rose-300">
                                  Online ordering & pickup are turned off all day on{" "}
                                  {dayItem.day}s.
                                </div>
                              )}
                            </div>

                            {/* Row 2: Available Pickup Time Window, Per-Slot Order Capacity & Custom Slots for this Day */}
                            {dayItem.enabled && (
                              <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-3 space-y-3 text-xs">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="inline-flex items-center gap-2 font-semibold text-orange-300 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={pickupOn}
                                        onChange={(e) => {
                                          const next = [...restaurant.weeklySchedule];
                                          next[idx] = {
                                            ...dayItem,
                                            pickupEnabled: e.target.checked,
                                          };
                                          setRestaurant({
                                            ...restaurant,
                                            weeklySchedule: next,
                                          });
                                        }}
                                        className="rounded border-slate-600 text-orange-500"
                                      />
                                      <span>🛍️ {dayItem.day} Pickup Available</span>
                                    </label>

                                    {pickupOn ? (
                                      <>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-slate-400">
                                            Pickup Window:
                                          </span>
                                          <input
                                            type="time"
                                            value={pickupStart}
                                            onChange={(e) => {
                                              const next = [
                                                ...restaurant.weeklySchedule,
                                              ];
                                              next[idx] = {
                                                ...dayItem,
                                                pickupStartTime: e.target.value,
                                              };
                                              setRestaurant({
                                                ...restaurant,
                                                weeklySchedule: next,
                                              });
                                            }}
                                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-white"
                                          />
                                          <span className="text-slate-400">to</span>
                                          <input
                                            type="time"
                                            value={pickupEnd}
                                            onChange={(e) => {
                                              const next = [
                                                ...restaurant.weeklySchedule,
                                              ];
                                              next[idx] = {
                                                ...dayItem,
                                                pickupEndTime: e.target.value,
                                              };
                                              setRestaurant({
                                                ...restaurant,
                                                weeklySchedule: next,
                                              });
                                            }}
                                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-white"
                                          />
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <span className="text-slate-400">
                                            Slot Every:
                                          </span>
                                          <select
                                            value={slotInterval}
                                            onChange={(e) => {
                                              const next = [
                                                ...restaurant.weeklySchedule,
                                              ];
                                              next[idx] = {
                                                ...dayItem,
                                                pickupSlotIntervalMinutes: Number(
                                                  e.target.value
                                                ),
                                              };
                                              setRestaurant({
                                                ...restaurant,
                                                weeklySchedule: next,
                                              });
                                            }}
                                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-white"
                                          >
                                            <option value={15}>15 mins</option>
                                            <option value={30}>30 mins</option>
                                            <option value={60}>60 mins</option>
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <span className="text-slate-400">
                                            Orders / Slot:
                                          </span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={slotMaxOrders}
                                            onChange={(e) => {
                                              const next = [
                                                ...restaurant.weeklySchedule,
                                              ];
                                              next[idx] = {
                                                ...dayItem,
                                                pickupSlotMaxOrders: Math.max(
                                                  1,
                                                  Number(e.target.value) || 1
                                                ),
                                              };
                                              setRestaurant({
                                                ...restaurant,
                                                weeklySchedule: next,
                                              });
                                            }}
                                            className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-emerald-400 font-bold"
                                            title="Default maximum number of orders each pickup time slot on this day can support"
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-amber-300">
                                        Pickup disabled on {dayItem.day}s (Delivery/Dine-in only)
                                      </span>
                                    )}
                                  </div>

                                  {pickupOn && (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-slate-400 shrink-0">
                                          Custom Slots:
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 12:00, 14:30, 17:30, 19:00"
                                          value={customSlotsStr}
                                          onChange={(e) => {
                                            const parsed = e.target.value
                                              .split(",")
                                              .map((s) => s.trim())
                                              .filter(Boolean);
                                            const next = [
                                              ...restaurant.weeklySchedule,
                                            ];
                                            next[idx] = {
                                              ...dayItem,
                                              customPickupSlots: parsed,
                                            };
                                            setRestaurant({
                                              ...restaurant,
                                              weeklySchedule: next,
                                            });
                                          }}
                                          className="w-full sm:w-48 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-white placeholder:text-slate-600"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedSlotCapDay(
                                            isCapExpanded ? null : dayItem.day
                                          )
                                        }
                                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${isCapExpanded
                                            ? "border-orange-500 bg-orange-500/20 text-orange-300"
                                            : "border-slate-700 bg-slate-950 text-slate-300 hover:border-orange-500/40 hover:text-white"
                                          }`}
                                      >
                                        <span>
                                          ⚡ Slot Capacities ({dayGeneratedSlots.length})
                                        </span>
                                        <ChevronDown
                                          className={`h-3 w-3 transition-transform ${isCapExpanded ? "rotate-180" : ""
                                            }`}
                                        />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Expandable Per-Slot Order Capacity Editor for this Day */}
                                {pickupOn && isCapExpanded && (
                                  <div className="border-t border-slate-800/80 pt-3 space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-[11px] text-slate-300">
                                        Set the maximum number of orders each{" "}
                                        <strong className="text-white">
                                          {dayItem.day}
                                        </strong>{" "}
                                        time slot can support (default:{" "}
                                        <strong className="text-emerald-400">
                                          {slotMaxOrders} orders/slot
                                        </strong>
                                        ):
                                      </span>
                                      {Object.keys(slotCapMap).length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = [
                                              ...restaurant.weeklySchedule,
                                            ];
                                            next[idx] = {
                                              ...dayItem,
                                              pickupSlotCapacities: {},
                                            };
                                            setRestaurant({
                                              ...restaurant,
                                              weeklySchedule: next,
                                            });
                                          }}
                                          className="text-[11px] text-slate-400 hover:text-rose-300"
                                        >
                                          Reset all slots to {slotMaxOrders}
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                                      {dayGeneratedSlots.map((slot) => {
                                        const capVal =
                                          slotCapMap[slot] ?? slotMaxOrders;
                                        const isCustomCap =
                                          slotCapMap[slot] !== undefined &&
                                          slotCapMap[slot] !== slotMaxOrders;
                                        return (
                                          <div
                                            key={slot}
                                            className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 ${isCustomCap
                                                ? "border-orange-500/50 bg-orange-500/10"
                                                : "border-slate-800 bg-slate-950"
                                              }`}
                                          >
                                            <span className="font-mono text-[11px] font-semibold text-white">
                                              {slot}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={capVal}
                                                onChange={(e) => {
                                                  const val = Math.max(
                                                    0,
                                                    Number(e.target.value) || 0
                                                  );
                                                  const nextMap = {
                                                    ...slotCapMap,
                                                    [slot]: val,
                                                  };
                                                  const next = [
                                                    ...restaurant.weeklySchedule,
                                                  ];
                                                  next[idx] = {
                                                    ...dayItem,
                                                    pickupSlotCapacities: nextMap,
                                                  };
                                                  setRestaurant({
                                                    ...restaurant,
                                                    weeklySchedule: next,
                                                  });
                                                }}
                                                className="w-11 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold text-emerald-400"
                                                title={`Max orders supported at ${slot} on ${dayItem.day}`}
                                              />
                                              <span className="text-[9px] text-slate-500">
                                                ord
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5: Specific Time/Day Blackout Windows */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleLimitsSection("blackoutWindows")}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-4 sm:p-6 text-left hover:bg-slate-800/30 transition"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                      <PauseCircle className="h-3 w-3" /> 5. Special Closures & Blackout Rules
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold text-white">
                      Specific Time/Day Blackout Windows
                    </h3>
                    <p className="text-xs text-slate-400">
                      Turn off online ordering during private events, holidays, or
                      specific kitchen prep windows.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 font-mono text-xs text-amber-300 font-semibold">
                      {restaurant.blackoutWindows.length} Rule(s)
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${limitsSectionsOpen.blackoutWindows ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                  </div>
                </button>

                {limitsSectionsOpen.blackoutWindows && (
                  <div className="border-t border-slate-800/80 p-4 sm:p-6 pt-5">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                      <form
                        onSubmit={handleAddBlackoutWindow}
                        className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 h-fit"
                      >
                        <h3 className="text-base font-bold text-white">
                          + Add Specific Time/Day Blackout
                        </h3>
                        <p className="text-xs text-slate-400">
                          Turn off online ordering during private events, holidays, or
                          specific kitchen prep windows.
                        </p>

                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Blackout Title *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g., Private Catering Event"
                            value={bwTitle}
                            onChange={(e) => setBwTitle(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Day of Week
                          </label>
                          <select
                            value={bwDayOfWeek}
                            onChange={(e) => setBwDayOfWeek(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                          >
                            <option value="All">Every Day</option>
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
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={bwFullDay}
                            onChange={(e) => setBwFullDay(e.target.checked)}
                            className="rounded border-slate-600 text-orange-500"
                          />
                          Turn off ordering for the entire day
                        </label>

                        {!bwFullDay && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-300">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={bwStartTime}
                                onChange={(e) => setBwStartTime(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={bwEndTime}
                                onChange={(e) => setBwEndTime(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-slate-300">
                            Customer Banner Message
                          </label>
                          <textarea
                            rows={2}
                            value={bwReason}
                            onChange={(e) => setBwReason(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full rounded-xl bg-orange-500 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                        >
                          Add Blackout Window
                        </button>
                      </form>

                      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                        <h3 className="text-base font-bold text-white">
                          Configured Blackout Windows (
                          {restaurant.blackoutWindows.length})
                        </h3>
                        {restaurant.blackoutWindows.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No special blackout windows configured yet.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {restaurant.blackoutWindows.map((bw) => (
                              <div
                                key={bw.id}
                                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white">
                                      {bw.title}
                                    </span>
                                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-orange-300">
                                      {bw.dayOfWeek} •{" "}
                                      {bw.fullDay
                                        ? "All Day"
                                        : `${bw.startTime} – ${bw.endTime}`}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${bw.active
                                          ? "bg-amber-500/20 text-amber-300"
                                          : "bg-slate-800 text-slate-400"
                                        }`}
                                    >
                                      {bw.active ? "ACTIVE RULE" : "INACTIVE"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {bw.reasonMessage}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleBlackoutWindow(bw.id)}
                                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                                  >
                                    {bw.active ? "Disable Rule" : "Activate Rule"}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveBlackoutWindow(bw.id)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STRIPE & PAYPAL CONFIGURATION */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Stripe Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 font-bold">
                        S
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Stripe Merchant Account
                        </h3>
                        <p className="text-xs text-slate-400">
                          Direct card, Apple Pay & Google Pay payouts to{" "}
                          {restaurant.name}
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <input
                        type="checkbox"
                        checked={restaurant.paymentConfig.stripe.enabled}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              stripe: {
                                ...restaurant.paymentConfig.stripe,
                                enabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="h-4 w-4 rounded text-indigo-500"
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Stripe Connected Account ID
                      </label>
                      <input
                        type="text"
                        value={restaurant.paymentConfig.stripe.accountId}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              stripe: {
                                ...restaurant.paymentConfig.stripe,
                                accountId: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Stripe Publishable Key
                      </label>
                      <input
                        type="text"
                        value={restaurant.paymentConfig.stripe.publishableKey}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              stripe: {
                                ...restaurant.paymentConfig.stripe,
                                publishableKey: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Stripe Secret Key
                      </label>
                      <input
                        type="password"
                        value={restaurant.paymentConfig.stripe.secretKey}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              stripe: {
                                ...restaurant.paymentConfig.stripe,
                                secretKey: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* PayPal Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 font-bold">
                        P
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          PayPal Commerce Account
                        </h3>
                        <p className="text-xs text-slate-400">
                          Accept PayPal Express & Venmo directly into owner&apos;s
                          PayPal
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <input
                        type="checkbox"
                        checked={restaurant.paymentConfig.paypal.enabled}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              paypal: {
                                ...restaurant.paymentConfig.paypal,
                                enabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="h-4 w-4 rounded text-sky-500"
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        PayPal Merchant Email
                      </label>
                      <input
                        type="email"
                        value={restaurant.paymentConfig.paypal.merchantEmail}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              paypal: {
                                ...restaurant.paymentConfig.paypal,
                                merchantEmail: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        PayPal Client ID
                      </label>
                      <input
                        type="text"
                        value={restaurant.paymentConfig.paypal.clientId}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              paypal: {
                                ...restaurant.paymentConfig.paypal,
                                clientId: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        PayPal Client Secret
                      </label>
                      <input
                        type="password"
                        value={restaurant.paymentConfig.paypal.clientSecret}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            paymentConfig: {
                              ...restaurant.paymentConfig,
                              paypal: {
                                ...restaurant.paymentConfig.paypal,
                                clientSecret: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Square & Clover POS Checkout Cards (Linked with 9. Plug & Play Apps) */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Square POS & Online Checkout Card */}
                <div className="rounded-2xl border border-sky-500/30 bg-slate-900 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-lg">
                        ⬛
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Square POS & Web Payments
                        </h3>
                        <p className="text-xs text-slate-400">
                          Accept Square online checkout & sync orders with your
                          Square Register
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                        restaurant.integrationsConfig?.square?.enabled !==
                          false &&
                        restaurant.integrationsConfig?.square
                          ?.acceptSquareCheckout !== false
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800 border border-slate-700 text-slate-400"
                      }`}
                    >
                      {restaurant.integrationsConfig?.square?.enabled !==
                        false &&
                      restaurant.integrationsConfig?.square
                        ?.acceptSquareCheckout !== false
                        ? "ACTIVE ON CHECKOUT"
                        : "OFF"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="text-slate-400">
                        Square Location ID:{" "}
                        <span className="font-mono font-bold text-white">
                          {restaurant.integrationsConfig?.square?.locationId ||
                            "L_MAIN_KITCHEN_01"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        2-Way Menu & 86&apos;d Stock Sync:{" "}
                        {restaurant.integrationsConfig?.square
                          ?.autoSyncCatalogAndStock !== false
                          ? "Enabled"
                          : "Disabled"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("integrations")}
                      className="rounded-xl bg-sky-500/20 border border-sky-500/40 px-3.5 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/30 transition"
                    >
                      Configure in 9. Plug & Play Apps →
                    </button>
                  </div>
                </div>

                {/* Clover POS & eCommerce Checkout Card */}
                <div className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-lg">
                        🍀
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Clover eCommerce & Kitchen KDS
                        </h3>
                        <p className="text-xs text-slate-400">
                          Accept Clover online checkout & print tickets on your
                          Clover Kitchen Printer
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                        restaurant.integrationsConfig?.clover?.enabled !==
                          false &&
                        restaurant.integrationsConfig?.clover
                          ?.acceptCloverCheckout !== false
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800 border border-slate-700 text-slate-400"
                      }`}
                    >
                      {restaurant.integrationsConfig?.clover?.enabled !==
                        false &&
                      restaurant.integrationsConfig?.clover
                        ?.acceptCloverCheckout !== false
                        ? "ACTIVE ON CHECKOUT"
                        : "OFF"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="text-slate-400">
                        Clover Merchant ID:{" "}
                        <span className="font-mono font-bold text-white">
                          {restaurant.integrationsConfig?.clover?.merchantId ||
                            "CLV_MERCH_01"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        2-Way Stock & Kitchen KDS Sync:{" "}
                        {restaurant.integrationsConfig?.clover
                          ?.autoSyncMenuAndStock !== false
                          ? "Enabled"
                          : "Disabled"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("integrations")}
                      className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
                    >
                      Configure in 9. Plug & Play Apps →
                    </button>
                  </div>
                </div>
              </div>

              {/* Tax & Fees */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <h3 className="text-base font-bold text-white">
                  Taxes, Delivery Fees & Gateway Mode
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Gateway Environment
                    </label>
                    <select
                      value={restaurant.paymentConfig.mode}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          paymentConfig: {
                            ...restaurant.paymentConfig,
                            mode: e.target.value as "simulated" | "live",
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="simulated">Simulated Sandbox Mode</option>
                      <option value="live">Live Production API Keys</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Sales Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={restaurant.paymentConfig.taxRatePercent}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          paymentConfig: {
                            ...restaurant.paymentConfig,
                            taxRatePercent: Number(e.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Delivery Fee ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={restaurant.paymentConfig.deliveryFee}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          paymentConfig: {
                            ...restaurant.paymentConfig,
                            deliveryFee: Number(e.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Free Delivery Minimum ($)
                    </label>
                    <input
                      type="number"
                      value={restaurant.paymentConfig.freeDeliveryMin}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          paymentConfig: {
                            ...restaurant.paymentConfig,
                            freeDeliveryMin: Number(e.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <button
                  onClick={() =>
                    saveRestaurantPatch(
                      { paymentConfig: restaurant.paymentConfig },
                      "💳 Saved Stripe & PayPal gateway configuration!"
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-orange-600"
                >
                  <Save className="h-4 w-4" /> Save Payment Gateway Settings
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOMER CRM */}
          {activeTab === "customers" && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <form
                onSubmit={handleAddCustomer}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 h-fit"
              >
                <h3 className="text-base font-bold text-white">
                  + Add VIP / Walk-In Customer
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="Elena Rostova"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="elena@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Mobile Phone (for SMS alerts)
                  </label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+1 (312) 555-0190"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Dietary / Hospitality Notes
                  </label>
                  <textarea
                    rows={2}
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    placeholder="Allergies, favorite table, wine preference..."
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-500 py-2.5 text-xs font-semibold text-white hover:bg-orange-600"
                >
                  + Save Customer to My List
                </button>
              </form>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-white">
                    👥 My Customers & VIP Regulars ({filteredCustomers.length})
                  </h3>
                  <input
                    type="text"
                    placeholder="Search by name, email, phone..."
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                    className="w-full sm:w-64 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-3">
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">
                            {c.name}
                          </span>
                          {c.vipStatus && (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                              ★ VIP GUEST
                            </span>
                          )}
                          <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                            {c.loyaltyPoints} pts
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {c.email} • {c.phone}
                        </p>
                        {c.notes && (
                          <p className="text-xs italic text-slate-300">
                            &quot;{c.notes}&quot;
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">
                          ${c.totalSpent.toFixed(2)} spent
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.totalOrders} orders • SMS{" "}
                          {c.smsOptIn ? "Opted-In" : "Off"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SMS NOTIFICATION CENTER (Managed by Super Admin Platform Twilio Gateway) */}
          {activeTab === "sms" && (
            <div className="space-y-8">
              {/* Platform Managed Twilio Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5">
                <div className="flex items-start gap-3.5">
                  <div className="rounded-xl bg-emerald-500/20 p-2.5 text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        📲 Automatic Phone Text Alerts (Ready to Use — Zero Technical Setup!)
                      </h3>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                        Active & Connected
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      You don&apos;t need any technical setup! Whenever a customer
                      places an order, we automatically text your kitchen phone,
                      and we text the customer when you mark their food Ready (sent
                      from{" "}
                      <code className="text-emerald-300">
                        {platformTwilio?.senderPhone || "+1 (888) 555-0100"}
                      </code>
                      ).
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Super Admin Gateway Settings →
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Restaurant Owner & Customer Automated Order SMS Triggers */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Bell className="h-4 w-4 text-orange-400" /> Automated Order
                    SMS Notifications ({restaurant.name})
                  </h3>

                  {/* Restaurant Owner Instant Order Alert */}
                  <div className="rounded-xl border border-orange-500/30 bg-slate-950/80 p-4 space-y-3">
                    <label className="flex items-center justify-between gap-2 text-xs font-bold text-orange-300 cursor-pointer">
                      <span>
                        🔔 Instant SMS Alert to Restaurant Owner on Every New
                        Order
                      </span>
                      <input
                        type="checkbox"
                        checked={
                          restaurant.commsConfig.sms.ownerAlertEnabled ?? true
                        }
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            commsConfig: {
                              ...restaurant.commsConfig,
                              sms: {
                                ...restaurant.commsConfig.sms,
                                ownerAlertEnabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="h-4 w-4 rounded"
                      />
                    </label>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Restaurant Owner / Kitchen Alert Mobile Number
                      </label>
                      <input
                        type="text"
                        value={
                          restaurant.commsConfig.sms.ownerAlertPhone ||
                          restaurant.phone
                        }
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            commsConfig: {
                              ...restaurant.commsConfig,
                              sms: {
                                ...restaurant.commsConfig.sms,
                                ownerAlertPhone: e.target.value,
                              },
                            },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  {/* Customer Status Auto-Notification Checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restaurant.commsConfig.sms.autoNotifyConfirmed}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            commsConfig: {
                              ...restaurant.commsConfig,
                              sms: {
                                ...restaurant.commsConfig.sms,
                                autoNotifyConfirmed: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span>Customer: Order Confirmed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restaurant.commsConfig.sms.autoNotifyPreparing}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            commsConfig: {
                              ...restaurant.commsConfig,
                              sms: {
                                ...restaurant.commsConfig.sms,
                                autoNotifyPreparing: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span>Customer: Order Preparing</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restaurant.commsConfig.sms.autoNotifyReady}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            commsConfig: {
                              ...restaurant.commsConfig,
                              sms: {
                                ...restaurant.commsConfig.sms,
                                autoNotifyReady: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span>Customer: Order Ready</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restaurant.commsConfig.sms.autoNotifyCancelled}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            commsConfig: {
                              ...restaurant.commsConfig,
                              sms: {
                                ...restaurant.commsConfig.sms,
                                autoNotifyCancelled: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span>Customer: Order Cancelled</span>
                    </label>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-medium text-slate-300">
                      Order Confirmed SMS Template
                    </label>
                    <input
                      type="text"
                      value={restaurant.commsConfig.sms.templates.confirmed}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          commsConfig: {
                            ...restaurant.commsConfig,
                            sms: {
                              ...restaurant.commsConfig.sms,
                              templates: {
                                ...restaurant.commsConfig.sms.templates,
                                confirmed: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />

                    <label className="block text-xs font-medium text-slate-300">
                      Order Ready for Pickup/Delivery SMS Template
                    </label>
                    <input
                      type="text"
                      value={restaurant.commsConfig.sms.templates.ready}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          commsConfig: {
                            ...restaurant.commsConfig,
                            sms: {
                              ...restaurant.commsConfig.sms,
                              templates: {
                                ...restaurant.commsConfig.sms.templates,
                                ready: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <button
                    onClick={() =>
                      saveRestaurantPatch(
                        { commsConfig: restaurant.commsConfig },
                        "📲 Saved Owner Order Alert & Customer SMS preferences!"
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Notification Preferences
                  </button>
                </div>

                {/* Send Instant or Broadcast SMS */}
                <form
                  onSubmit={handleSendSms}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4"
                >
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-400" /> Send Instant SMS
                    or Promotional Broadcast
                  </h3>

                  <label className="flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={broadcastSmsAll}
                      onChange={(e) => setBroadcastSmsAll(e.target.checked)}
                      className="rounded border-slate-600 text-orange-500"
                    />
                    Broadcast to all opted-in CRM customers ({customers.length}{" "}
                    recipients)
                  </label>

                  {!broadcastSmsAll && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Recipient Name
                        </label>
                        <input
                          type="text"
                          value={manualSmsName}
                          onChange={(e) => setManualSmsName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300">
                          Recipient Phone
                        </label>
                        <input
                          type="text"
                          value={manualSmsPhone}
                          onChange={(e) => setManualSmsPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      SMS Message Content
                    </label>
                    <textarea
                      rows={3}
                      value={manualSmsBody}
                      onChange={(e) => setManualSmsBody(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <Send className="h-3.5 w-3.5" /> Dispatch SMS Now
                  </button>
                </form>
              </div>

              {/* SMS Delivery Logs */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <h3 className="text-base font-bold text-white">
                  Live SMS Delivery Log ({smsLogs.length})
                </h3>
                <div className="space-y-2.5">
                  {smsLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            {log.status}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-orange-300">
                            {log.triggerType}
                          </span>
                          <strong className="text-white">
                            {log.customerName} ({log.customerPhone})
                          </strong>
                        </div>
                        <p className="text-slate-300">{log.message}</p>
                      </div>
                      <span className="text-slate-500">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: EMAIL CAMPAIGNS */}
          {activeTab === "email" && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <form
                onSubmit={handleSendEmailCampaign}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 h-fit"
              >
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-400" /> Launch Email
                  Campaign
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Friday Night VIP Chef's Tasting"
                    value={campName}
                    onChange={(e) => setCampName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Email Subject Line *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="🍷 20% Off Online Orders Tonight!"
                    value={campSubject}
                    onChange={(e) => setCampSubject(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Audience Segment
                    </label>
                    <select
                      value={campSegment}
                      onChange={(e) =>
                        setCampSegment(
                          e.target.value as EmailCampaign["segment"]
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      <option value="all">All Opted-In Customers</option>
                      <option value="vip">VIP Guests Only</option>
                      <option value="repeat">Repeat Guests (2+ orders)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Promo Code
                    </label>
                    <input
                      type="text"
                      value={campPromoCode}
                      onChange={(e) => setCampPromoCode(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Write Your Email Message to Customers
                  </label>
                  <textarea
                    rows={4}
                    value={campBody}
                    onChange={(e) => setCampBody(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-500 py-2.5 text-xs font-semibold text-white hover:bg-orange-600"
                >
                  Send Email Campaign Now
                </button>
              </form>

              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-base font-bold text-white">
                  Sent Email Campaigns & Performance ({emailCampaigns.length})
                </h3>
                <div className="space-y-3">
                  {emailCampaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="rounded bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-300">
                            Segment: {camp.segment}
                          </span>
                          <h4 className="mt-1 text-base font-bold text-white">
                            {camp.name}
                          </h4>
                          <p className="text-xs text-slate-400">
                            Subject: &quot;{camp.subject}&quot;
                          </p>
                        </div>
                        {camp.promoCode && (
                          <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                            Code: {camp.promoCode}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-center">
                        <div>
                          <p className="text-[11px] text-slate-400">Recipients</p>
                          <p className="text-sm font-bold text-white">
                            {camp.recipientCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Open Rate</p>
                          <p className="text-sm font-bold text-sky-400">
                            {camp.openRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Click Rate</p>
                          <p className="text-sm font-bold text-purple-400">
                            {camp.clickRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400">Revenue</p>
                          <p className="text-sm font-bold text-emerald-400">
                            ${camp.revenueGenerated.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: CUSTOM DOMAIN & STOREFRONT CUSTOMIZATIONS */}
          {activeTab === "domain" && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Settings className="h-4 w-4 text-orange-400" /> Custom Domain
                    & Unique Storefront Setup
                  </h3>
                  <p className="text-xs text-slate-400">
                    Manage {restaurant.name}&apos;s custom domain routing, SSL
                    certificate, brand colors, and enabled modules.
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Custom Domain Name
                  </label>
                  <input
                    type="text"
                    value={restaurant.customDomain}
                    onChange={(e) =>
                      setRestaurant({
                        ...restaurant,
                        customDomain: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-sky-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Primary Brand Color
                  </label>
                  <input
                    type="text"
                    value={restaurant.primaryColor}
                    onChange={(e) =>
                      setRestaurant({
                        ...restaurant,
                        primaryColor: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Storefront Layout Theme
                  </label>
                  <select
                    value={restaurant.layoutStyle}
                    onChange={(e) =>
                      setRestaurant({
                        ...restaurant,
                        layoutStyle: e.target
                          .value as RestaurantTenant["layoutStyle"],
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="aura-luxury">
                      AURA Bespoke Gastronomy (Banquet + Degustation)
                    </option>
                    <option value="modern-grid">Modern Visual Card Grid</option>
                    <option value="editorial-list">
                      Editorial Fine-Dining List
                    </option>
                    <option value="compact-bistro">
                      Fast-Casual Express Bistro
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Unique Requirements & Custom Configuration Notes
                </label>
                <textarea
                  rows={2}
                  value={restaurant.customRequirementNotes}
                  onChange={(e) =>
                    setRestaurant({
                      ...restaurant,
                      customRequirementNotes: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>

              <button
                onClick={() =>
                  saveRestaurantPatch(
                    {
                      customDomain: restaurant.customDomain,
                      primaryColor: restaurant.primaryColor,
                      layoutStyle: restaurant.layoutStyle,
                      customRequirementNotes: restaurant.customRequirementNotes,
                      domainVerified: true,
                      sslStatus: "active",
                    },
                    "🌐 Updated custom domain & storefront customizations!"
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-orange-600"
              >
                <Save className="h-4 w-4" /> Save Domain & Branding Settings
              </button>

              {/* Tenant-Branded AI Chat & Voice Ordering Assistant Configuration */}
              <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <Sparkles className="h-3 w-3" /> Tenant AI Concierge & Voice Assistant
                    </span>
                    <h3 className="mt-1 text-base font-bold text-white">
                      Branded AI Chat Bot & Voice Ordering Assistant
                    </h3>
                    <p className="text-xs text-slate-400">
                      Customize {restaurant.name}&apos;s AI persona, voice
                      synthesis settings, and extendable realtime voice agent
                      provider. Automatically understands all {menuItems.length}{" "}
                      menu items, dietary tags, and modifier options.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const currentOn = restaurant.features.aiChatbot !== false;
                      const nextFeatures = {
                        ...restaurant.features,
                        aiChatbot: !currentOn,
                      };
                      setRestaurant({
                        ...restaurant,
                        features: nextFeatures,
                      });
                      saveRestaurantPatch(
                        { features: nextFeatures },
                        `🤖 Storefront AI Chat & Voice Assistant ${!currentOn ? "ENABLED" : "DISABLED"
                        }!`
                      );
                    }}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${restaurant.features.aiChatbot !== false
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                  >
                    {restaurant.features.aiChatbot !== false
                      ? "AI BOT ENABLED"
                      : "AI BOT DISABLED"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      AI Bot Persona Name
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g., Chef ${restaurant.ownerName.split(" ")[0]} AI`}
                      value={restaurant.features.aiAssistant?.botName || ""}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          features: {
                            ...restaurant.features,
                            aiAssistant: {
                              enabled: true,
                              botName: e.target.value,
                              botRoleTitle:
                                restaurant.features.aiAssistant?.botRoleTitle ||
                                `${restaurant.cuisine} Ordering Concierge`,
                              welcomeMessage:
                                restaurant.features.aiAssistant?.welcomeMessage ||
                                "",
                              voiceEnabled:
                                restaurant.features.aiAssistant?.voiceEnabled ??
                                true,
                              autoSpeakReplies:
                                restaurant.features.aiAssistant
                                  ?.autoSpeakReplies ?? true,
                              handsFreeContinuousMode:
                                restaurant.features.aiAssistant
                                  ?.handsFreeContinuousMode ?? false,
                              voiceRate:
                                restaurant.features.aiAssistant?.voiceRate ?? 1.0,
                              voicePitch:
                                restaurant.features.aiAssistant?.voicePitch ?? 1.0,
                              voiceLanguage:
                                restaurant.features.aiAssistant?.voiceLanguage ||
                                "en-US",
                              voiceProvider:
                                restaurant.features.aiAssistant?.voiceProvider ||
                                "browser_speech",
                            },
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      AI Role / Subtitle
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g., ${restaurant.cuisine} Sommelier & Voice Concierge`}
                      value={restaurant.features.aiAssistant?.botRoleTitle || ""}
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          features: {
                            ...restaurant.features,
                            aiAssistant: {
                              ...(restaurant.features.aiAssistant || {
                                enabled: true,
                                botName: `${restaurant.name.split(" ")[0]} AI`,
                                welcomeMessage: "",
                                voiceEnabled: true,
                                autoSpeakReplies: true,
                                handsFreeContinuousMode: false,
                                voiceRate: 1.0,
                                voicePitch: 1.0,
                                voiceLanguage: "en-US",
                                voiceProvider: "browser_speech",
                              }),
                              botRoleTitle: e.target.value,
                            },
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Extendable Voice Engine / Provider
                    </label>
                    <select
                      value={
                        restaurant.features.aiAssistant?.voiceProvider ||
                        "browser_speech"
                      }
                      onChange={(e) =>
                        setRestaurant({
                          ...restaurant,
                          features: {
                            ...restaurant.features,
                            aiAssistant: {
                              ...(restaurant.features.aiAssistant || {
                                enabled: true,
                                botName: `${restaurant.name.split(" ")[0]} AI`,
                                botRoleTitle: `${restaurant.cuisine} Concierge`,
                                welcomeMessage: "",
                                voiceEnabled: true,
                                autoSpeakReplies: true,
                                handsFreeContinuousMode: false,
                                voiceRate: 1.0,
                                voicePitch: 1.0,
                                voiceLanguage: "en-US",
                              }),
                              voiceProvider: e.target.value as
                                | "browser_speech"
                                | "gemini_live"
                                | "openai_realtime"
                                | "elevenlabs_twilio",
                            },
                          },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      <option value="browser_speech">
                        Web Speech API (Built-In Browser STT + TTS)
                      </option>
                      <option value="gemini_live">
                        Gemini Live Multimodal Voice API
                      </option>
                      <option value="openai_realtime">
                        OpenAI Realtime Voice WebSocket
                      </option>
                      <option value="elevenlabs_twilio">
                        ElevenLabs + Twilio Phone Ordering Agent
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Custom Welcome Greeting Message
                  </label>
                  <input
                    type="text"
                    placeholder={`Welcome to ${restaurant.name}! Ask me about any dish, modifier option, or order by voice or text.`}
                    value={restaurant.features.aiAssistant?.welcomeMessage || ""}
                    onChange={(e) =>
                      setRestaurant({
                        ...restaurant,
                        features: {
                          ...restaurant.features,
                          aiAssistant: {
                            ...(restaurant.features.aiAssistant || {
                              enabled: true,
                              botName: `${restaurant.name.split(" ")[0]} AI`,
                              botRoleTitle: `${restaurant.cuisine} Concierge`,
                              voiceEnabled: true,
                              autoSpeakReplies: true,
                              handsFreeContinuousMode: false,
                              voiceRate: 1.0,
                              voicePitch: 1.0,
                              voiceLanguage: "en-US",
                              voiceProvider: "browser_speech",
                            }),
                            welcomeMessage: e.target.value,
                          },
                        },
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          restaurant.features.aiAssistant?.autoSpeakReplies ??
                          true
                        }
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            features: {
                              ...restaurant.features,
                              aiAssistant: {
                                ...(restaurant.features.aiAssistant || {
                                  enabled: true,
                                  botName: `${restaurant.name.split(" ")[0]} AI`,
                                  botRoleTitle: `${restaurant.cuisine} Concierge`,
                                  welcomeMessage: "",
                                  voiceEnabled: true,
                                  handsFreeContinuousMode: false,
                                  voiceRate: 1.0,
                                  voicePitch: 1.0,
                                  voiceLanguage: "en-US",
                                  voiceProvider: "browser_speech",
                                }),
                                autoSpeakReplies: e.target.checked,
                              },
                            },
                          })
                        }
                        className="rounded border-slate-600 text-emerald-500"
                      />
                      <span>Speak AI Responses Aloud (TTS)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(
                          restaurant.features.aiAssistant?.handsFreeContinuousMode
                        )}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            features: {
                              ...restaurant.features,
                              aiAssistant: {
                                ...(restaurant.features.aiAssistant || {
                                  enabled: true,
                                  botName: `${restaurant.name.split(" ")[0]} AI`,
                                  botRoleTitle: `${restaurant.cuisine} Concierge`,
                                  welcomeMessage: "",
                                  voiceEnabled: true,
                                  autoSpeakReplies: true,
                                  voiceRate: 1.0,
                                  voicePitch: 1.0,
                                  voiceLanguage: "en-US",
                                  voiceProvider: "browser_speech",
                                }),
                                handsFreeContinuousMode: e.target.checked,
                              },
                            },
                          })
                        }
                        className="rounded border-slate-600 text-emerald-500"
                      />
                      <span>Hands-Free Continuous Voice Loop</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      saveRestaurantPatch(
                        { features: restaurant.features },
                        "🤖 Saved tenant-branded AI Chat & Voice Assistant settings!"
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
                  >
                    <Save className="h-4 w-4" /> Save AI & Voice Assistant Config
                  </button>
                </div>
              </div>

              {/* Storefront Pages, Logo, About Us, Footer & Legal Policies CMS */}
              <OwnerStorefrontPagesEditor
                restaurant={restaurant}
                onChangeRestaurant={setRestaurant}
                onSavePatch={saveRestaurantPatch}
              />
            </div>
          )}

          {/* TAB 9: RESTAURANT TEAM & STAFF ROLES (RBAC) */}
          {activeTab === "team" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Left Column: Invite / Add Restaurant Staff Member */}
                <form
                  onSubmit={handleAddStaffMember}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 h-fit"
                >
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <UserPlus className="h-5 w-5 text-orange-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Add Restaurant Team Member
                      </h3>
                      <p className="text-xs text-slate-400">
                        Assign role-specific portal permissions & POS PIN
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Staff Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Chef Sofia Moretti"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
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
                      placeholder="sofia@restaurant.com"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Restaurant Role *
                    </label>
                    <select
                      value={staffRole}
                      onChange={(e) =>
                        setStaffRole(e.target.value as RestaurantRole)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      <option value="restaurant_owner">
                        Restaurant Owner (Full Access)
                      </option>
                      <option value="general_manager">
                        General Manager (GM)
                      </option>
                      <option value="kitchen_chef">
                        Head Chef / Kitchen Expo
                      </option>
                      <option value="cashier_host">
                        Front-of-House / Cashier
                      </option>
                      <option value="marketing_manager">
                        CRM & Marketing Specialist
                      </option>
                    </select>
                    <p className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-400">
                      {ROLE_DEFINITIONS[staffRole]?.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Mobile Phone
                      </label>
                      <input
                        type="text"
                        value={staffPhone}
                        onChange={(e) => setStaffPhone(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Kitchen Terminal PIN
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={staffPin}
                        onChange={(e) => setStaffPin(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Shift / Job Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Dinner Service Sous Chef"
                      value={staffTitle}
                      onChange={(e) => setStaffTitle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-500 py-2.5 text-xs font-semibold text-white hover:bg-orange-600 transition"
                  >
                    + Add Staff Member & Assign Role
                  </button>
                </form>

                {/* Right 2 Columns: Restaurant Staff Directory */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {restaurant.name} Team & Staff ({teamMembers.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Manage roles, permissions, and test how the portal looks
                        for each role using &quot;Preview Role&quot;.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {teamMembers.map((member) => {
                      const rDef =
                        ROLE_DEFINITIONS[member.role] ||
                        ROLE_DEFINITIONS.general_manager;
                      return (
                        <div
                          key={member.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                {member.name}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${rDef.badgeColor}`}
                              >
                                {rDef.label}
                              </span>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-mono uppercase ${member.status === "active"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/20 text-rose-300"
                                  }`}
                              >
                                {member.status}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400">
                              {member.title} • {member.email} • {member.phone} •
                              PIN:{" "}
                              <code className="text-orange-300 font-mono">
                                {member.pinCode}
                              </code>
                            </p>

                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              <span className="text-[10px] text-slate-400 mr-1">
                                Can access:
                              </span>
                              {rDef.allowedPortalTabs.map((tab) => (
                                <span
                                  key={tab}
                                  className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-200"
                                >
                                  {tab}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleUpdateStaffMember(member.id, {
                                  role: e.target.value as UserRole,
                                })
                              }
                              className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                            >
                              <option value="restaurant_owner">
                                Role: Restaurant Owner
                              </option>
                              <option value="general_manager">
                                Role: General Manager
                              </option>
                              <option value="kitchen_chef">
                                Role: Head Chef / Kitchen
                              </option>
                              <option value="cashier_host">
                                Role: Cashier / Host
                              </option>
                              <option value="marketing_manager">
                                Role: Marketing Specialist
                              </option>
                            </select>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleRoleSwitch(member.role as RestaurantRole)
                                }
                                className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300 hover:bg-orange-500/20"
                              >
                                Preview Role
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateStaffMember(member.id, {
                                    status:
                                      member.status === "active"
                                        ? "suspended"
                                        : "active",
                                  })
                                }
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                              >
                                {member.status === "active"
                                  ? "Suspend"
                                  : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveStaffMember(member.id, member.name)
                                }
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
            </div>
          )}

          {/* TAB 11: PLUG & PLAY APPS (DOORDASH DRIVE, SQUARE POS, CLOVER POS, VAPI VOICE AI) */}
          {activeTab === "integrations" && (
            <OwnerIntegrationsHub
              restaurant={restaurant}
              platformIntegrations={platformIntegrations}
              menuItems={menuItems}
              orders={orders}
              saving={false}
              onChangeRestaurant={setRestaurant}
              onOrdersUpdated={setOrders}
              onSaveIntegrations={async (nextIntegrationsConfig) => {
                await saveRestaurantPatch(
                  { integrationsConfig: nextIntegrationsConfig },
                  "🔌 Saved Plug & Play Apps (DoorDash, Square, Clover & Vapi) settings!"
                );
              }}
              onNotify={notify}
            />
          )}
        </main>

        {/* Mobile Bottom Quick-Navigation Bar (lg:hidden) */}
        <nav
          aria-label="Mobile quick navigation"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/90 bg-slate-950/95 px-2 py-1.5 backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {(
              [
                {
                  id: "orders" as ActiveTab,
                  shortLabel: "Orders",
                  icon: ShoppingBag,
                  badge: orders.filter(
                    (o) => o.status !== "completed" && o.status !== "cancelled"
                  ).length,
                },
                {
                  id: "menu" as ActiveTab,
                  shortLabel: "Menu",
                  icon: Utensils,
                  badge: menuItems.filter((m) => !m.available).length,
                },
                {
                  id: "inventory" as ActiveTab,
                  shortLabel: "Stock",
                  icon: Package,
                  badge:
                    restaurant.inventoryConfig?.items?.filter(
                      (i) => i.currentStock <= i.reorderPoint
                    ).length || 0,
                },
                {
                  id: "limits" as ActiveTab,
                  shortLabel: "Hours",
                  icon: CalendarClock,
                  badge: 0,
                },
              ] as const
            )
              .filter((item) => allowedTabsForRole.includes(item.id))
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition ${isActive
                        ? "bg-orange-500/15 text-orange-400"
                        : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate max-w-full px-1">
                      {item.shortLabel}
                    </span>
                    {item.badge > 0 && (
                      <span className="absolute right-2 top-1 rounded-full bg-orange-500 px-1.5 text-[9px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition ${mobileSidebarOpen
                  ? "bg-orange-500/15 text-orange-400"
                  : "text-slate-400 hover:text-slate-200"
                }`}
            >
              <Menu className="h-4 w-4" />
              <span>More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
