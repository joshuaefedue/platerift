import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { ROLE_DEFINITIONS, type PortalTabId, type UserRole } from "./types";

export const SESSION_COOKIE_NAME = "platerift_session";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  sub: string;
  actor: "staff" | "customer";
  scope: "platform" | "restaurant" | "customer";
  role: string;
  email: string;
  name: string;
  restaurantId: string | null;
  iat: number;
  exp: number;
}

export type AuthzResult =
  | { ok: true; session: SessionPayload | null }
  | { ok: false; status: 401 | 403; error: string };

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.PLATERIFT_SESSION_SECRET ||
    process.env.OAUTH_STATE_SECRET ||
    process.env.TURSO_AUTH_TOKEN ||
    process.env.DOORDASH_SIGNING_SECRET ||
    "platerift-session-hmac-secret-2026"
  );
}

function signPayloadSegment(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): string {
  const iat = Math.floor(Date.now() / 1000);
  const ttl = Number.isFinite(ttlSeconds)
    ? Math.floor(ttlSeconds)
    : DEFAULT_SESSION_TTL_SECONDS;
  const fullPayload: SessionPayload = {
    sub: payload.sub,
    actor: payload.actor,
    scope: payload.scope,
    role: payload.role,
    email: payload.email,
    name: payload.name,
    restaurantId: payload.restaurantId ?? null,
    iat,
    exp: iat + ttl,
  };
  const payloadB64 = Buffer.from(
    JSON.stringify(fullPayload),
    "utf8"
  ).toString("base64url");
  const sig = signPayloadSegment(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = signPayloadSegment(payloadB64);
  if (providedSig.length !== expectedSig.length) return null;

  let sigMatches = false;
  try {
    sigMatches = crypto.timingSafeEqual(
      Buffer.from(providedSig, "utf8"),
      Buffer.from(expectedSig, "utf8")
    );
  } catch {
    return null;
  }
  if (!sigMatches) return null;

  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SessionPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.sub !== "string" || !parsed.sub) return null;
    if (parsed.actor !== "staff" && parsed.actor !== "customer") return null;
    if (
      parsed.scope !== "platform" &&
      parsed.scope !== "restaurant" &&
      parsed.scope !== "customer"
    ) {
      return null;
    }
    if (typeof parsed.role !== "string" || !parsed.role) return null;
    if (typeof parsed.email !== "string") return null;
    if (typeof parsed.name !== "string") return null;
    if (
      parsed.restaurantId !== null &&
      typeof parsed.restaurantId !== "string"
    ) {
      return null;
    }
    if (typeof parsed.iat !== "number" || !Number.isFinite(parsed.iat)) {
      return null;
    }
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (!(parsed.exp > nowSec)) {
      return null;
    }

    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

export function getRawSessionToken(req: NextRequest): string | null {
  try {
    const cookieVal = req.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
    if (typeof cookieVal === "string" && cookieVal.trim().length > 0) {
      return cookieVal.trim();
    }
  } catch {
    // Fallback to raw Cookie header if a plain Request object is passed
  }

  const cookieHeader = req.headers?.get?.("cookie");
  if (cookieHeader) {
    const pairs = cookieHeader.split(";");
    for (const pair of pairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      if (name !== SESSION_COOKIE_NAME) continue;
      const rawVal = pair.slice(eqIdx + 1).trim();
      if (!rawVal) continue;
      try {
        const decoded = decodeURIComponent(rawVal).trim();
        if (decoded.length > 0) return decoded;
      } catch {
        if (rawVal.length > 0) return rawVal;
      }
    }
  }

  const authHeader = req.headers?.get?.("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      const token = match[1].trim();
      if (token.length > 0) return token;
    }
  }

  return null;
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const rawToken = getRawSessionToken(req);
  return verifySessionToken(rawToken);
}

export function attachSessionCookie(
  res: NextResponse,
  token: string
): NextResponse {
  const decoded = verifySessionToken(token);
  const maxAge = decoded
    ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
    : DEFAULT_SESSION_TTL_SECONDS;

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}

export function isStrictAuthEnforced(): boolean {
  return process.env.PLATERIFT_ENFORCE_AUTH === "true";
}

function resolveSessionOrEnforce(req: NextRequest): AuthzResult {
  const rawToken = getRawSessionToken(req);
  if (rawToken !== null) {
    const session = verifySessionToken(rawToken);
    if (!session) {
      return {
        ok: false,
        status: 401,
        error: "Invalid or expired session token. Please sign in again.",
      };
    }
    return { ok: true, session };
  }

  if (isStrictAuthEnforced()) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required. Please sign in to continue.",
    };
  }

  return { ok: true, session: null };
}

export function authorizeStaffSessionPrecheck(req: NextRequest): AuthzResult {
  const base = resolveSessionOrEnforce(req);
  if (!base.ok) return base;
  if (base.session && base.session.actor !== "staff") {
    return {
      ok: false,
      status: 403,
      error: "Staff authentication required.",
    };
  }
  return base;
}

export function authorizePlatformAdmin(
  req: NextRequest,
  allowedRoles?: UserRole[]
): AuthzResult {
  const base = resolveSessionOrEnforce(req);
  if (!base.ok) return base;
  if (!base.session) return base;

  const { session } = base;
  if (session.actor !== "staff" || session.scope !== "platform") {
    return {
      ok: false,
      status: 403,
      error: "Platform administrator privileges required.",
    };
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(session.role as UserRole)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Your platform role is not permitted to perform this action.",
    };
  }

  return { ok: true, session };
}

export function authorizeRestaurantStaff(
  req: NextRequest,
  restaurantId: string,
  requiredTab?: PortalTabId
): AuthzResult {
  const base = authorizeStaffSessionPrecheck(req);
  if (!base.ok) return base;
  if (!base.session) return base;

  const { session } = base;

  if (session.scope === "platform") {
    return { ok: true, session };
  }

  if (session.scope !== "restaurant") {
    return {
      ok: false,
      status: 403,
      error: "Restaurant staff scope required.",
    };
  }

  if (!session.restaurantId || session.restaurantId !== restaurantId) {
    return {
      ok: false,
      status: 403,
      error: "Cross-tenant access denied for this restaurant.",
    };
  }

  if (requiredTab) {
    const roleDef = ROLE_DEFINITIONS[session.role as UserRole];
    if (!roleDef || !roleDef.allowedPortalTabs.includes(requiredTab)) {
      return {
        ok: false,
        status: 403,
        error: `Role "${session.role}" is not permitted to access "${requiredTab}".`,
      };
    }
  }

  return { ok: true, session };
}
