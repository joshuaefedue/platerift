"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  ShoppingBag,
  Check,
  Radio,
  MessageSquare,
  Headphones,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  MenuItem,
  OrderLineItem,
  OrderType,
  RestaurantTenant,
} from "@/lib/types";
import type {
  AiCartAction,
  AiConversationState,
  AiFulfillmentAction,
} from "@/app/api/restaurants/[slug]/ai-assistant/route";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  speechText?: string;
  timestamp: string;
  suggestedItems?: MenuItem[];
  modifierPromptItem?: MenuItem | null;
  quickReplies?: string[];
  viaVoice?: boolean;
}

interface TenantAiChatbotProps {
  restaurant: RestaurantTenant;
  menuItems: MenuItem[];
  cart: OrderLineItem[];
  orderType: OrderType;
  brandColor: string;
  onAddItemToCart: (
    item: MenuItem,
    modifiers: { groupName: string; optionLabel: string; priceDelta: number }[],
    quantity?: number
  ) => void;
  onClearCart: () => void;
  onChangeOrderType: (type: OrderType) => void;
  onSelectSchedule: (
    timing: "asap" | "scheduled",
    date?: string,
    time?: string
  ) => void;
  onOpenCheckout: () => void;
}

function getPersonaDefaults(restaurant: RestaurantTenant) {
  const custom = restaurant.features.aiAssistant;
  if (custom?.botName) {
    return {
      botName: custom.botName,
      botRoleTitle:
        custom.botRoleTitle || `${restaurant.cuisine} AI Ordering Concierge`,
      welcomeMessage:
        custom.welcomeMessage ||
        `Welcome to **${restaurant.name}**! I'm **${custom.botName}**. I know every dish, dietary tag, and customization option on our ${restaurant.cuisine} menu. Tell me what you're craving by voice or text!`,
    };
  }
  if (restaurant.slug.includes("bella")) {
    return {
      botName: "Chef Marco AI",
      botRoleTitle: "Wood-Fired Sommelier & Ordering Concierge",
      welcomeMessage: `Buonasera! Welcome to **${restaurant.name}**. I'm **Chef Marco AI** — I know all of our wood-fired pizzas, handmade pastas, crust options, and artisanal toppings. Ask me anything or order by voice or text!`,
    };
  }
  if (restaurant.slug.includes("sakura")) {
    return {
      botName: "Sensei Kenji AI",
      botRoleTitle: "Omakase Master & Sushi Ordering Concierge",
      welcomeMessage: `Irasshaimase! Welcome to **${restaurant.name}**. I'm **Sensei Kenji AI** — I can guide you through our Omakase boxes, signature rolls, ramen spice levels, and pickup time slots by voice or text!`,
    };
  }
  if (restaurant.slug.includes("fuego")) {
    return {
      botName: "Mateo AI",
      botRoleTitle: "Taquero & Craft Agave Ordering Concierge",
      welcomeMessage: `¡Hola! Welcome to **${restaurant.name}**. I'm **Mateo AI** — I know all our street tacos, house salsa heat levels, and gluten-free corn tortilla options. Order with me by voice or text!`,
    };
  }
  return {
    botName: `${restaurant.name.split(" ")[0]} Concierge AI`,
    botRoleTitle: `${restaurant.cuisine} Voice & Text Ordering Assistant`,
    welcomeMessage: `Welcome to **${restaurant.name}**! I'm your AI Ordering Concierge. I understand every menu category, dish modifier, and fulfillment option. How can I help you build your order today?`,
  };
}

export default function TenantAiChatbot({
  restaurant,
  menuItems,
  cart,
  orderType,
  brandColor,
  onAddItemToCart,
  onClearCart,
  onChangeOrderType,
  onSelectSchedule,
  onOpenCheckout,
}: TenantAiChatbotProps) {
  const persona = getPersonaDefaults(restaurant);
  const aiConfig = restaurant.features.aiAssistant;

  const [isOpen, setIsOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState<"chat" | "voice_orb">(
    "chat"
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convState, setConvState] = useState<AiConversationState>({
    stage: "browsing",
  });

  // Voice Input (STT) & Output (TTS) State
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState<boolean>(
    aiConfig?.autoSpeakReplies ?? true
  );
  const [handsFreeLoop, setHandsFreeLoop] = useState<boolean>(
    aiConfig?.handsFreeContinuousMode ?? false
  );
  const [speechSupported, setSpeechSupported] = useState(false);

  // Interactive inline modifier selection state when a dish with modifiers is being configured
  const [inlineModSelections, setInlineModSelections] = useState<
    Record<string, { optionLabel: string; priceDelta: number }>
  >({});
  const [inlineModQuantity, setInlineModQuantity] = useState(1);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const popular = menuItems.filter((m) => m.available && m.popular).slice(0, 3);
    const categories = Array.from(new Set(menuItems.map((m) => m.category)));
    return [
      {
        id: "msg_welcome",
        sender: "bot",
        text: persona.welcomeMessage,
        speechText: persona.welcomeMessage.replace(/\*\*/g, ""),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        suggestedItems: popular.length > 0 ? popular : menuItems.slice(0, 3),
        quickReplies: [
          ...categories.map((c) => `Show ${c}`),
          "Gluten-Free & Vegetarian",
          "Pickup Hours & Time Slots",
        ],
      },
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const sendMessageRef = useRef<
    ((text: string, viaVoice?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSR =
        "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
      setSpeechSupported(hasSR);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, interimTranscript]);

  // Text-to-Speech (TTS) helper
  const speakResponse = useCallback(
    (textToSpeak: string, onEndCallback?: () => void) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        (!voiceOutputEnabled && assistantMode !== "voice_orb")
      ) {
        onEndCallback?.();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const cleanText = textToSpeak
          .replace(/\*\*/g, "")
          .replace(/[_#•◦]/g, "")
          .replace(/\n+/g, ". ");

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = aiConfig?.voiceLanguage || "en-US";
        utterance.rate = aiConfig?.voiceRate || 1.02;
        utterance.pitch = aiConfig?.voicePitch || 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          onEndCallback?.();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          onEndCallback?.();
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
        onEndCallback?.();
      }
    },
    [
      voiceOutputEnabled,
      assistantMode,
      aiConfig?.voiceLanguage,
      aiConfig?.voiceRate,
      aiConfig?.voicePitch,
    ]
  );

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Start / Stop Voice Recognition (STT)
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    stopSpeaking();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      // Fallback simulated voice prompt if browser doesn't expose Web Speech API
      const sampleVoicePrompts = [
        `Order 1 ${menuItems.find((m) => m.available)?.name || "special"}`,
        "What vegetarian and gluten-free options do you have?",
        "What are your available pickup time slots?",
      ];
      const randomPrompt =
        sampleVoicePrompts[
          Math.floor(Math.random() * sampleVoicePrompts.length)
        ];
      sendMessageRef.current?.(randomPrompt, true);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = aiConfig?.voiceLanguage || "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      let finalCaptured = "";

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalCaptured += transcript;
          } else {
            interim += transcript;
          }
        }
        setInterimTranscript(finalCaptured || interim);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        if (finalCaptured.trim()) {
          sendMessageRef.current?.(finalCaptured.trim(), true);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [aiConfig?.voiceLanguage, menuItems]);

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  };

  // Send message to tenant AI Assistant backend
  const handleSendMessage = useCallback(
    async (rawText: string, viaVoice = false) => {
      const trimmed = rawText.trim();
      if (!trimmed || busy) return;

      const userMsg: ChatMessage = {
        id: `usr_${Date.now()}`,
        sender: "user",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        viaVoice,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setBusy(true);

      try {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(
            restaurant.slug
          )}/ai-assistant`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              cart,
              orderType,
              state: convState,
            }),
          }
        );

        const data = await res.json();
        if (res.ok) {
          // Execute any cart actions returned by the AI bot
          const actions: AiCartAction[] = data.cartActions || [];
          for (const act of actions) {
            if (act.type === "add_item" && act.item) {
              onAddItemToCart(
                act.item,
                act.modifiers || [],
                act.quantity || 1
              );
            } else if (act.type === "clear_cart") {
              onClearCart();
            }
          }

          // Execute any fulfillment / scheduling / checkout actions
          const fAct: AiFulfillmentAction = data.fulfillmentActions || {};
          if (fAct.orderType) {
            onChangeOrderType(fAct.orderType);
          }
          if (fAct.timing) {
            onSelectSchedule(
              fAct.timing,
              fAct.scheduledDate,
              fAct.scheduledTime
            );
          }
          if (fAct.openCheckoutModal) {
            setTimeout(() => {
              onOpenCheckout();
            }, 600);
          }

          if (data.state) {
            setConvState(data.state);
          }

          // If the bot is prompting the customer to choose modifiers for a dish, initialize default modifier selections
          if (data.modifierPromptItem) {
            const promptDish: MenuItem = data.modifierPromptItem;
            const defaults: Record<
              string,
              { optionLabel: string; priceDelta: number }
            > = {};
            for (const grp of promptDish.modifiers || []) {
              if (grp.options.length > 0) {
                defaults[grp.name] = {
                  optionLabel: grp.options[0].label,
                  priceDelta: grp.options[0].priceDelta,
                };
              }
            }
            setInlineModSelections(defaults);
            setInlineModQuantity(data.state?.pendingQuantity || 1);
          }

          const botMsg: ChatMessage = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: data.replyText,
            speechText: data.speechText || data.replyText,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            suggestedItems: data.suggestedItems || [],
            modifierPromptItem: data.modifierPromptItem || null,
            quickReplies: data.quickReplies || [],
          };

          setMessages((prev) => [...prev, botMsg]);

          if (viaVoice || voiceOutputEnabled || assistantMode === "voice_orb") {
            speakResponse(botMsg.speechText || botMsg.text, () => {
              if (handsFreeLoop && assistantMode === "voice_orb") {
                startListening();
              }
            });
          }
        }
      } catch (err) {
        console.error("AI Chatbot error:", err);
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      restaurant.slug,
      cart,
      orderType,
      convState,
      onAddItemToCart,
      onClearCart,
      onChangeOrderType,
      onSelectSchedule,
      onOpenCheckout,
      voiceOutputEnabled,
      assistantMode,
      speakResponse,
      handsFreeLoop,
      startListening,
    ]
  );

  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Confirm inline modifier selection card directly inside chat
  const handleConfirmInlineModifiers = (dish: MenuItem) => {
    const modArray = Object.entries(inlineModSelections).map(
      ([groupName, val]) => ({
        groupName,
        optionLabel: val.optionLabel,
        priceDelta: val.priceDelta,
      })
    );

    onAddItemToCart(dish, modArray, inlineModQuantity);
    setConvState({
      stage: "choosing_fulfillment",
      pendingItemId: null,
      pendingQuantity: 1,
      selectedModifiers: {},
    });

    const modDelta = modArray.reduce((s, m) => s + m.priceDelta, 0);
    const unitTotal = ((dish.price + modDelta) * inlineModQuantity).toFixed(2);
    const modNames =
      modArray.length > 0
        ? ` (${modArray.map((m) => m.optionLabel).join(", ")})`
        : "";

    const confirmMsg: ChatMessage = {
      id: `bot_mod_ok_${Date.now()}`,
      sender: "bot",
      text: `✅ Added **${inlineModQuantity}× ${dish.name}**${modNames} — **$${unitTotal}** to your live cart!\n\nWould you like to add another dish, select a pickup time slot, or proceed to checkout?`,
      speechText: `Added ${inlineModQuantity} ${dish.name} to your cart. Ready to checkout or add another dish?`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      quickReplies: [
        "Proceed to Checkout",
        "Pickup Hours & Time Slots",
        "Show Full Menu",
      ],
    };

    setMessages((prev) => [...prev, confirmMsg]);
    if (voiceOutputEnabled || assistantMode === "voice_orb") {
      speakResponse(confirmMsg.speechText || confirmMsg.text);
    }
  };

  if (restaurant.features.aiChatbot === false) {
    return null;
  }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartSubtotal = cart.reduce((s, c) => s + c.itemTotal, 0);
  const latestBotMessage =
    [...messages].reverse().find((m) => m.sender === "bot") || messages[0];

  // Format simple markdown bold & bullets cleanly
  const renderFormattedText = (raw: string) => {
    return raw.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className={line.trim() === "" ? "h-2" : "leading-relaxed"}>
          {parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={j} className="font-semibold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Tenant-Branded AI Concierge & Voice Assistant Trigger */}
      {!isOpen && (
        <div className="fixed bottom-20 left-3 sm:left-6 lg:bottom-6 z-40 flex items-center gap-2 max-w-[calc(100vw-1.5rem)]">
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setAssistantMode("chat");
            }}
            style={{
              borderColor: brandColor,
            }}
            className="group flex min-w-0 items-center gap-2.5 sm:gap-3 rounded-2xl border-2 bg-zinc-950/95 px-3 py-2.5 sm:px-4 sm:py-3 text-left text-white shadow-2xl backdrop-blur-xl transition hover:scale-[1.02]"
          >
            <div
              style={{ backgroundColor: brandColor }}
              className="relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl text-lg sm:text-xl text-black shadow-lg"
            >
              <span>{restaurant.logoEmoji}</span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-black ring-2 ring-zinc-950">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="min-w-0 pr-0.5 sm:pr-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-bold tracking-wide text-white">
                  {persona.botName}
                </span>
                <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-300">
                  AI + Voice
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-zinc-400">
                Menu, Options & Guided Voice Ordering
              </p>
              <p className="sm:hidden truncate text-[10px] text-zinc-400">
                Tap for AI & Voice Order
              </p>
            </div>
          </button>

          {/* Direct 1-Click Launch into Hands-Free Voice Assistant Mode */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setAssistantMode("voice_orb");
              setVoiceOutputEnabled(true);
              setTimeout(() => {
                startListening();
              }, 300);
            }}
            style={{ backgroundColor: brandColor, color: "#000" }}
            className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl shadow-2xl transition hover:scale-105"
            title={`Start Hands-Free Voice Ordering with ${persona.botName}`}
          >
            <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
      )}

      {/* Expanded Tenant AI Chat & Voice Assistant Drawer / Window */}
      {isOpen && (
        <div className="fixed inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-4 sm:left-4 z-50 flex h-[calc(100dvh-1rem)] max-h-[88dvh] sm:h-[640px] w-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800 bg-[#0b0d12]/98 text-zinc-100 shadow-2xl backdrop-blur-2xl">
          {/* Top Branded Header */}
          <div
            style={{
              borderBottomColor: `${brandColor}40`,
            }}
            className="border-b bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  style={{ backgroundColor: brandColor }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-black shadow"
                >
                  {restaurant.logoEmoji}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-bold text-white">
                      {persona.botName}
                    </h3>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="truncate text-[10px] font-mono text-zinc-400">
                    {persona.botRoleTitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Toggle Chat vs Voice Assistant Mode */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode =
                      assistantMode === "chat" ? "voice_orb" : "chat";
                    setAssistantMode(nextMode);
                    if (nextMode === "voice_orb") {
                      setVoiceOutputEnabled(true);
                    }
                  }}
                  style={
                    assistantMode === "voice_orb"
                      ? { backgroundColor: brandColor, color: "#000" }
                      : undefined
                  }
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-mono uppercase transition ${
                    assistantMode === "voice_orb"
                      ? "border-transparent font-bold"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                  }`}
                  title="Switch between Text Chat and Hands-Free Voice Assistant"
                >
                  <Headphones className="h-3.5 w-3.5" />
                  {assistantMode === "voice_orb" ? "Voice Mode" : "Voice UI"}
                </button>

                {/* Mute / Unmute TTS */}
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking) stopSpeaking();
                    setVoiceOutputEnabled((v) => !v);
                  }}
                  className={`rounded-xl border p-1.5 transition ${
                    voiceOutputEnabled
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={
                    voiceOutputEnabled
                      ? "Voice Replies ON (Click to mute)"
                      : "Voice Replies Muted (Click to enable)"
                  }
                >
                  {voiceOutputEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopListening();
                    stopSpeaking();
                    setIsOpen(false);
                  }}
                  className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Guided Ordering Progress Bar */}
            <div className="mt-3 flex items-center justify-between gap-1 rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-2.5 py-1.5 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-zinc-300">
                <Bot className="h-3 w-3 text-emerald-400" />
                <span>{menuItems.filter((m) => m.available).length} Dishes</span>
              </span>
              <span className="text-zinc-600">→</span>
              <span className="uppercase text-amber-300">{orderType}</span>
              <span className="text-zinc-600">→</span>
              <button
                type="button"
                onClick={onOpenCheckout}
                className="flex items-center gap-1 font-bold text-emerald-400 hover:underline"
              >
                <ShoppingBag className="h-3 w-3" />
                <span>
                  {cartCount} item(s) • ${cartSubtotal.toFixed(2)}
                </span>
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* MODE A: EXPANDED HANDS-FREE VOICE ASSISTANT ORB INTERFACE       */}
          {/* =============================================================== */}
          {assistantMode === "voice_orb" ? (
            <div className="flex flex-1 flex-col items-center justify-between p-6 text-center bg-gradient-to-b from-[#0b0d12] via-zinc-950 to-[#0b0d12]">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1">
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                  <span>
                    {restaurant.integrationsConfig?.vapi?.enabled !== false
                      ? "VAPI VOICE AI + BROWSER MIC"
                      : (aiConfig?.voiceProvider || "browser_speech")
                          .replace("_", " ")
                          .toUpperCase()}
                  </span>
                </span>

                {restaurant.integrationsConfig?.vapi?.inboundPhoneNumber && (
                  <a
                    href={`tel:${restaurant.integrationsConfig.vapi.inboundPhoneNumber}`}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/25"
                  >
                    📞 Call Vapi AI:{" "}
                    {restaurant.integrationsConfig.vapi.inboundPhoneNumber}
                  </a>
                )}

                <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                  <input
                    type="checkbox"
                    checked={handsFreeLoop}
                    onChange={(e) => setHandsFreeLoop(e.target.checked)}
                    className="rounded border-zinc-700"
                  />
                  <span>Hands-Free Auto-Listen</span>
                </label>
              </div>

              {/* Animated Reactive Voice Orb */}
              <div className="my-auto flex flex-col items-center space-y-5">
                <div className="relative flex items-center justify-center">
                  {/* Outer pulsing aura rings */}
                  <div
                    style={{
                      backgroundColor: brandColor,
                      opacity: isListening || isSpeaking ? 0.28 : 0.1,
                    }}
                    className={`absolute h-44 w-44 rounded-full blur-xl transition-all duration-500 ${
                      isListening || isSpeaking ? "scale-125 animate-pulse" : ""
                    }`}
                  />
                  <div
                    style={{
                      borderColor: brandColor,
                    }}
                    className={`absolute h-36 w-36 rounded-full border-2 opacity-40 transition-all duration-300 ${
                      isListening
                        ? "scale-110 animate-ping"
                        : isSpeaking
                        ? "scale-105 animate-pulse"
                        : ""
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      isListening ? stopListening() : startListening()
                    }
                    style={{
                      backgroundColor: isListening ? "#ef4444" : brandColor,
                      color: isListening ? "#fff" : "#000",
                    }}
                    className="relative z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full shadow-2xl transition hover:scale-105"
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-9 w-9 animate-bounce" />
                        <span className="mt-1 font-mono text-[10px] font-bold uppercase">
                          Listening...
                        </span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-9 w-9" />
                        <span className="mt-1 font-mono text-[10px] font-bold uppercase">
                          Tap to Speak
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Voice Status & Spoken Transcript */}
                <div className="max-w-xs space-y-2">
                  <div className="text-xs font-mono uppercase tracking-widest text-amber-300">
                    {isListening
                      ? "🎙️ Listening to your order..."
                      : isSpeaking
                      ? `🔊 ${persona.botName} is speaking...`
                      : busy
                      ? "⚡ Processing your request..."
                      : `🎙️ Ready — Speak to ${persona.botName}`}
                  </div>

                  {interimTranscript ? (
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-sm font-medium text-emerald-200">
                      &ldquo;{interimTranscript}&rdquo;
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 text-xs text-zinc-300 text-left space-y-1">
                      {renderFormattedText(latestBotMessage.text)}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Voice Simulation / Command Chips in Voice Mode */}
              <div className="w-full space-y-2.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Or tap a voice command to test immediately:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {(
                    latestBotMessage.quickReplies || [
                      "What's popular today?",
                      "Gluten-Free Options",
                      "Available Pickup Times",
                      "Proceed to Checkout",
                    ]
                  )
                    .slice(0, 4)
                    .map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        onClick={() => handleSendMessage(qr, true)}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-zinc-600 hover:text-white transition"
                      >
                        🗣️ &ldquo;{qr}&rdquo;
                      </button>
                    ))}
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
                  <button
                    type="button"
                    onClick={() => setAssistantMode("chat")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Switch to Text & Card View
                  </button>
                  {cartCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenCheckout();
                      }}
                      style={{ backgroundColor: brandColor, color: "#000" }}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold shadow"
                    >
                      <span>Checkout (${cartSubtotal.toFixed(2)})</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* MODE B: INTERACTIVE CONVERSATIONAL CHAT + DISH & MODIFIER CARDS */
            /* =============================================================== */
            <>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-mono text-zinc-500">
                      <span>
                        {msg.sender === "bot"
                          ? `${restaurant.logoEmoji} ${persona.botName}`
                          : msg.viaVoice
                          ? "🎙️ You (Voice)"
                          : "You"}
                      </span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      style={
                        msg.sender === "user"
                          ? { backgroundColor: brandColor, color: "#000" }
                          : undefined
                      }
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs shadow ${
                        msg.sender === "user"
                          ? "font-semibold rounded-br-sm"
                          : "border border-zinc-800/90 bg-zinc-900/90 text-zinc-200 rounded-bl-sm space-y-1"
                      }`}
                    >
                      {msg.sender === "user" ? (
                        <p>{msg.text}</p>
                      ) : (
                        renderFormattedText(msg.text)
                      )}
                    </div>

                    {/* Interactive Inline Modifier Configurator Card (When Bot Walks Customer Through Dish Options) */}
                    {msg.sender === "bot" && msg.modifierPromptItem && (
                      <div className="mt-2.5 w-full rounded-2xl border border-amber-500/40 bg-zinc-950 p-3.5 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-amber-300">
                              Customize Dish Options
                            </span>
                            <h4 className="text-xs font-bold text-white">
                              {msg.modifierPromptItem.name} ($
                              {msg.modifierPromptItem.price.toFixed(2)})
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setInlineModQuantity((q) => Math.max(1, q - 1))
                              }
                              className="h-6 w-6 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-bold text-white"
                            >
                              -
                            </button>
                            <span className="font-mono text-xs font-bold text-white px-1">
                              {inlineModQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setInlineModQuantity((q) => q + 1)}
                              className="h-6 w-6 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-bold text-white"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {msg.modifierPromptItem.modifiers.map((group) => (
                          <div key={group.name} className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-zinc-200">
                                {group.name}
                              </span>
                              <span className="font-mono text-[9px] uppercase text-zinc-400">
                                {group.required ? "Required" : "Optional"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {group.options.map((opt) => {
                                const isSel =
                                  inlineModSelections[group.name]
                                    ?.optionLabel === opt.label;
                                return (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() =>
                                      setInlineModSelections((prev) => ({
                                        ...prev,
                                        [group.name]: {
                                          optionLabel: opt.label,
                                          priceDelta: opt.priceDelta,
                                        },
                                      }))
                                    }
                                    style={
                                      isSel
                                        ? {
                                            backgroundColor: brandColor,
                                            color: "#000",
                                          }
                                        : undefined
                                    }
                                    className={`rounded-xl border px-2.5 py-1 text-[11px] transition ${
                                      isSel
                                        ? "border-transparent font-bold shadow"
                                        : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                                    }`}
                                  >
                                    {opt.label}
                                    {opt.priceDelta > 0
                                      ? ` (+$${opt.priceDelta.toFixed(2)})`
                                      : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmInlineModifiers(
                              msg.modifierPromptItem!
                            )
                          }
                          style={{ backgroundColor: brandColor, color: "#000" }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold uppercase tracking-wider shadow-lg transition hover:opacity-95"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>
                            Add {inlineModQuantity}× to Order ($
                            {(
                              (msg.modifierPromptItem.price +
                                Object.values(inlineModSelections).reduce(
                                  (s, m) => s + m.priceDelta,
                                  0
                                )) *
                              inlineModQuantity
                            ).toFixed(2)}
                            )
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Suggested Menu Item Cards */}
                    {msg.sender === "bot" &&
                      msg.suggestedItems &&
                      msg.suggestedItems.length > 0 && (
                        <div className="mt-2.5 grid w-full grid-cols-1 gap-2">
                          {msg.suggestedItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2.5 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-2.5 hover:border-zinc-700 transition"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-bold text-white">
                                    {item.name}
                                  </span>
                                  <span
                                    style={{ color: brandColor }}
                                    className="font-mono text-xs font-bold shrink-0"
                                  >
                                    ${item.price.toFixed(2)}
                                  </span>
                                </div>
                                <p className="truncate text-[10px] text-zinc-400">
                                  {item.description}
                                </p>
                                {item.modifiers &&
                                  item.modifiers.length > 0 && (
                                    <p className="mt-0.5 truncate font-mono text-[9px] text-amber-300/90">
                                      Options:{" "}
                                      {item.modifiers
                                        .map((g) => g.name)
                                        .join(", ")}
                                    </p>
                                  )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleSendMessage(`Order ${item.name}`)
                                }
                                style={{
                                  backgroundColor: brandColor,
                                  color: "#000",
                                }}
                                className="shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider shadow transition hover:opacity-90"
                              >
                                {item.modifiers && item.modifiers.length > 0
                                  ? "Options +"
                                  : "+ Add"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Quick Reply Chips */}
                    {msg.sender === "bot" &&
                      msg.quickReplies &&
                      msg.quickReplies.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.quickReplies.map((qr) => (
                            <button
                              key={qr}
                              type="button"
                              onClick={() => handleSendMessage(qr)}
                              className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition"
                            >
                              {qr}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))}

                {busy && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>{persona.botName} is thinking...</span>
                  </div>
                )}

                {interimTranscript && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
                    🎙️ Hearing: &ldquo;{interimTranscript}&rdquo;
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Bar with Voice Mic & Text Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(input, false);
                }}
                className="border-t border-zinc-800/90 bg-zinc-950 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  {/* Push-to-Talk / Voice Input Button */}
                  <button
                    type="button"
                    onClick={() =>
                      isListening ? stopListening() : startListening()
                    }
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                      isListening
                        ? "border-rose-500 bg-rose-500 text-white animate-pulse"
                        : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white"
                    }`}
                    title={
                      speechSupported
                        ? "Speak your order or question"
                        : "Simulate voice order"
                    }
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
                    placeholder={`Ask ${persona.botName} or say "Order Margherita"...`}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || busy}
                    style={{ backgroundColor: brandColor, color: "#000" }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow transition disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between px-1 text-[10px] text-zinc-500">
                  <button
                    type="button"
                    onClick={() => setAssistantMode("voice_orb")}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"
                  >
                    <Headphones className="h-3 w-3 text-emerald-400" />
                    <span>Open Full Voice Assistant Orb</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConvState({ stage: "browsing" });
                      handleSendMessage("Show Full Menu");
                    }}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Guide</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
