import crypto from "node:crypto";
import type {
  DoorDashDriveConfig,
  OrderDeliveryTracking,
  PlatformIntegrationsConfig,
  RestaurantTenant,
} from "./types";
import { buildSimulatedDoorDashTracking } from "./integrationsDefaults";

const DOORDASH_API_BASE = "https://openapi.doordash.com/drive/v2";

export interface ResolvedDoorDashCredentials {
  developerId: string;
  keyId: string;
  signingSecret: string;
  source:
    | "tenant_config"
    | "platform_config"
    | "env_variables"
    | "unconfigured";
  isRealKey: boolean;
}

function isPlaceholderCredential(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return (
    trimmed.startsWith("dd_dev_") ||
    trimmed.startsWith("dd_key_sandbox_") ||
    trimmed.startsWith("dd_partner_platerift_") ||
    trimmed.startsWith("dd_key_master_") ||
    trimmed.includes("placeholder") ||
    trimmed.startsWith("dd_secret_master_")
  );
}

/**
 * Resolves the active DoorDash Drive API credentials from:
 * 1. Environment variables (DOORDASH_DEVELOPER_ID, DOORDASH_KEY_ID, DOORDASH_SIGNING_SECRET)
 * 2. Tenant-specific DoorDash Drive config (if non-placeholder)
 * 3. Platform Super Admin DoorDash Drive config (if non-placeholder)
 */
export function resolveDoorDashCredentials(
  tenantConfig?: DoorDashDriveConfig,
  platformConfig?: PlatformIntegrationsConfig["doordashDrive"]
): ResolvedDoorDashCredentials {
  const envDevId = (
    process.env.DOORDASH_DEVELOPER_ID ||
    process.env.DOORDASH_DRIVE_DEVELOPER_ID ||
    process.env.NEXT_PUBLIC_DOORDASH_DEVELOPER_ID ||
    ""
  ).trim();
  const envKeyId = (
    process.env.DOORDASH_KEY_ID ||
    process.env.DOORDASH_DRIVE_KEY_ID ||
    process.env.NEXT_PUBLIC_DOORDASH_KEY_ID ||
    ""
  ).trim();
  const envSecret = (
    process.env.DOORDASH_SIGNING_SECRET ||
    process.env.DOORDASH_DRIVE_SIGNING_SECRET ||
    ""
  ).trim();

  // 1. Check tenant config if owner entered real keys
  if (
    tenantConfig &&
    !isPlaceholderCredential(tenantConfig.developerId) &&
    !isPlaceholderCredential(tenantConfig.keyId) &&
    !isPlaceholderCredential(tenantConfig.signingSecret)
  ) {
    return {
      developerId: tenantConfig.developerId.trim(),
      keyId: tenantConfig.keyId.trim(),
      signingSecret: tenantConfig.signingSecret.trim(),
      source: "tenant_config",
      isRealKey: true,
    };
  }

  // 2. Check Platform Super Admin config if admin entered real keys
  if (
    platformConfig &&
    !isPlaceholderCredential(platformConfig.partnerDeveloperId) &&
    !isPlaceholderCredential(platformConfig.partnerKeyId) &&
    !isPlaceholderCredential(platformConfig.partnerSigningSecret)
  ) {
    return {
      developerId: platformConfig.partnerDeveloperId.trim(),
      keyId: platformConfig.partnerKeyId.trim(),
      signingSecret: platformConfig.partnerSigningSecret.trim(),
      source: "platform_config",
      isRealKey: true,
    };
  }

  // 3. Check Environment variables (e.g. Vercel env vars)
  if (envDevId && envKeyId && envSecret) {
    return {
      developerId: envDevId,
      keyId: envKeyId,
      signingSecret: envSecret,
      source: "env_variables",
      isRealKey: true,
    };
  }

  return {
    developerId:
      tenantConfig?.developerId ||
      platformConfig?.partnerDeveloperId ||
      envDevId ||
      "",
    keyId:
      tenantConfig?.keyId || platformConfig?.partnerKeyId || envKeyId || "",
    signingSecret:
      tenantConfig?.signingSecret ||
      platformConfig?.partnerSigningSecret ||
      envSecret ||
      "",
    source: "unconfigured",
    isRealKey: false,
  };
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeDoorDashSigningSecret(secret: string): Buffer {
  const cleaned = secret.trim();
  // DoorDash signing secrets are base64url encoded strings
  try {
    const normalized = cleaned.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLen);
    return Buffer.from(padded, "base64");
  } catch {
    return Buffer.from(cleaned, "utf8");
  }
}

/**
 * Generates an official DoorDash Drive v2 HS256 JWT (`dd-ver: DD-JWT-V1`).
 */
export function generateDoorDashDriveJwt(creds: {
  developerId: string;
  keyId: string;
  signingSecret: string;
}): string {
  const header = {
    alg: "HS256",
    typ: "JWT",
    "dd-ver": "DD-JWT-V1",
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "doordash",
    iss: creds.developerId.trim(),
    kid: creds.keyId.trim(),
    exp: nowSec + 300,
    iat: nowSec,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const secretBytes = decodeDoorDashSigningSecret(creds.signingSecret);
  const signature = crypto
    .createHmac("sha256", secretBytes)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function normalizeE164Phone(phone: string | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return "+16505555555";
}

function mapDoorDashStatusToInternal(
  ddStatus: string | undefined
): OrderDeliveryTracking["status"] {
  const upper = String(ddStatus || "").toUpperCase();
  if (upper === "QUOTE" || upper === "QUOTE_READY") return "quote_ready";
  if (upper === "CREATED") return "created";
  if (upper === "CONFIRMED" || upper === "DASHER_CONFIRMED")
    return "dasher_confirmed";
  if (
    upper === "ARRIVED_AT_STORE" ||
    upper === "DASHER_CONFIRMED_STORE_ARRIVAL" ||
    upper === "ENROUTE_TO_PICKUP"
  ) {
    return "dasher_at_store";
  }
  if (
    upper === "PICKED_UP" ||
    upper === "DELIVERY_PICKED_UP" ||
    upper === "ENROUTE_TO_DROPOFF" ||
    upper === "ARRIVED_AT_DROPOFF"
  ) {
    return "picked_up";
  }
  if (upper === "DELIVERED" || upper === "DELIVERY_DELIVERED") {
    return "delivered";
  }
  if (upper === "CANCELLED" || upper === "DELIVERY_CANCELLED") {
    return "cancelled";
  }
  return "created";
}

export interface DoorDashDispatchResult {
  tracking: OrderDeliveryTracking;
  usedLiveApi: boolean;
  apiMessage: string;
  credentialSource: ResolvedDoorDashCredentials["source"];
  rawResponse?: Record<string, unknown>;
}

/**
 * Creates a real DoorDash Drive v2 Delivery (or Sandbox delivery) when valid credentials are present,
 * with automatic fallback to simulated tracking if in simulated mode without real credentials.
 */
export async function createDoorDashDriveDelivery(params: {
  restaurant: RestaurantTenant;
  orderNumber: string;
  orderSubtotal: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  dropoffInstructions?: string;
  tipAmount?: number;
  items?: { name: string; quantity: number; unitPrice: number }[];
  platformConfig?: PlatformIntegrationsConfig["doordashDrive"];
}): Promise<DoorDashDispatchResult> {
  const ddConfig = params.restaurant.integrationsConfig?.doordashDrive || {
    enabled: true,
    mode: "simulated" as const,
    developerId: "",
    keyId: "",
    signingSecret: "",
    autoDispatchOnConfirm: true,
    flatDasherFeeEstimate: 6.75,
    customerDeliveryFeeShare: 4.99,
    freeDeliveryThreshold: 45,
    maxDeliveryRadiusMiles: 6,
    pickupInstructionsForDasher:
      "Pick up sealed thermal bag at the counter.",
  };

  const creds = resolveDoorDashCredentials(ddConfig, params.platformConfig);
  const shouldCallApi =
    creds.isRealKey ||
    ddConfig.mode === "live" ||
    params.platformConfig?.mode === "live";

  const cleanOrderNum = params.orderNumber
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();
  const externalDeliveryId = `dd_${params.restaurant.slug
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8)}_${cleanOrderNum}_${Date.now().toString().slice(-5)}`;

  if (shouldCallApi && creds.developerId && creds.keyId && creds.signingSecret) {
    try {
      const jwtToken = generateDoorDashDriveJwt(creds);

      const pickupAddress =
        params.restaurant.address && params.restaurant.address.length > 8
          ? params.restaurant.address
          : "901 Market Street, San Francisco, CA 94103";

      const dropoffAddress =
        params.deliveryAddress && params.deliveryAddress.length > 8
          ? params.deliveryAddress
          : "901 Market Street, 6th Floor, San Francisco, CA 94103";

      const nameParts = (params.customerName || "Valued Guest")
        .trim()
        .split(/\s+/);
      const givenName = nameParts[0] || "Valued";
      const familyName = nameParts.slice(1).join(" ") || "Guest";

      const payload = {
        external_delivery_id: externalDeliveryId,
        pickup_address: pickupAddress,
        pickup_business_name: params.restaurant.name,
        pickup_phone_number: normalizeE164Phone(params.restaurant.phone),
        pickup_instructions:
          ddConfig.pickupInstructionsForDasher ||
          `Pick up order #${params.orderNumber} at the counter.`,
        dropoff_address: dropoffAddress,
        dropoff_business_name: params.customerName || "Customer Residence",
        dropoff_phone_number: normalizeE164Phone(params.customerPhone),
        dropoff_instructions:
          params.dropoffInstructions ||
          `Deliver order #${params.orderNumber} to customer.`,
        dropoff_contact_given_name: givenName,
        dropoff_contact_family_name: familyName,
        dropoff_contact_send_notifications: true,
        order_value: Math.max(100, Math.round(params.orderSubtotal * 100)),
        currency: "USD",
        tip: Math.max(0, Math.round((params.tipAmount || 0) * 100)),
        items: (params.items || []).map((it) => ({
          name: it.name,
          quantity: Math.max(1, it.quantity),
          price: Math.max(0, Math.round(it.unitPrice * 100)),
        })),
      };

      const res = await fetch(`${DOORDASH_API_BASE}/deliveries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (res.ok) {
        const feeCents = Number(data.fee ?? 0);
        const feeTotal =
          feeCents > 0
            ? Number((feeCents / 100).toFixed(2))
            : ddConfig.flatDasherFeeEstimate || 6.75;
        const isFreeForCustomer =
          ddConfig.freeDeliveryThreshold > 0 &&
          params.orderSubtotal >= ddConfig.freeDeliveryThreshold;
        const customerFeeCharged = isFreeForCustomer
          ? 0
          : ddConfig.customerDeliveryFeeShare;
        const restaurantSubsidy = Math.max(
          0,
          Number((feeTotal - customerFeeCharged).toFixed(2))
        );

        const tracking: OrderDeliveryTracking = {
          provider: "doordash_drive",
          externalDeliveryId: String(
            data.external_delivery_id || externalDeliveryId
          ),
          status: mapDoorDashStatusToInternal(
            String(data.delivery_status || "created")
          ),
          dasherName: data.dasher_name
            ? String(data.dasher_name)
            : "DoorDash Sandbox Dasher (Assigning...)",
          dasherPhone: data.dasher_dropoff_phone_number
            ? String(data.dasher_dropoff_phone_number)
            : "+1 (855) 973-1040",
          dasherVehicle: data.dasher_vehicle_make
            ? `${data.dasher_vehicle_make} ${data.dasher_vehicle_model || ""}`.trim()
            : "DoorDash Drive Sandbox Courier",
          feeTotal,
          customerFeeCharged,
          restaurantSubsidy,
          pickupEtaMinutes: 10,
          dropoffEtaMinutes: 25,
          trackingUrl: String(
            data.tracking_url ||
              `https://order.doordash.com/track/${externalDeliveryId}`
          ),
          updatedAt: new Date().toISOString(),
        };

        return {
          tracking,
          usedLiveApi: true,
          apiMessage: `Connected to DoorDash Drive API v2 (${creds.source}). Created delivery ${tracking.externalDeliveryId} — Fee: $${feeTotal.toFixed(2)}.`,
          credentialSource: creds.source,
          rawResponse: data,
        };
      } else {
        const errMsg =
          String(data.message || data.reason || JSON.stringify(data)).slice(
            0,
            240
          ) || `HTTP ${res.status}`;
        const fallbackTracking = buildSimulatedDoorDashTracking({
          orderNumber: params.orderNumber,
          orderSubtotal: params.orderSubtotal,
          config: ddConfig,
          stage: "dasher_confirmed",
        });
        return {
          tracking: fallbackTracking,
          usedLiveApi: false,
          apiMessage: `DoorDash API returned ${res.status} (${errMsg}); used simulated fallback so order flow was not blocked.`,
          credentialSource: creds.source,
          rawResponse: data,
        };
      }
    } catch (err) {
      const fallbackTracking = buildSimulatedDoorDashTracking({
        orderNumber: params.orderNumber,
        orderSubtotal: params.orderSubtotal,
        config: ddConfig,
        stage: "dasher_confirmed",
      });
      return {
        tracking: fallbackTracking,
        usedLiveApi: false,
        apiMessage: `DoorDash network call failed (${
          err instanceof Error ? err.message : String(err)
        }); used simulated fallback.`,
        credentialSource: creds.source,
      };
    }
  }

  const simulated = buildSimulatedDoorDashTracking({
    orderNumber: params.orderNumber,
    orderSubtotal: params.orderSubtotal,
    config: ddConfig,
    stage: "dasher_confirmed",
  });

  return {
    tracking: simulated,
    usedLiveApi: false,
    apiMessage:
      "Dispatched in Practice / Simulated Mode (Add real DoorDash Developer ID, Key ID & Signing Secret or switch to Live Mode to hit openapi.doordash.com).",
    credentialSource: creds.source,
  };
}

/**
 * Fetches live delivery status from DoorDash Drive v2 (`GET /drive/v2/deliveries/{external_delivery_id}`)
 * or cancels a delivery (`PUT /drive/v2/deliveries/{external_delivery_id}/cancel`).
 */
export async function fetchOrCancelDoorDashDelivery(params: {
  restaurant: RestaurantTenant;
  externalDeliveryId: string;
  action: "get_status" | "cancel";
  platformConfig?: PlatformIntegrationsConfig["doordashDrive"];
}): Promise<{
  ok: boolean;
  usedLiveApi: boolean;
  status?: OrderDeliveryTracking["status"];
  dasherName?: string;
  dasherPhone?: string;
  dasherVehicle?: string;
  trackingUrl?: string;
  message: string;
  rawResponse?: Record<string, unknown>;
}> {
  const ddConfig = params.restaurant.integrationsConfig?.doordashDrive;
  const creds = resolveDoorDashCredentials(ddConfig, params.platformConfig);

  if (!creds.isRealKey && ddConfig?.mode !== "live") {
    return {
      ok: true,
      usedLiveApi: false,
      status: params.action === "cancel" ? "cancelled" : "dasher_confirmed",
      message:
        params.action === "cancel"
          ? `Cancelled delivery ${params.externalDeliveryId} (Simulated Mode).`
          : `Checked delivery ${params.externalDeliveryId} (Simulated Mode).`,
    };
  }

  try {
    const jwtToken = generateDoorDashDriveJwt(creds);
    const url =
      params.action === "cancel"
        ? `${DOORDASH_API_BASE}/deliveries/${encodeURIComponent(
            params.externalDeliveryId
          )}/cancel`
        : `${DOORDASH_API_BASE}/deliveries/${encodeURIComponent(
            params.externalDeliveryId
          )}`;

    const res = await fetch(url, {
      method: params.action === "cancel" ? "PUT" : "GET",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
      body: params.action === "cancel" ? JSON.stringify({}) : undefined,
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      return {
        ok: false,
        usedLiveApi: true,
        message: `DoorDash API (${res.status}): ${String(
          data.message || data.reason || JSON.stringify(data)
        ).slice(0, 200)}`,
        rawResponse: data,
      };
    }

    return {
      ok: true,
      usedLiveApi: true,
      status: mapDoorDashStatusToInternal(
        String(
          data.delivery_status ||
            (params.action === "cancel" ? "cancelled" : "created")
        )
      ),
      dasherName: data.dasher_name ? String(data.dasher_name) : undefined,
      dasherPhone: data.dasher_dropoff_phone_number
        ? String(data.dasher_dropoff_phone_number)
        : undefined,
      dasherVehicle: data.dasher_vehicle_make
        ? `${data.dasher_vehicle_make} ${data.dasher_vehicle_model || ""}`.trim()
        : undefined,
      trackingUrl: data.tracking_url ? String(data.tracking_url) : undefined,
      message:
        params.action === "cancel"
          ? `Cancelled DoorDash Drive delivery ${params.externalDeliveryId} via live API.`
          : `Synced live DoorDash Drive status (${String(
              data.delivery_status || "created"
            )}) for ${params.externalDeliveryId}.`,
      rawResponse: data,
    };
  } catch (err) {
    return {
      ok: false,
      usedLiveApi: true,
      message: `DoorDash API error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

