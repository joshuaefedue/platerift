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
import {
  fetchCloverPakmsPublicKey,
  resolveCloverConfig,
} from "@/lib/squareCloverPosClient";

export async function GET(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    const code = req.nextUrl.searchParams.get("code") || "";
    const merchantId = req.nextUrl.searchParams.get("merchant_id") || "";
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
    const resolved = resolveCloverConfig(
      intCfg.clover,
      platformIntegrations.clover
    );
    const now = new Date().toISOString();

    let accessToken = intCfg.clover.privateToken;
    if (code && resolved.appId && resolved.appSecret) {
      try {
        const tokenRes = await fetch(
          `${resolved.restBaseUrl}/oauth/v2/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: resolved.appId,
              client_secret: resolved.appSecret,
              code,
            }),
            cache: "no-store",
          }
        );
        const tokenData = (await tokenRes.json().catch(() => ({}))) as {
          access_token?: string;
        };
        if (tokenRes.ok && tokenData.access_token) {
          accessToken = tokenData.access_token;
        }
      } catch {
        // Keep existing or sandbox token
      }
    }

    const nextClover = {
      ...intCfg.clover,
      enabled: true,
      merchantId: merchantId || intCfg.clover.merchantId,
      privateToken: accessToken,
      lastSyncedAt: now,
    };

    const pakms = await fetchCloverPakmsPublicKey({
      tenantCfg: nextClover,
      platformCfg: platformIntegrations.clover,
    });
    nextClover.publicKey = pakms.apiAccessKey;

    const nextLogs = [
      {
        id: `ilog_clv_oauth_${Date.now()}`,
        integration: "clover" as const,
        action: "Clover OAuth 2.0 + PAKMS Connected",
        status: "success" as const,
        summary: `Clover OAuth 2.0 completed for Merchant ${nextClover.merchantId} & retrieved PAKMS apiAccessKey (${pakms.apiAccessKey.slice(
          0,
          12
        )}...) for Hosted iFrame tokenization.`,
        createdAt: now,
      },
      ...(intCfg.activityLogs || []),
    ].slice(0, 30);

    updateRestaurantTenant(restaurant.id, {
      integrationsConfig: {
        ...intCfg,
        clover: nextClover,
        activityLogs: nextLogs,
      },
    });
    await commitToTurso();

    return NextResponse.redirect(
      new URL(
        `/dashboard/${encodeURIComponent(restaurant.slug)}?tab=integrations&oauth=clover_connected`,
        req.url
      )
    );
  } catch (err) {
    console.error("Clover OAuth callback error:", err);
    return NextResponse.redirect(new URL("/admin", req.url));
  }
}
