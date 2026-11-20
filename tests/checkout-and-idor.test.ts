import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  authenticateOrRegisterCustomer,
  createEmailCampaign,
  createMenuItem,
  createOrder,
  createRestaurantTenant,
  createScheduledReorder,
  getRestaurantBySlugOrDomain,
  listMenuItems,
  updateRestaurantTenant,
} from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { POST as postPaymentIntent } from "@/app/api/restaurants/[slug]/payment-intent/route";
import {
  GET as getOrders,
  PATCH as patchOrders,
  POST as postOrders,
} from "@/app/api/restaurants/[slug]/orders/route";
import {
  DELETE as deleteMenu,
  PATCH as patchMenu,
  POST as postMenu,
} from "@/app/api/restaurants/[slug]/menu/route";
import {
  GET as getCustomerAccount,
  POST as postCustomerAccount,
} from "@/app/api/restaurants/[slug]/customer-account/route";

const TURSO_ENV_KEYS = [
  "TURSO_DATABASE_URL",
  "STORAGE_URL",
  "LIBSQL_URL",
  "TURSO_URL",
  "DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "STORAGE_AUTH_TOKEN",
  "LIBSQL_AUTH_TOKEN",
  "TURSO_TOKEN",
] as const;

const savedEnv: Record<string, string | undefined> = {};
let checkoutCounter = 0;

function nextIp(): string {
  checkoutCounter += 1;
  return `10.20.${Math.floor(checkoutCounter / 200)}.${(checkoutCounter % 200) + 1}`;
}

function makeSlugContext(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

function staffCookieHeader(params: {
  sub?: string;
  scope: "platform" | "restaurant";
  role: string;
  restaurantId: string | null;
}): string {
  const token = createSessionToken({
    sub: params.sub || "user_test",
    actor: "staff",
    scope: params.scope,
    role: params.role,
    email: "staff@test.local",
    name: "Test Staff",
    restaurantId: params.restaurantId,
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function customerCookieHeader(params: {
  sub: string;
  email: string;
  name?: string;
  restaurantId: string;
}): string {
  const token = createSessionToken({
    sub: params.sub,
    actor: "customer",
    scope: "customer",
    role: "customer",
    email: params.email,
    name: params.name || "Test Customer",
    restaurantId: params.restaurantId,
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

before(() => {
  for (const key of [
    ...TURSO_ENV_KEYS,
    "PLATERIFT_ENFORCE_AUTH",
    "SESSION_SECRET",
    "STRIPE_SECRET_KEY",
  ]) {
    savedEnv[key] = process.env[key];
  }
  for (const key of TURSO_ENV_KEYS) {
    delete process.env[key];
  }
  delete process.env.PLATERIFT_ENFORCE_AUTH;
  delete process.env.STRIPE_SECRET_KEY;
  process.env.SESSION_SECRET = "checkout-idor-test-secret-2026";
});

after(() => {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
});

describe("POST /api/restaurants/[slug]/payment-intent", () => {
  it("validates tenant, gateway, amountCents, and currency", async () => {
    const missingRes = await postPaymentIntent(
      new NextRequest("http://localhost:3000/api/restaurants/nonexistent/payment-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gateway: "stripe", amountCents: 2000 }),
      }),
      makeSlugContext("nonexistent-slug-999")
    );
    assert.equal(missingRes.status, 404);

    const badGatewayRes = await postPaymentIntent(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/payment-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gateway: "bitcoin", amountCents: 2000 }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(badGatewayRes.status, 400);

    for (const invalidAmount of [0, -500, 12.34, "2000"]) {
      const badAmountRes = await postPaymentIntent(
        new NextRequest(
          "http://localhost:3000/api/restaurants/bella-napoli/payment-intent",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ gateway: "stripe", amountCents: invalidAmount }),
          }
        ),
        makeSlugContext("bella-napoli")
      );
      assert.equal(badAmountRes.status, 400);
    }
  });

  it("returns sandbox gateway configs without leaking any private secrets", async () => {
    for (const gateway of [
      "stripe",
      "apple_pay",
      "square",
      "clover",
      "paypal",
    ] as const) {
      const res = await postPaymentIntent(
        new NextRequest(
          "http://localhost:3000/api/restaurants/bella-napoli/payment-intent",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ gateway, amountCents: 3250 }),
          }
        ),
        makeSlugContext("bella-napoli")
      );
      assert.equal(res.status, 200, `Expected 200 for ${gateway}`);
      const json = (await res.json()) as Record<string, unknown>;
      assert.equal(json.mode, "sandbox");
      assert.equal(json.provider, gateway);
      assert.equal(json.amountCents, 3250);

      const serialized = JSON.stringify(json);
      assert.equal(serialized.includes("sk_test_"), false);
      assert.equal(serialized.includes("sk_live_"), false);
      assert.equal(serialized.includes("secretKey"), false);
      assert.equal(serialized.includes("accessToken"), false);
      assert.equal(serialized.includes("privateToken"), false);
      assert.equal(serialized.includes("EJBellaNapoliPayPalSecret"), false);
    }
  });

  it("mints a live Stripe PaymentIntent when live credentials exist without exposing secretKey", async () => {
    const liveTenant = createRestaurantTenant({
      name: "Live Stripe Kitchen",
      slug: "live-stripe-kitchen",
      ownerName: "Live Owner",
      ownerEmail: "live@kitchen.test",
    });
    updateRestaurantTenant(liveTenant.id, {
      paymentConfig: {
        ...liveTenant.paymentConfig,
        mode: "live",
        stripe: {
          ...liveTenant.paymentConfig.stripe,
          enabled: true,
          publishableKey: "pk_live_real_pub_12345",
          secretKey: "sk_live_real_secret_67890",
        },
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      assert.equal(String(input), "https://api.stripe.com/v1/payment_intents");
      return new Response(
        JSON.stringify({
          id: "pi_live_mocked_999",
          client_secret: "pi_live_mocked_999_secret_abc",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const res = await postPaymentIntent(
        new NextRequest(
          "http://localhost:3000/api/restaurants/live-stripe-kitchen/payment-intent",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              gateway: "stripe",
              amountCents: 4500,
              customerEmail: "vip@example.com",
            }),
          }
        ),
        makeSlugContext("live-stripe-kitchen")
      );
      assert.equal(res.status, 200);
      const data = (await res.json()) as Record<string, unknown>;
      assert.equal(data.mode, "live");
      assert.equal(data.provider, "stripe");
      assert.equal(data.paymentIntentId, "pi_live_mocked_999");
      assert.equal(data.clientSecret, "pi_live_mocked_999_secret_abc");
      assert.equal(data.publishableKey, "pk_live_real_pub_12345");
      assert.equal(JSON.stringify(data).includes("sk_live_real_secret_67890"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("POST /api/restaurants/[slug]/orders checkout limits, fees, promo & payment verification", () => {
  it("enforces minOrderAmount, maxOrderAmount, deliveryMinOrderAmount, server deliveryFee, and server promo codes", async () => {
    const tenant = createRestaurantTenant({
      name: "Checkout Validation Bistro",
      slug: "checkout-validation-bistro",
      ownerName: "Chef Test",
      ownerEmail: "chef@checkout.test",
      minOrderAmount: 15,
      maxOrderAmount: 100,
    });
    updateRestaurantTenant(tenant.id, {
      features: {
        ...tenant.features,
        pickup: true,
        delivery: true,
        promoCodes: true,
        deliveryMinOrderAmount: 25,
        doordashDrive: false,
      },
      paymentConfig: {
        ...tenant.paymentConfig,
        mode: "simulated",
        taxRatePercent: 10,
        deliveryFee: 6.5,
        freeDeliveryMin: 50,
      },
    });

    const item10 = createMenuItem({
      restaurantId: tenant.id,
      category: "Starters",
      name: "Garlic Focaccia",
      description: "Warm bread",
      price: 10,
      imageUrl: "",
      available: true,
      unavailableReason: "",
      dailyStockLimit: null,
      currentStockCount: null,
      popular: true,
      prepTimeMinutes: 10,
      dietaryTags: [],
      modifiers: [],
      sortOrder: 1,
    });

    const item20 = createMenuItem({
      restaurantId: tenant.id,
      category: "Mains",
      name: "Truffle Pasta",
      description: "Handmade",
      price: 20,
      imageUrl: "",
      available: true,
      unavailableReason: "",
      dailyStockLimit: null,
      currentStockCount: null,
      popular: true,
      prepTimeMinutes: 15,
      dietaryTags: [],
      modifiers: [],
      sortOrder: 2,
    });

    createEmailCampaign({
      restaurantId: tenant.id,
      name: "VIP 25% Off",
      subject: "Save 25%",
      segment: "all",
      promoCode: "CHEF25",
      discountPercent: 25,
      bodyHtml: "<p>Use CHEF25</p>",
    });

    const openSim = {
      simDay: "Wednesday",
      simTime: "12:30",
      simDate: "2026-11-18",
    };

    // 1. Below minOrderAmount ($10 < $15) -> 400 (even if client tampers unitPrice!)
    const belowMinRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "pickup",
            items: [{ menuItemId: item10.id, quantity: 1, unitPrice: 99 }],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(belowMinRes.status, 400);

    // 2. Above maxOrderAmount ($120 > $100) -> 400
    const aboveMaxRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "pickup",
            items: [{ menuItemId: item20.id, quantity: 6 }],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(aboveMaxRes.status, 400);

    // 3. Below deliveryMinOrderAmount ($20 < $25), ignoring tampered subtotal -> 400
    const belowDeliveryMinRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "delivery",
            deliveryAddress: "123 Oak St",
            subtotal: 999,
            items: [{ menuItemId: item20.id, quantity: 1 }],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(belowDeliveryMinRes.status, 400);

    // 4. Spoofed deliveryFee: 0 & spoofed discount: 25 without valid promoCode -> server computes deliveryFee=6.5, discount=0
    const spoofedRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "delivery",
            deliveryAddress: "123 Oak St",
            deliveryFee: 0,
            discount: 25,
            promoCode: "FAKECODE99",
            tip: 4,
            paymentGateway: "stripe",
            paymentMode: "sandbox",
            paymentToken: "pm_sandbox_test_1122",
            items: [
              { menuItemId: item20.id, quantity: 1 },
              { menuItemId: item10.id, quantity: 1 },
            ],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(spoofedRes.status, 201);
    const spoofedData = (await spoofedRes.json()) as {
      order: {
        subtotal: number;
        discount: number;
        tax: number;
        deliveryFee: number;
        tip: number;
        total: number;
        paymentReference: string;
      };
    };
    assert.equal(spoofedData.order.subtotal, 30);
    assert.equal(spoofedData.order.discount, 0);
    assert.equal(spoofedData.order.tax, 3); // 10% of 30
    assert.equal(spoofedData.order.deliveryFee, 6.5);
    assert.equal(spoofedData.order.total, 43.5);
    assert.ok(spoofedData.order.paymentReference.includes("••••1122"));
    assert.equal(spoofedData.order.paymentReference.includes("pm_sandbox_test_1122"), false);

    // 5. Valid campaign promo code CHEF25 (25% off $80 = $20 off -> discounted $60 >= $50 freeDeliveryMin -> deliveryFee=0!)
    const promoRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "delivery",
            deliveryAddress: "456 Pine St",
            promoCode: "chef25",
            discount: 70, // Spoofed larger discount ignored
            items: [{ menuItemId: item20.id, quantity: 4 }],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(promoRes.status, 201);
    const promoData = (await promoRes.json()) as {
      order: {
        subtotal: number;
        discount: number;
        tax: number;
        deliveryFee: number;
        total: number;
      };
    };
    assert.equal(promoData.order.subtotal, 80);
    assert.equal(promoData.order.discount, 20); // 25% of 80
    assert.equal(promoData.order.tax, 6); // 10% of 60
    assert.equal(promoData.order.deliveryFee, 0); // 60 >= 50 freeDeliveryMin
    assert.equal(promoData.order.total, 66);

    // 6. Rejects raw PAN card number & client secret as paymentToken
    const rawCardRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "pickup",
            paymentGateway: "stripe",
            paymentToken: "4242424242424242",
            items: [{ menuItemId: item20.id, quantity: 1 }],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(rawCardRes.status, 400);

    const clientSecretRes = await postOrders(
      new NextRequest(
        "http://localhost:3000/api/restaurants/checkout-validation-bistro/orders",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
          body: JSON.stringify({
            ...openSim,
            orderType: "pickup",
            paymentGateway: "stripe",
            paymentToken: "pi_12345_secret_67890",
            items: [{ menuItemId: item20.id, quantity: 1 }],
          }),
        }
      ),
      makeSlugContext("checkout-validation-bistro")
    );
    assert.equal(clientSecretRes.status, 400);
  });

  it("verifies live Stripe PaymentIntent status & amount on POST orders", async () => {
    const liveTenant = getRestaurantBySlugOrDomain("live-stripe-kitchen");
    assert.ok(liveTenant);
    const dish = createMenuItem({
      restaurantId: liveTenant.id,
      category: "Mains",
      name: "Live Dish",
      description: "Live test",
      price: 20,
      imageUrl: "",
      available: true,
      unavailableReason: "",
      dailyStockLimit: null,
      currentStockCount: null,
      popular: false,
      prepTimeMinutes: 15,
      dietaryTags: [],
      modifiers: [],
      sortOrder: 1,
    });
    updateRestaurantTenant(liveTenant.id, {
      paymentConfig: {
        ...liveTenant.paymentConfig,
        taxRatePercent: 0,
      },
    });

    const originalFetch = globalThis.fetch;
    let mockStatus = "requires_payment_method";
    let mockAmount = 2000;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "pi_3LiveVerifyTest01",
          status: mockStatus,
          amount: mockAmount,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as typeof fetch;

    try {
      const unpaidRes = await postOrders(
        new NextRequest(
          "http://localhost:3000/api/restaurants/live-stripe-kitchen/orders",
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
            body: JSON.stringify({
              simDay: "Wednesday",
              simTime: "12:30",
              simDate: "2026-11-18",
              orderType: "pickup",
              paymentGateway: "stripe",
              paymentMode: "live",
              paymentToken: "pm_live_tok_5566",
              paymentIntentId: "pi_3LiveVerifyTest01",
              items: [{ menuItemId: dish.id, quantity: 1 }],
            }),
          }
        ),
        makeSlugContext("live-stripe-kitchen")
      );
      assert.equal(unpaidRes.status, 402);

      mockStatus = "succeeded";
      const paidRes = await postOrders(
        new NextRequest(
          "http://localhost:3000/api/restaurants/live-stripe-kitchen/orders",
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
            body: JSON.stringify({
              simDay: "Wednesday",
              simTime: "12:30",
              simDate: "2026-11-18",
              orderType: "pickup",
              paymentGateway: "stripe",
              paymentMode: "live",
              paymentToken: "pm_live_tok_5566",
              paymentIntentId: "pi_3LiveVerifyTest01",
              items: [{ menuItemId: dish.id, quantity: 1 }],
            }),
          }
        ),
        makeSlugContext("live-stripe-kitchen")
      );
      assert.equal(paidRes.status, 201);
      const paidJson = (await paidRes.json()) as {
        order: { paymentStatus: string; paymentReference: string };
      };
      assert.equal(paidJson.order.paymentStatus, "paid");
      assert.ok(paidJson.order.paymentReference.includes("pi_3LiveVerifyTest01"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Cross-tenant IDOR & RBAC on orders, menu, and customer-account", () => {
  it("enforces RBAC and tenant ownership on PATCH & GET /api/restaurants/[slug]/orders", async () => {
    const bella = getRestaurantBySlugOrDomain("bella-napoli");
    const sakura = getRestaurantBySlugOrDomain("sakura-sushi");
    assert.ok(bella && sakura);

    const { order: bellaOrder } = createOrder({
      restaurantId: bella.id,
      customerName: "Bella Guest",
      customerEmail: "bellaguest@example.com",
      customerPhone: "+13125559999",
      orderType: "delivery",
      deliveryAddress: "100 Secret St",
      items: [],
      subtotal: 25,
      tax: 2,
      deliveryFee: 4,
      tip: 3,
      discount: 0,
      total: 34,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      paymentReference: "ref_b",
      status: "confirmed",
      specialInstructions: "",
    });
    const { order: sakuraOrder } = createOrder({
      restaurantId: sakura.id,
      customerName: "Sakura Guest",
      customerEmail: "sakuraguest@example.com",
      customerPhone: "+14155558888",
      orderType: "pickup",
      items: [],
      subtotal: 30,
      tax: 2.5,
      deliveryFee: 0,
      tip: 4,
      discount: 0,
      total: 36.5,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      paymentReference: "ref_s",
      status: "confirmed",
      specialInstructions: "",
    });

    // Strict auth blocks unauthenticated PATCH & list GET
    process.env.PLATERIFT_ENFORCE_AUTH = "true";
    try {
      const unauthPatch = await patchOrders(
        new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: bellaOrder.id, status: "preparing" }),
        }),
        makeSlugContext("bella-napoli")
      );
      assert.equal(unauthPatch.status, 401);

      const unauthListGet = await getOrders(
        new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders"),
        makeSlugContext("bella-napoli")
      );
      assert.equal(unauthListGet.status, 401);
    } finally {
      delete process.env.PLATERIFT_ENFORCE_AUTH;
    }

    // Public single-order tracking redacts customer PII
    const publicTrack = await getOrders(
      new NextRequest(
        `http://localhost:3000/api/restaurants/bella-napoli/orders?orderId=${encodeURIComponent(
          bellaOrder.id
        )}`
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(publicTrack.status, 200);
    const trackedJson = (await publicTrack.json()) as {
      order: { customerEmail: string; customerPhone: string; deliveryAddress: string };
    };
    assert.equal(trackedJson.order.customerEmail, "");
    assert.equal(trackedJson.order.customerPhone, "");
    assert.equal(trackedJson.order.deliveryAddress, "");

    // Customer session from Sakura with matching email cannot read Bella order via ?orderId= -> 403
    const crossCustomerOrderTrack = await getOrders(
      new NextRequest(
        `http://localhost:3000/api/restaurants/bella-napoli/orders?orderId=${encodeURIComponent(
          bellaOrder.id
        )}`,
        {
          headers: {
            cookie: customerCookieHeader({
              sub: "cust_sakura_matching_email",
              email: "bellaguest@example.com",
              restaurantId: sakura.id,
            }),
          },
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(
      crossCustomerOrderTrack.status,
      403,
      "cross-tenant customer session with matching email should get 403 on GET ?orderId="
    );

    // Marketing manager lacks "orders" tab -> 403
    const marketingPatch = await patchOrders(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "marketing_manager",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({ orderId: bellaOrder.id, status: "preparing" }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(marketingPatch.status, 403);

    // Cross-tenant staff (Sakura owner on Bella orders) -> 403
    const crossStaffPatch = await patchOrders(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: sakura.id,
          }),
        },
        body: JSON.stringify({ orderId: bellaOrder.id, status: "preparing" }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(crossStaffPatch.status, 403);

    // Bella owner trying to PATCH Sakura's orderId under Bella's URL -> 404 (IDOR blocked)
    const crossOrderIdPatch = await patchOrders(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({ orderId: sakuraOrder.id, status: "preparing" }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(crossOrderIdPatch.status, 404);

    // Invalid status -> 400
    const badStatusPatch = await patchOrders(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({ orderId: bellaOrder.id, status: "hacked_status" }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(badStatusPatch.status, 400);

    // Valid Bella owner PATCH -> 200
    const okPatch = await patchOrders(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/orders", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({ orderId: bellaOrder.id, status: "preparing" }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(okPatch.status, 200);
  });

  it("enforces cross-tenant IDOR & RBAC on /api/restaurants/[slug]/menu", async () => {
    const bella = getRestaurantBySlugOrDomain("bella-napoli");
    const sakura = getRestaurantBySlugOrDomain("sakura-sushi");
    assert.ok(bella && sakura);

    const bellaItem = listMenuItems(bella.id)[0];
    const sakuraItem = listMenuItems(sakura.id)[0];
    assert.ok(bellaItem && sakuraItem);

    // Sakura owner cannot POST/PATCH/DELETE Bella Napoli menu -> 403
    const crossPost = await postMenu(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/menu", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: sakura.id,
          }),
        },
        body: JSON.stringify({ name: "Intruder Dish", category: "Mains", price: 15 }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(crossPost.status, 403);

    // Cashier lacks "menu" tab -> 403
    const cashierPatch = await patchMenu(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/menu", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "cashier_host",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({ itemId: bellaItem.id, price: 1.0 }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(cashierPatch.status, 403);

    // Bella owner cannot PATCH or DELETE Sakura's itemId via Bella's endpoint -> 404
    const idorPatch = await patchMenu(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/menu", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({ itemId: sakuraItem.id, price: 0.01 }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(idorPatch.status, 404);

    const idorDelete = await deleteMenu(
      new NextRequest(
        `http://localhost:3000/api/restaurants/bella-napoli/menu?itemId=${encodeURIComponent(
          sakuraItem.id
        )}`,
        {
          method: "DELETE",
          headers: {
            cookie: staffCookieHeader({
              scope: "restaurant",
              role: "restaurant_owner",
              restaurantId: bella.id,
            }),
          },
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(idorDelete.status, 404);

    // Valid Bella owner update succeeds -> 200
    const okPatch = await patchMenu(
      new NextRequest("http://localhost:3000/api/restaurants/bella-napoli/menu", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: staffCookieHeader({
            scope: "restaurant",
            role: "restaurant_owner",
            restaurantId: bella.id,
          }),
        },
        body: JSON.stringify({
          itemId: bellaItem.id,
          unavailableReason: bellaItem.unavailableReason,
        }),
      }),
      makeSlugContext("bella-napoli")
    );
    assert.equal(okPatch.status, 200);
  });

  it("enforces cross-tenant and cross-customer IDOR protection on /api/restaurants/[slug]/customer-account", async () => {
    const bella = getRestaurantBySlugOrDomain("bella-napoli");
    const sakura = getRestaurantBySlugOrDomain("sakura-sushi");
    assert.ok(bella && sakura);

    const custBellaA = authenticateOrRegisterCustomer({
      restaurantId: bella.id,
      mode: "register",
      email: "idor-alice@example.com",
      name: "Alice Bella",
      phone: "+13125550111",
    });
    const custBellaB = authenticateOrRegisterCustomer({
      restaurantId: bella.id,
      mode: "register",
      email: "idor-bob@example.com",
      name: "Bob Bella",
      phone: "+13125550222",
    });
    const custSakura = authenticateOrRegisterCustomer({
      restaurantId: sakura.id,
      mode: "register",
      email: "idor-ken@example.com",
      name: "Ken Sakura",
      phone: "+14155550333",
    });

    const { order: bobOrder } = createOrder({
      restaurantId: bella.id,
      customerName: custBellaB.name,
      customerEmail: custBellaB.email,
      customerPhone: custBellaB.phone || "+13125550002",
      orderType: "pickup",
      items: [],
      subtotal: 20,
      tax: 2,
      deliveryFee: 0,
      tip: 2,
      discount: 0,
      total: 24,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      paymentReference: "ref_bob",
      status: "completed",
      specialInstructions: "",
    });

    const bobScheduled = createScheduledReorder({
      restaurantId: bella.id,
      customerId: custBellaB.id,
      customerName: custBellaB.name,
      customerEmail: custBellaB.email,
      customerPhone: "+13125550002",
      sourceOrderNumber: bobOrder.orderNumber,
      title: "Bob Weekly Lunch",
      orderType: "pickup",
      items: [],
      subtotal: 20,
      tax: 2,
      deliveryFee: 0,
      tip: 2,
      total: 24,
      paymentMethod: "stripe",
      frequency: "weekly",
      scheduledDate: "2026-12-01",
      scheduledTime: "12:00",
      specialInstructions: "",
    });

    const aliceCookie = customerCookieHeader({
      sub: custBellaA.id,
      email: custBellaA.email,
      name: custBellaA.name,
      restaurantId: bella.id,
    });

    // 1. Alice (Bella customer) cannot mutate Sakura customer account -> 403
    const crossTenantCust = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/sakura-sushi/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "update_profile",
            customerId: custSakura.id,
            name: "Hacked",
          }),
        }
      ),
      makeSlugContext("sakura-sushi")
    );
    assert.equal(crossTenantCust.status, 403, "crossTenantCust should be 403");

    // 2. Alice cannot pass Sakura's customerId on Bella's endpoint -> 404
    const crossIdOnBella = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "update_profile",
            customerId: custSakura.id,
            name: "Hacked",
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(crossIdOnBella.status, 404, "crossIdOnBella should be 404");

    // 3. Alice cannot update Bob's profile, reorder Bob's order, or trigger/update Bob's scheduled reorder -> 403
    const bobProfileRes = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "update_profile",
            customerId: custBellaB.id,
            name: "Hacked Bob",
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(bobProfileRes.status, 403, "bobProfileRes should be 403");

    const bobReorderRes = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "reorder_now",
            orderId: bobOrder.id,
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(bobReorderRes.status, 403, "bobReorderRes should be 403");

    const bobTrigRes = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "trigger_scheduled",
            scheduledId: bobScheduled.id,
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(bobTrigRes.status, 403, "bobTrigRes should be 403");

    const bobUpdSchedRes = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "update_scheduled",
            scheduledId: bobScheduled.id,
            status: "cancelled",
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(bobUpdSchedRes.status, 403, "bobUpdSchedRes should be 403");

    // 4. Cross-tenant customer GET /customer-account?email=... is blocked (403) even in demo mode,
    //    and under strict auth Alice cannot query Bob's email, cross-tenant accounts, or receive demoCustomers on login
    const crossTenantDemoGet = await getCustomerAccount(
      new NextRequest(
        `http://localhost:3000/api/restaurants/sakura-sushi/customer-account?email=${encodeURIComponent(
          custSakura.email
        )}`,
        { headers: { cookie: aliceCookie } }
      ),
      makeSlugContext("sakura-sushi")
    );
    assert.equal(
      crossTenantDemoGet.status,
      403,
      "crossTenantDemoGet should be 403"
    );

    process.env.PLATERIFT_ENFORCE_AUTH = "true";
    try {
      const strictUnauthGet = await getCustomerAccount(
        new NextRequest(
          `http://localhost:3000/api/restaurants/bella-napoli/customer-account?email=${encodeURIComponent(
            custBellaB.email
          )}`
        ),
        makeSlugContext("bella-napoli")
      );
      assert.equal(strictUnauthGet.status, 401, "strictUnauthGet should be 401");

      const strictCrossGet = await getCustomerAccount(
        new NextRequest(
          `http://localhost:3000/api/restaurants/bella-napoli/customer-account?email=${encodeURIComponent(
            custBellaB.email
          )}`,
          { headers: { cookie: aliceCookie } }
        ),
        makeSlugContext("bella-napoli")
      );
      assert.equal(strictCrossGet.status, 403, "strictCrossGet should be 403");

      const strictCrossTenantNoParams = await getCustomerAccount(
        new NextRequest(
          "http://localhost:3000/api/restaurants/sakura-sushi/customer-account",
          { headers: { cookie: aliceCookie } }
        ),
        makeSlugContext("sakura-sushi")
      );
      assert.equal(
        strictCrossTenantNoParams.status,
        403,
        "strictCrossTenantNoParams should be 403"
      );

      const strictLoginRes = await postCustomerAccount(
        new NextRequest(
          "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "login",
              email: custBellaA.email,
            }),
          }
        ),
        makeSlugContext("bella-napoli")
      );
      assert.equal(strictLoginRes.status, 200);
      const strictLoginJson = (await strictLoginRes.json()) as {
        demoCustomers: unknown[];
      };
      assert.deepEqual(strictLoginJson.demoCustomers, []);
    } finally {
      delete process.env.PLATERIFT_ENFORCE_AUTH;
    }

    // 5. Alice can update her own profile and schedule a Clover recurring reorder -> 200
    const ownProfileRes = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "update_profile",
            customerId: custBellaA.id,
            name: "Alice Verified",
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(ownProfileRes.status, 200);

    const ownSchedRes = await postCustomerAccount(
      new NextRequest(
        "http://localhost:3000/api/restaurants/bella-napoli/customer-account",
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: aliceCookie },
          body: JSON.stringify({
            action: "schedule_reorder",
            customerId: custBellaA.id,
            customerEmail: custBellaA.email,
            paymentMethod: "clover",
            scheduledDate: "2026-12-05",
            scheduledTime: "18:00",
            items: [],
            subtotal: 20,
            tax: 2,
            total: 22,
          }),
        }
      ),
      makeSlugContext("bella-napoli")
    );
    assert.equal(ownSchedRes.status, 200);
    const schedJson = (await ownSchedRes.json()) as {
      scheduled: { paymentMethod: string };
    };
    assert.equal(schedJson.scheduled.paymentMethod, "clover");
  });
});
