"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  CheckCircle2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import type {
  MenuItem,
  Order,
  PortalTabId,
  RestaurantTenant,
} from "@/lib/types";
import type {
  OwnerAssistantState,
  OwnerUiAction,
} from "@/app/api/restaurants/[slug]/owner-assistant/route";

interface AssistantMessage {
  id: string;
  sender: "assistant" | "owner";
  text: string;
  timestamp: string;
  executedTasks?: string[];
  quickReplies?: string[];
}

interface OwnerPortalAssistantProps {
  restaurant: RestaurantTenant;
  menuItems: MenuItem[];
  orders: Order[];
  isOpen: boolean;
  onSetOpen: (open: boolean) => void;
  onSelectTab: (tab: PortalTabId) => void;
  onOpenAddMenuModal: () => void;
  onOpenEditMenuModal: (item: MenuItem) => void;
  onFilterOrders: (
    statusFilter: "ALL" | Order["status"],
    datePreset:
      | "all"
      | "today"
      | "yesterday"
      | "tomorrow"
      | "last7"
      | "last30"
      | "this_month"
  ) => void;
  onRefreshPortal: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const QUICK_TASK_PRESETS: {
  label: string;
  emoji: string;
  prompt: string;
}[] = [
  {
    emoji: "📊",
    label: "Daily Briefing",
    prompt: "Show daily summary",
  },
  {
    emoji: "🔥",
    label: "Prep Confirmed Orders",
    prompt: "Start preparing all confirmed orders",
  },
  {
    emoji: "✅",
    label: "Mark Preparing Ready",
    prompt: "Mark all preparing orders ready",
  },
  {
    emoji: "🍽️",
    label: "+ Add New Dish",
    prompt: "Open Add Menu modal",
  },
  {
    emoji: "🟢",
    label: "Restore Sold-Out",
    prompt: "Make all dishes available",
  },
  {
    emoji: "📦",
    label: "Restock Low Items",
    prompt: "Restock all low stock items",
  },
  {
    emoji: "🔄",
    label: "Sync Square & Clover",
    prompt: "Sync menu with Square and Clover",
  },
  {
    emoji: "📲",
    label: "Send SMS Blast",
    prompt: "Send SMS broadcast: Flash special tonight! Order online for 15% off.",
  },
];

export function OwnerPortalAssistant({
  restaurant,
  menuItems,
  orders,
  isOpen,
  onSetOpen,
  onSelectTab,
  onOpenAddMenuModal,
  onOpenEditMenuModal,
  onFilterOrders,
  onRefreshPortal,
  onNotify,
}: OwnerPortalAssistantProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [convState, setConvState] = useState<OwnerAssistantState>({});

  const activeOrderCount = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled"
  ).length;
  const soldOutCount = menuItems.filter((m) => !m.available).length;
  const lowStockCount =
    restaurant.inventoryConfig?.items?.filter(
      (i) => i.currentStock <= i.reorderPoint
    ).length || 0;

  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: "welcome_owner_ai",
      sender: "assistant",
      text:
        `Hi **${restaurant.ownerName.split(" ")[0]}**! Tell me any task and I'll execute it right away on **${restaurant.name}** — orders, menu items, stock, hours, staff, SMS/email, or POS sync.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      quickReplies: [
        "Check active orders",
        "Start preparing all confirmed orders",
        "Show menu overview",
        "Restock all low stock items",
      ],
    },
  ]);

  const endRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const speakText = useCallback(
    (text: string) => {
      if (
        !voiceEnabled ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const clean = text
          .replace(/\*\*/g, "")
          .replace(/[`>#*-]/g, "")
          .replace(/\n+/g, ". ");
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = 1.03;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore speech errors
      }
    },
    [voiceEnabled]
  );

  const executeUiActions = useCallback(
    async (actions: OwnerUiAction[]) => {
      let shouldRefresh = false;
      for (const act of actions) {
        if (act.type === "switch_tab" && act.tab) {
          onSelectTab(act.tab);
        } else if (act.type === "open_add_menu_modal") {
          onOpenAddMenuModal();
        } else if (act.type === "open_edit_menu_modal" && act.menuItemId) {
          const found = menuItems.find((m) => m.id === act.menuItemId);
          if (found) onOpenEditMenuModal(found);
        } else if (act.type === "filter_orders") {
          onFilterOrders(
            act.orderStatusFilter || "ALL",
            act.orderDatePreset || "all"
          );
        } else if (act.type === "refresh_portal") {
          shouldRefresh = true;
        }
      }
      if (shouldRefresh) {
        await onRefreshPortal();
      }
    },
    [
      menuItems,
      onFilterOrders,
      onOpenAddMenuModal,
      onOpenEditMenuModal,
      onRefreshPortal,
      onSelectTab,
    ]
  );

  const sendCommand = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || busy) return;

      const ownerMsg: AssistantMessage = {
        id: `own_${Date.now()}`,
        sender: "owner",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, ownerMsg]);
      setInput("");
      setBusy(true);

      try {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(
            restaurant.slug
          )}/owner-assistant`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: trimmed, state: convState }),
          }
        );
        const data = await res.json();
        if (res.ok) {
          if (data.state) {
            setConvState(data.state);
          }
          const uiActions: OwnerUiAction[] = data.uiActions || [];
          const executedTasks: string[] = data.executedTasks || [];

          if (uiActions.length > 0) {
            await executeUiActions(uiActions);
          }
          if (executedTasks.length > 0) {
            onNotify(`🤖 AI Agent: ${executedTasks[0]}`);
          }

          const replyMsg: AssistantMessage = {
            id: `ast_${Date.now()}`,
            sender: "assistant",
            text: data.replyText || "Done!",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            executedTasks,
            quickReplies: data.quickReplies || [],
          };
          setMessages((prev) => [...prev, replyMsg]);
          speakText(replyMsg.text);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, convState, executeUiActions, onNotify, restaurant.slug, speakText]
  );

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      sendCommand("Show daily summary");
      return;
    }

    try {
      const rec = new SpeechRecognitionCtor();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || "";
        if (transcript.trim()) {
          sendCommand(transcript.trim());
        }
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <>
      {/* Floating Owner AI Co-Pilot Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => onSetOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-600 px-4 py-3 text-left text-white shadow-2xl shadow-orange-500/30 hover:scale-[1.02] transition border border-white/20"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/30 backdrop-blur-sm">
            <Bot className="h-5 w-5 text-white" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider">
                Owner AI Agent
              </span>
              <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-[10px] font-mono">
                Co-Pilot
              </span>
            </div>
            <p className="text-[11px] text-white/90">
              {activeOrderCount} active orders • {lowStockCount} low stock
            </p>
          </div>
        </button>
      )}

      {/* Slide-Over / Floating Owner Assistant Panel */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-3 top-16 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex w-auto sm:w-[430px] sm:h-[650px] max-h-[86vh] flex-col overflow-hidden rounded-3xl border border-slate-700/90 bg-slate-950/98 text-slate-100 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/50 px-4 py-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-md">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-bold text-white">
                    Platerift Owner AI Agent
                  </h3>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    LIVE
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400">
                  Executes orders, menu, stock, SMS & POS tasks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                className={`rounded-xl border p-2 text-xs transition ${
                  voiceEnabled
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                }`}
                title="Toggle voice speech replies"
              >
                {voiceEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSetOpen(false)}
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Close Owner AI Assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Live Status Strip + 1-Click Quick Task Bar */}
          <div className="border-b border-slate-800/80 bg-slate-900/60 px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-orange-400" /> 1-Click Owner Tasks:
              </span>
              <span className="font-mono text-[10px]">
                {activeOrderCount} Orders • {soldOutCount} 86&apos;d • {lowStockCount} Low Stock
              </span>
            </div>
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {QUICK_TASK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={busy}
                  onClick={() => sendCommand(preset.prompt)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-200 transition disabled:opacity-50"
                >
                  <span>{preset.emoji}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "owner" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === "owner"
                      ? "bg-orange-500 text-white font-medium rounded-br-sm"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm"
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>

                  {/* Executed Tasks Confirmation Badges */}
                  {msg.executedTasks && msg.executedTasks.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t border-slate-800 pt-2">
                      {msg.executedTasks.map((task, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span>{task}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggested Follow-up Action Chips */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.quickReplies.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        disabled={busy}
                        onClick={() => sendCommand(qr)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-[11px] font-medium text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/15 transition"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>{qr}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span className="mt-1 px-1 text-[10px] text-slate-500">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-orange-300 px-2">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>Executing task on your dashboard...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendCommand(input);
            }}
            className="border-t border-slate-800 bg-slate-900/90 p-3 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`shrink-0 rounded-xl border p-2.5 transition ${
                isListening
                  ? "border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:border-orange-500/50 hover:text-white"
              }`}
              title="Speak a task command"
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ask me to do anything (e.g. "86 Margherita", "Restock low items")...'
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-orange-500 p-2.5 text-white hover:bg-orange-600 disabled:opacity-40 transition"
              aria-label="Send command"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

