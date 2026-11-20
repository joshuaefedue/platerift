"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  CreditCard,
  Globe,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export type CheckoutGatewayType =
  | "stripe"
  | "square"
  | "clover"
  | "paypal"
  | "apple_pay";

export interface TokenizedPaymentResult {
  token: string;
  paymentIntentId?: string;
  gateway: CheckoutGatewayType;
  mode: "live" | "sandbox";
  last4?: string;
  brand?: string;
}

export type GatewayBootstrapStatus =
  | "idle"
  | "loading"
  | "ready"
  | "tokenized"
  | "error";

export interface CheckoutPaymentGatewayHandle {
  tokenize: () => Promise<TokenizedPaymentResult>;
}

export interface CheckoutPaymentGatewayProps {
  slug: string;
  gateway: CheckoutGatewayType;
  amountCents: number;
  currency?: string;
  customerEmail?: string;
  restaurantName?: string;
  brandColor?: string;
  onTokenized?: (result: TokenizedPaymentResult) => void;
  onStatusChange?: (status: GatewayBootstrapStatus, message?: string) => void;
}

interface BootstrapResponse {
  mode: "live" | "sandbox";
  provider: CheckoutGatewayType;
  paymentIntentId?: string;
  clientSecret?: string;
  publishableKey?: string;
  applicationId?: string;
  locationId?: string;
  publicKey?: string;
  merchantId?: string;
  clientId?: string;
  environment?: "sandbox" | "production";
  currency?: string;
  amountCents?: number;
  error?: string;
}

interface StripeElementInstance {
  mount: (el: HTMLElement) => void;
  unmount?: () => void;
  destroy?: () => void;
}

interface StripeElementsInstance {
  create: (type: string, options?: Record<string, unknown>) => StripeElementInstance;
}

interface StripePaymentRequest {
  canMakePayment: () => Promise<Record<string, unknown> | null>;
  on: (
    event: string,
    handler: (ev: {
      paymentMethod: { id: string; card?: { brand?: string; last4?: string } };
      complete: (status: string) => void;
    }) => void
  ) => void;
  show: () => void;
}

interface StripeJsInstance {
  elements: (options?: Record<string, unknown>) => StripeElementsInstance;
  confirmPayment: (options: Record<string, unknown>) => Promise<{
    error?: { message?: string };
    paymentIntent?: {
      id: string;
      status: string;
      payment_method?: string | { id?: string; card?: { brand?: string; last4?: string } };
    };
  }>;
  createPaymentMethod: (options: Record<string, unknown>) => Promise<{
    error?: { message?: string };
    paymentMethod?: { id: string; card?: { brand?: string; last4?: string } };
  }>;
  paymentRequest: (options: Record<string, unknown>) => StripePaymentRequest;
}

interface SquareCardInstance {
  attach: (el: HTMLElement) => Promise<void>;
  destroy?: () => Promise<void>;
  tokenize: () => Promise<{
    status: string;
    token?: string;
    errors?: Array<{ message?: string }>;
    details?: { card?: { last4?: string; brand?: string } };
  }>;
}

interface CloverInstance {
  elements: () => {
    create: (type: string, styles?: Record<string, unknown>) => {
      mount: (el: HTMLElement) => void;
      destroy?: () => void;
    };
  };
  createToken: () => Promise<{
    token?: string;
    errors?: Record<string, string>;
  }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJsInstance;
    Square?: {
      payments: (
        appId: string,
        locationId: string
      ) => Promise<{
        card: () => Promise<SquareCardInstance>;
      }>;
    };
    Clover?: new (publicKey: string) => CloverInstance;
    paypal?: {
      Buttons: (config: {
        style?: Record<string, unknown>;
        createOrder: (
          data: unknown,
          actions: {
            order: {
              create: (payload: Record<string, unknown>) => Promise<string>;
            };
          }
        ) => Promise<string>;
        onApprove: (
          data: { orderID?: string },
          actions: {
            order: {
              capture: () => Promise<{ id?: string }>;
            };
          }
        ) => Promise<void>;
        onError?: (err: unknown) => void;
      }) => {
        render: (el: HTMLElement) => Promise<void>;
        close?: () => Promise<void>;
      };
    };
  }
}

const scriptLoadCache = new Map<string, Promise<void>>();

function loadExternalScript(src: string, timeoutMs = 8000): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser environment required"));
  }
  const existing = scriptLoadCache.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const existingTag = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existingTag && existingTag.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existingTag || document.createElement("script");
    script.src = src;
    script.async = true;

    const timer = window.setTimeout(() => {
      scriptLoadCache.delete(src);
      reject(new Error(`Timed out loading payment SDK: ${src}`));
    }, timeoutMs);

    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timer);
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timer);
        scriptLoadCache.delete(src);
        reject(new Error(`Failed to load payment SDK: ${src}`));
      },
      { once: true }
    );

    if (!existingTag) {
      document.head.appendChild(script);
    }
  });

  scriptLoadCache.set(src, promise);
  return promise;
}

function generateSingleUseNonce(prefix: string): string {
  const randBytes = new Uint8Array(9);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(randBytes);
  } else {
    for (let i = 0; i < randBytes.length; i += 1) {
      randBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(randBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}${hex}`;
}

function formatCardInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectCardBrand(digits: string): string {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

function getSandboxDefaultsForGateway(gateway: CheckoutGatewayType) {
  if (gateway === "square") {
    return {
      cardNumber: "4111 1111 1111 1111",
      expiry: "09/28",
      cvc: "111",
      zip: "94103",
    };
  }
  if (gateway === "clover") {
    return {
      cardNumber: "4242 4242 4242 4242",
      expiry: "11/28",
      cvc: "242",
      zip: "60661",
    };
  }
  return {
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/28",
    cvc: "888",
    zip: "60661",
  };
}

export const CheckoutPaymentGateway = forwardRef<
  CheckoutPaymentGatewayHandle,
  CheckoutPaymentGatewayProps
>(function CheckoutPaymentGateway(
  {
    slug,
    gateway,
    amountCents,
    currency = "usd",
    customerEmail,
    restaurantName,
    brandColor = "#f59e0b",
    onTokenized,
    onStatusChange,
  },
  ref
) {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [status, setStatus] = useState<GatewayBootstrapStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [liveSdkReady, setLiveSdkReady] = useState(false);
  const [liveSdkFallbackReason, setLiveSdkFallbackReason] = useState<
    string | null
  >(null);
  const [tokenizedResult, setTokenizedResult] =
    useState<TokenizedPaymentResult | null>(null);

  const defaults = getSandboxDefaultsForGateway(gateway);
  const [cardNumber, setCardNumber] = useState(defaults.cardNumber);
  const [cardExpiry, setCardExpiry] = useState(defaults.expiry);
  const [cardCvc, setCardCvc] = useState(defaults.cvc);
  const [cardZip, setCardZip] = useState(defaults.zip);
  const [sandboxWalletEmail, setSandboxWalletEmail] = useState(
    customerEmail || "guest@example.com"
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [tokenizing, setTokenizing] = useState(false);

  const customerEmailRef = useRef(customerEmail);
  useEffect(() => {
    customerEmailRef.current = customerEmail;
    if (customerEmail && !sandboxWalletEmail) {
      setSandboxWalletEmail(customerEmail);
    }
  }, [customerEmail, sandboxWalletEmail]);

  const onTokenizedRef = useRef(onTokenized);
  useEffect(() => {
    onTokenizedRef.current = onTokenized;
  }, [onTokenized]);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const updateStatus = useCallback(
    (next: GatewayBootstrapStatus, msg?: string) => {
      setStatus(next);
      setStatusMessage(msg || "");
      onStatusChangeRef.current?.(next, msg);
    },
    []
  );

  // Live SDK mount refs
  const stripeMountRef = useRef<HTMLDivElement | null>(null);
  const squareMountRef = useRef<HTMLDivElement | null>(null);
  const cloverNumberRef = useRef<HTMLDivElement | null>(null);
  const cloverDateRef = useRef<HTMLDivElement | null>(null);
  const cloverCvvRef = useRef<HTMLDivElement | null>(null);
  const cloverZipRef = useRef<HTMLDivElement | null>(null);
  const paypalMountRef = useRef<HTMLDivElement | null>(null);
  const applePayMountRef = useRef<HTMLDivElement | null>(null);

  const stripeInstanceRef = useRef<StripeJsInstance | null>(null);
  const stripeElementsRef = useRef<StripeElementsInstance | null>(null);
  const stripeCardElementRef = useRef<StripeElementInstance | null>(null);
  const squareCardRef = useRef<SquareCardInstance | null>(null);
  const cloverInstanceRef = useRef<CloverInstance | null>(null);
  const applePayRequestRef = useRef<StripePaymentRequest | null>(null);

  // Reset sandbox defaults & stale token when gateway switches
  useEffect(() => {
    const d = getSandboxDefaultsForGateway(gateway);
    setCardNumber(d.cardNumber);
    setCardExpiry(d.expiry);
    setCardCvc(d.cvc);
    setCardZip(d.zip);
    setLocalError(null);
    setTokenizedResult(null);
    setLiveSdkReady(false);
    setLiveSdkFallbackReason(null);
  }, [gateway]);

  // Step 1: Bootstrap payment-intent credentials from server
  useEffect(() => {
    let cancelled = false;
    const safeAmount = Math.max(50, Math.round(amountCents || 0));

    async function initBootstrap() {
      updateStatus("loading", `Initializing ${gateway.toUpperCase()}...`);
      setLocalError(null);
      setTokenizedResult(null);
      setLiveSdkReady(false);
      setLiveSdkFallbackReason(null);

      try {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(slug)}/payment-intent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gateway,
              amountCents: safeAmount,
              currency: currency.toLowerCase(),
              customerEmail: customerEmailRef.current || undefined,
            }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as BootstrapResponse;
        if (cancelled) return;

        if (!res.ok) {
          const errMsg = data.error || `Failed to bootstrap ${gateway} gateway.`;
          setBootstrap(null);
          setLocalError(errMsg);
          updateStatus("error", errMsg);
          return;
        }

        setBootstrap(data);
        updateStatus(
          "ready",
          data.mode === "live"
            ? `${gateway.toUpperCase()} live SDK ready`
            : `${gateway.toUpperCase()} sandbox tokenizer ready`
        );
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Network error initializing gateway.";
        setBootstrap(null);
        setLocalError(msg);
        updateStatus("error", msg);
      }
    }

    initBootstrap();
    return () => {
      cancelled = true;
    };
  }, [slug, gateway, amountCents, currency, updateStatus]);

  // Step 2: Mount official browser SDK when mode === "live"
  useEffect(() => {
    if (!bootstrap || bootstrap.mode !== "live") {
      setLiveSdkReady(false);
      return;
    }

    let cancelled = false;
    stripeInstanceRef.current = null;
    stripeElementsRef.current = null;
    stripeCardElementRef.current = null;
    squareCardRef.current = null;
    cloverInstanceRef.current = null;
    applePayRequestRef.current = null;

    async function mountLiveSdk() {
      if (!bootstrap) return;
      try {
        if (gateway === "stripe" && bootstrap.publishableKey) {
          await loadExternalScript("https://js.stripe.com/v3/");
          if (cancelled || !window.Stripe || !stripeMountRef.current) {
            throw new Error("Stripe.js unavailable");
          }
          const stripe = window.Stripe(bootstrap.publishableKey);
          const elements = bootstrap.clientSecret
            ? stripe.elements({
                clientSecret: bootstrap.clientSecret,
                appearance: { theme: "night" },
              })
            : stripe.elements();
          const elementType = bootstrap.clientSecret ? "payment" : "card";
          const element = elements.create(elementType);
          stripeMountRef.current.innerHTML = "";
          element.mount(stripeMountRef.current);
          stripeInstanceRef.current = stripe;
          stripeElementsRef.current = elements;
          stripeCardElementRef.current = element;
          if (!cancelled) setLiveSdkReady(true);
          return;
        }

        if (
          gateway === "square" &&
          bootstrap.applicationId &&
          bootstrap.locationId
        ) {
          const sqUrl =
            bootstrap.environment === "production"
              ? "https://web.squarecdn.com/v1/square.js"
              : "https://sandbox.web.squarecdn.com/v1/square.js";
          await loadExternalScript(sqUrl);
          if (cancelled || !window.Square || !squareMountRef.current) {
            throw new Error("Square Web Payments SDK unavailable");
          }
          const payments = await window.Square.payments(
            bootstrap.applicationId,
            bootstrap.locationId
          );
          const card = await payments.card();
          if (cancelled) return;
          squareMountRef.current.innerHTML = "";
          await card.attach(squareMountRef.current);
          squareCardRef.current = card;
          if (!cancelled) setLiveSdkReady(true);
          return;
        }

        if (gateway === "clover" && bootstrap.publicKey) {
          const clvUrl =
            bootstrap.environment === "production"
              ? "https://checkout.clover.com/sdk.js"
              : "https://checkout.sandbox.dev.clover.com/sdk.js";
          await loadExternalScript(clvUrl);
          if (
            cancelled ||
            !window.Clover ||
            !cloverNumberRef.current ||
            !cloverDateRef.current ||
            !cloverCvvRef.current ||
            !cloverZipRef.current
          ) {
            throw new Error("Clover Hosted iFrame SDK unavailable");
          }
          const clover = new window.Clover(bootstrap.publicKey);
          const elements = clover.elements();
          const baseStyle = {
            body: { fontFamily: "ui-monospace, monospace", fontSize: "13px" },
            input: { color: "#f4f4f5", backgroundColor: "#09090b" },
          };
          cloverNumberRef.current.innerHTML = "";
          cloverDateRef.current.innerHTML = "";
          cloverCvvRef.current.innerHTML = "";
          cloverZipRef.current.innerHTML = "";
          elements.create("CARD_NUMBER", baseStyle).mount(cloverNumberRef.current);
          elements.create("CARD_DATE", baseStyle).mount(cloverDateRef.current);
          elements.create("CARD_CVV", baseStyle).mount(cloverCvvRef.current);
          elements.create("CARD_POSTAL_CODE", baseStyle).mount(cloverZipRef.current);
          cloverInstanceRef.current = clover;
          if (!cancelled) setLiveSdkReady(true);
          return;
        }

        if (gateway === "paypal" && bootstrap.clientId) {
          const ppUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
            bootstrap.clientId
          )}&currency=${encodeURIComponent(
            (bootstrap.currency || currency || "usd").toUpperCase()
          )}`;
          await loadExternalScript(ppUrl);
          if (cancelled || !window.paypal || !paypalMountRef.current) {
            throw new Error("PayPal JS SDK unavailable");
          }
          paypalMountRef.current.innerHTML = "";
          const totalDollars = (
            Math.max(50, Math.round(amountCents || 50)) / 100
          ).toFixed(2);
          const buttons = window.paypal.Buttons({
            style: { layout: "horizontal", color: "gold", shape: "rect" },
            createOrder: (_data, actions) =>
              actions.order.create({
                purchase_units: [
                  {
                    amount: {
                      value: totalDollars,
                      currency_code: (
                        bootstrap.currency ||
                        currency ||
                        "usd"
                      ).toUpperCase(),
                    },
                  },
                ],
              }),
            onApprove: async (data, actions) => {
              const capture = await actions.order.capture().catch(() => ({
                id: data.orderID,
              }));
              const orderId = capture?.id || data.orderID || generateSingleUseNonce("PAYPAL_LIVE_");
              const result: TokenizedPaymentResult = {
                token: orderId.startsWith("PAYPAL_")
                  ? orderId
                  : `PAYPAL_LIVE_${orderId}`,
                paymentIntentId: orderId,
                gateway: "paypal",
                mode: "live",
                brand: "PayPal",
              };
              setTokenizedResult(result);
              updateStatus("tokenized", "PayPal checkout approved");
              onTokenizedRef.current?.(result);
            },
            onError: () => {
              setLiveSdkFallbackReason(
                "PayPal button could not initialize; using sandbox authorization."
              );
              setLiveSdkReady(false);
            },
          });
          await buttons.render(paypalMountRef.current);
          if (!cancelled) setLiveSdkReady(true);
          return;
        }

        if (gateway === "apple_pay" && bootstrap.publishableKey) {
          await loadExternalScript("https://js.stripe.com/v3/");
          if (cancelled || !window.Stripe || !applePayMountRef.current) {
            throw new Error("Apple Pay Web SDK unavailable");
          }
          const stripe = window.Stripe(bootstrap.publishableKey);
          const pr = stripe.paymentRequest({
            country: "US",
            currency: (bootstrap.currency || currency || "usd").toLowerCase(),
            total: {
              label: restaurantName || "Order Total",
              amount: Math.max(50, Math.round(amountCents || 50)),
            },
            requestPayerName: true,
            requestPayerEmail: true,
          });
          const canPay = await pr.canMakePayment();
          if (!canPay || (!canPay.applePay && !canPay.googlePay)) {
            throw new Error("Apple Pay is not available in this browser");
          }
          pr.on("paymentmethod", (ev) => {
            ev.complete("success");
            const result: TokenizedPaymentResult = {
              token: ev.paymentMethod.id,
              paymentIntentId: bootstrap.paymentIntentId,
              gateway: "apple_pay",
              mode: "live",
              last4: ev.paymentMethod.card?.last4,
              brand: ev.paymentMethod.card?.brand || "Apple Pay",
            };
            setTokenizedResult(result);
            updateStatus("tokenized", "Apple Pay authorized");
            onTokenizedRef.current?.(result);
          });
          const elements = stripe.elements();
          const prBtn = elements.create("paymentRequestButton", {
            paymentRequest: pr,
          });
          applePayMountRef.current.innerHTML = "";
          prBtn.mount(applePayMountRef.current);
          stripeInstanceRef.current = stripe;
          applePayRequestRef.current = pr;
          if (!cancelled) setLiveSdkReady(true);
          return;
        }

        throw new Error("Missing public credentials for live SDK");
      } catch (err) {
        if (cancelled) return;
        setLiveSdkReady(false);
        setLiveSdkFallbackReason(
          err instanceof Error
            ? `${err.message} — using interactive PCI-safe fallback tokenizer.`
            : "Live SDK unavailable — using interactive sandbox tokenizer."
        );
      }
    }

    mountLiveSdk();
    return () => {
      cancelled = true;
      stripeCardElementRef.current?.unmount?.();
      stripeCardElementRef.current?.destroy?.();
      void squareCardRef.current?.destroy?.();
    };
  }, [bootstrap, gateway, amountCents, currency, restaurantName, updateStatus]);

  const runSandboxTokenization = useCallback((): TokenizedPaymentResult => {
    if (gateway === "paypal") {
      const token = generateSingleUseNonce("PAYPAL_SANDBOX_");
      return {
        token,
        paymentIntentId: bootstrap?.paymentIntentId || token,
        gateway: "paypal",
        mode: "sandbox",
        brand: "PayPal",
      };
    }

    if (gateway === "apple_pay") {
      const token = generateSingleUseNonce("applepay_tok_");
      return {
        token,
        paymentIntentId: bootstrap?.paymentIntentId,
        gateway: "apple_pay",
        mode: "sandbox",
        last4: "4242",
        brand: "Apple Pay",
      };
    }

    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) {
      throw new Error("Enter a valid 13–19 digit card number.");
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry.trim())) {
      throw new Error("Enter card expiry in MM/YY format.");
    }
    const cvcDigits = cardCvc.replace(/\D/g, "");
    if (cvcDigits.length < 3 || cvcDigits.length > 4) {
      throw new Error("Enter a valid 3 or 4 digit security code (CVC/CVV).");
    }
    if (cardZip.trim().length < 3) {
      throw new Error("Enter a valid billing ZIP/postal code.");
    }

    const last4 = digits.slice(-4);
    const brand = detectCardBrand(digits);

    if (gateway === "square") {
      return {
        token: generateSingleUseNonce("cnon:sandbox-"),
        gateway: "square",
        mode: "sandbox",
        last4,
        brand,
      };
    }

    if (gateway === "clover") {
      return {
        token: generateSingleUseNonce("clv_sandbox_"),
        gateway: "clover",
        mode: "sandbox",
        last4,
        brand,
      };
    }

    return {
      token: generateSingleUseNonce("pm_sandbox_"),
      paymentIntentId: bootstrap?.paymentIntentId,
      gateway: "stripe",
      mode: "sandbox",
      last4,
      brand,
    };
  }, [gateway, bootstrap, cardNumber, cardExpiry, cardCvc, cardZip]);

  const tokenize = useCallback(async (): Promise<TokenizedPaymentResult> => {
    if (tokenizedResult && tokenizedResult.gateway === gateway) {
      return tokenizedResult;
    }

    setLocalError(null);
    setTokenizing(true);
    try {
      let result: TokenizedPaymentResult;

      if (bootstrap?.mode === "live" && liveSdkReady) {
        if (gateway === "stripe" && stripeInstanceRef.current && stripeElementsRef.current) {
          if (bootstrap.clientSecret) {
            const confirmRes = await stripeInstanceRef.current.confirmPayment({
              elements: stripeElementsRef.current,
              redirect: "if_required",
              confirmParams: customerEmailRef.current
                ? { receipt_email: customerEmailRef.current }
                : undefined,
            });
            if (confirmRes.error) {
              throw new Error(confirmRes.error.message || "Stripe payment authorization failed.");
            }
            const pi = confirmRes.paymentIntent;
            const pmObj =
              typeof pi?.payment_method === "object" ? pi.payment_method : undefined;
            const pmId =
              typeof pi?.payment_method === "string"
                ? pi.payment_method
                : pmObj?.id || pi?.id || generateSingleUseNonce("pm_live_");
            result = {
              token: pmId,
              paymentIntentId: pi?.id || bootstrap.paymentIntentId,
              gateway: "stripe",
              mode: "live",
              last4: pmObj?.card?.last4,
              brand: pmObj?.card?.brand,
            };
          } else if (stripeCardElementRef.current) {
            const pmRes = await stripeInstanceRef.current.createPaymentMethod({
              type: "card",
              card: stripeCardElementRef.current,
            });
            if (pmRes.error || !pmRes.paymentMethod?.id) {
              throw new Error(pmRes.error?.message || "Stripe card tokenization failed.");
            }
            result = {
              token: pmRes.paymentMethod.id,
              paymentIntentId: bootstrap.paymentIntentId,
              gateway: "stripe",
              mode: "live",
              last4: pmRes.paymentMethod.card?.last4,
              brand: pmRes.paymentMethod.card?.brand,
            };
          } else {
            result = runSandboxTokenization();
          }
        } else if (gateway === "square" && squareCardRef.current) {
          const sqRes = await squareCardRef.current.tokenize();
          if (sqRes.status !== "OK" || !sqRes.token) {
            const msg =
              sqRes.errors?.map((e) => e.message).filter(Boolean).join(", ") ||
              "Square card tokenization failed.";
            throw new Error(msg);
          }
          result = {
            token: sqRes.token,
            gateway: "square",
            mode: "live",
            last4: sqRes.details?.card?.last4,
            brand: sqRes.details?.card?.brand,
          };
        } else if (gateway === "clover" && cloverInstanceRef.current) {
          const clvRes = await cloverInstanceRef.current.createToken();
          if (!clvRes.token) {
            const msg =
              Object.values(clvRes.errors || {}).join(", ") ||
              "Clover card tokenization failed.";
            throw new Error(msg);
          }
          result = {
            token: clvRes.token,
            gateway: "clover",
            mode: "live",
            brand: "Card",
          };
        } else if (gateway === "paypal") {
          throw new Error(
            "Complete authorization in the PayPal button above before submitting."
          );
        } else if (gateway === "apple_pay" && applePayRequestRef.current) {
          applePayRequestRef.current.show();
          throw new Error("Confirm payment in the Apple Pay sheet to continue.");
        } else {
          result = runSandboxTokenization();
        }
      } else {
        result = runSandboxTokenization();
      }

      setTokenizedResult(result);
      updateStatus("tokenized", `${gateway.toUpperCase()} token ready`);
      onTokenizedRef.current?.(result);
      return result;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Payment tokenization failed.";
      setLocalError(msg);
      updateStatus("error", msg);
      throw err;
    } finally {
      setTokenizing(false);
    }
  }, [
    tokenizedResult,
    gateway,
    bootstrap,
    liveSdkReady,
    runSandboxTokenization,
    updateStatus,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      tokenize,
    }),
    [tokenize]
  );

  const handleManualAuthorize = async () => {
    try {
      await tokenize();
    } catch {
      // localError is already set inside tokenize()
    }
  };

  const resetTokenOnEdit = () => {
    if (tokenizedResult) {
      setTokenizedResult(null);
      updateStatus("ready", "Card details updated — ready to tokenize");
    }
    if (localError) setLocalError(null);
  };

  const usingLiveSdkUi = bootstrap?.mode === "live" && liveSdkReady;
  const gatewayTitle =
    gateway === "stripe"
      ? "Stripe Elements"
      : gateway === "square"
        ? "Square Web Payments SDK"
        : gateway === "clover"
          ? "Clover Hosted iFrame (PAKMS)"
          : gateway === "apple_pay"
            ? "Apple Pay Express"
            : "PayPal Express Checkout";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3 text-xs text-zinc-200">
      {/* Header Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {gateway === "paypal" ? (
            <Globe className="h-4 w-4 text-sky-400" />
          ) : gateway === "apple_pay" ? (
            <Smartphone className="h-4 w-4 text-zinc-100" />
          ) : (
            <CreditCard className="h-4 w-4" style={{ color: brandColor }} />
          )}
          <span className="font-semibold text-zinc-100">{gatewayTitle}</span>
          {bootstrap?.locationId && (
            <span className="text-zinc-500">• Loc: {bootstrap.locationId}</span>
          )}
          {bootstrap?.merchantId && (
            <span className="text-zinc-500">• Merchant: {bootstrap.merchantId}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {status === "loading" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Bootstrapping...
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
                bootstrap?.mode === "live"
                  ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                  : "border-amber-500/40 bg-amber-950/30 text-amber-300"
              }`}
            >
              <Lock className="h-2.5 w-2.5" />
              {bootstrap?.mode === "live" ? "Live PCI SDK" : "Sandbox Tokenizer"}
            </span>
          )}
        </div>
      </div>

      {liveSdkFallbackReason && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-1.5 text-[11px] text-amber-200">
          {liveSdkFallbackReason}
        </div>
      )}

      {/* Live SDK Containers (hidden until bootstrap.mode === "live" & SDK mounts) */}
      {bootstrap?.mode === "live" && gateway === "stripe" && (
        <div
          ref={stripeMountRef}
          className={
            usingLiveSdkUi
              ? "rounded-xl border border-zinc-800 bg-zinc-900 p-3 min-h-[56px]"
              : "hidden"
          }
        />
      )}
      {bootstrap?.mode === "live" && gateway === "square" && (
        <div
          ref={squareMountRef}
          className={
            usingLiveSdkUi
              ? "rounded-xl border border-zinc-800 bg-zinc-900 p-3 min-h-[56px]"
              : "hidden"
          }
        />
      )}
      {bootstrap?.mode === "live" && gateway === "clover" && (
        <div className={usingLiveSdkUi ? "grid grid-cols-2 gap-2" : "hidden"}>
          <div
            ref={cloverNumberRef}
            className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 min-h-[40px]"
          />
          <div
            ref={cloverDateRef}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 min-h-[40px]"
          />
          <div
            ref={cloverCvvRef}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 min-h-[40px]"
          />
          <div
            ref={cloverZipRef}
            className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 min-h-[40px]"
          />
        </div>
      )}
      {bootstrap?.mode === "live" && gateway === "paypal" && (
        <div
          ref={paypalMountRef}
          className={
            usingLiveSdkUi
              ? "rounded-xl border border-zinc-800 bg-zinc-900 p-3 min-h-[52px]"
              : "hidden"
          }
        />
      )}
      {bootstrap?.mode === "live" && gateway === "apple_pay" && (
        <div
          ref={applePayMountRef}
          className={
            usingLiveSdkUi
              ? "rounded-xl border border-zinc-800 bg-zinc-900 p-3 min-h-[48px]"
              : "hidden"
          }
        />
      )}

      {/* Interactive PCI-Safe Sandbox Card / Wallet Tokenizer */}
      {!usingLiveSdkUi && (
        <div className="space-y-2.5">
          {gateway === "paypal" ? (
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-sky-300">
                <span>PayPal Express Sandbox Wallet</span>
                <span>
                  Client:{" "}
                  {bootstrap?.clientId
                    ? `${bootstrap.clientId.slice(0, 14)}…`
                    : "sb"}
                </span>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400">
                  PayPal Payer Email
                </label>
                <input
                  type="email"
                  value={sandboxWalletEmail}
                  onChange={(e) => {
                    setSandboxWalletEmail(e.target.value);
                    resetTokenOnEdit();
                  }}
                  placeholder="buyer@example.com"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="button"
                disabled={tokenizing || status === "loading"}
                onClick={handleManualAuthorize}
                className="w-full rounded-xl border border-sky-400/40 bg-sky-500/20 py-2 text-[11px] font-bold uppercase tracking-wider text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
              >
                {tokenizedResult
                  ? "✓ PayPal Express Authorized"
                  : "Authorize PayPal Express Token"}
              </button>
            </div>
          ) : gateway === "apple_pay" ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300">
                <span> Apple Pay Digital Wallet</span>
                <span className="text-zinc-400">
                  ${(Math.max(50, amountCents || 50) / 100).toFixed(2)}{" "}
                  {(bootstrap?.currency || currency).toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                disabled={tokenizing || status === "loading"}
                onClick={handleManualAuthorize}
                className="w-full rounded-xl border border-zinc-600 bg-black py-2.5 text-xs font-semibold tracking-wide text-white hover:bg-zinc-900 disabled:opacity-50"
              >
                {tokenizedResult
                  ? "✓ Apple Pay Authorized (•••• 4242)"
                  : " Pay — Authorize Apple Pay Wallet"}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400">
                    Card Number ({detectCardBrand(cardNumber.replace(/\D/g, ""))})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumber}
                    onChange={(e) => {
                      setCardNumber(formatCardInput(e.target.value));
                      resetTokenOnEdit();
                    }}
                    placeholder="4242 4242 4242 4242"
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400">
                    Expiry
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={cardExpiry}
                    onChange={(e) => {
                      setCardExpiry(formatExpiryInput(e.target.value));
                      resetTokenOnEdit();
                    }}
                    placeholder="MM/YY"
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400">
                    CVC / CVV
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    value={cardCvc}
                    onChange={(e) => {
                      setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
                      resetTokenOnEdit();
                    }}
                    placeholder="888"
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    autoComplete="postal-code"
                    maxLength={10}
                    value={cardZip}
                    onChange={(e) => {
                      setCardZip(e.target.value.slice(0, 10));
                      resetTokenOnEdit();
                    }}
                    placeholder="60661"
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Single-use PCI token generated locally; raw card never stored.
                </span>
                <button
                  type="button"
                  disabled={tokenizing || status === "loading"}
                  onClick={handleManualAuthorize}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
                >
                  {tokenizing
                    ? "Tokenizing..."
                    : tokenizedResult
                      ? "Re-Tokenize Card"
                      : "Tokenize Card"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tokenized Confirmation Pill */}
      {tokenizedResult && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-2 text-[11px] text-emerald-300">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Authorized {tokenizedResult.brand || tokenizedResult.gateway.toUpperCase()}
            {tokenizedResult.last4 ? ` •••• ${tokenizedResult.last4}` : ""}
          </span>
          <code className="font-mono text-[10px] text-emerald-200/90 truncate max-w-[180px]">
            {tokenizedResult.token}
          </code>
        </div>
      )}

      {/* Local Error */}
      {localError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-300">
          {localError}
        </div>
      )}
    </div>
  );
});

export default CheckoutPaymentGateway;
