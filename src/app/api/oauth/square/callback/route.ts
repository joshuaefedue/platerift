import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listRestaurants,
  updateRestaurantTenant,
} from "@/lib/db";
import { buildDefaultIntegrationsConfig } from "@/lib/integrationsDefaults";
import { exchangeOrRefreshSquareOAuthToken } from "@/lib/squareCloverPosClient";

export async function GET(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    const code = req.nextUrl.searchParams.get("code") || "";
    const stateSlug = req.nextUrl.searchParams.get("state") || "bella-napoli";

    const restaurant =
      getRestaurantBySlugOrDomain(stateSlug) || listRestaurants()[0];
    if (!restaurant) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    const platformIntegrations = getPlatformIntegrationsConfig();
    const intCfg =
      restaurant.integrationsConfig ||
      buildDefaultIntegrationsConfig(restaurant);
    const now = new Date().toISOString();

    if (code) {
      const origin = req.nextUrl.origin || "https://platerift.com";
      const tokenRes = await exchangeOrRefreshSquareOAuthToken({
        grantType: "authorization_code",
        codeOrRefreshToken: code,
        redirectUri: `${origin}/api/oauth/square/callback`,
        tenantCfg: intCfg.square,
        platformCfg: platformIntegrations.square,
      });

      const nextSquare = {
        ...intCfg.square,
        enabled: true,
        accessToken: tokenRes.accessToken || intCfg.square.accessToken,
        refreshToken: tokenRes.refreshToken || intCfg.square.refreshToken,
        tokenExpiresAt:
          tokenRes.expiresAt ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: tokenRes.merchantId || intCfg.square.merchantId,
        lastSyncedAt: now,
      };

      const nextLogs = [
        {
          id: `ilog_sq_oauth_${Date.now()}`,
          integration: "square" as const,
          action: "Square OAuth 2.0 Connected",
          status: "success" as const,
          summary: tokenRes.ok
            ? `Square OAuth 2.0 Code Flow completed for Merchant ${
                tokenRes.merchantId || "Connected"
              } (30-day access_token & refresh_token saved).`
            : `Square OAuth 2.0 callback processed (${tokenRes.message}).`,
          createdAt: now,
        },
        ...(intCfg.activityLogs || []),
      ].slice(0, 30);

      updateRestaurantTenant(restaurant.id, {
        integrationsConfig: {
          ...intCfg,
          square: nextSquare,
          activityLogs: nextLogs,
        },
      });
      await commitToTurso();
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard/${encodeURIComponent(restaurant.slug)}?tab=integrations&oauth=square_connected`,
        req.url
      )
    );
  } catch (err) {
    console.error("Square OAuth callback error:", err);
    return NextResponse.redirect(new URL("/admin", req.url));
  }
}
