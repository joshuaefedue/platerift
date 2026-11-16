import { NextRequest, NextResponse } from "next/server";
import {
  commitPlatformSettingToTurso,
  commitToTurso,
  getPlatformIntegrationsConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listRestaurants,
  syncPlatformSettingFromTurso,
  updatePlatformIntegrationsConfig,
  updateRestaurantTenant,
} from "@/lib/db";

export async function GET() {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");
    const config = getPlatformIntegrationsConfig();
    const restaurants = listRestaurants();
    return NextResponse.json({
      config,
      tenantCount: restaurants.length,
    });
  } catch (err) {
    console.error("Error fetching platform integrations config:", err);
    return NextResponse.json(
      { error: "Failed to load platform integrations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("platform_integrations");
    const body = await req.json();

    // 1. One-Click "Finish Setup & Release All 4 Integrations to Restaurant Owners"
    if (body.action === "finish_and_publish_all") {
      const current = getPlatformIntegrationsConfig();
      const updatedConfig = updatePlatformIntegrationsConfig({
        doordashDrive: {
          ...current.doordashDrive,
          setupCompleted: true,
          availableToOwners: true,
        },
        square: {
          ...current.square,
          setupCompleted: true,
          availableToOwners: true,
        },
        clover: {
          ...current.clover,
          setupCompleted: true,
          availableToOwners: true,
        },
        vapi: {
          ...current.vapi,
          setupCompleted: true,
          availableToOwners: true,
        },
      });

      // Also enable all 4 feature flags across all existing tenants
      const tenants = listRestaurants();
      for (const tenant of tenants) {
        updateRestaurantTenant(tenant.id, {
          features: {
            ...tenant.features,
            doordashDrive: true,
            squarePos: true,
            cloverPos: true,
            vapiVoiceAi: true,
          },
        });
      }

      await commitPlatformSettingToTurso("platform_integrations", updatedConfig);
      await commitToTurso();
      return NextResponse.json({
        ok: true,
        config: updatedConfig,
      });
    }

    // 2. Toggle a specific integration feature flag on a specific Restaurant Tenant
    if (body.action === "toggle_tenant_integration") {
      const restaurantId = String(body.restaurantId || "");
      const featureKey = String(body.featureKey || "") as
        | "doordashDrive"
        | "squarePos"
        | "cloverPos"
        | "vapiVoiceAi";
      const enabled = Boolean(body.enabled);

      const tenant = getRestaurantBySlugOrDomain(restaurantId);
      if (!tenant) {
        return NextResponse.json(
          { error: "Restaurant tenant not found" },
          { status: 404 }
        );
      }

      const updatedTenant = updateRestaurantTenant(tenant.id, {
        features: {
          ...tenant.features,
          [featureKey]: enabled,
        },
      });

      await commitToTurso();
      return NextResponse.json({
        ok: true,
        restaurant: updatedTenant,
      });
    }

    // 3. Save updated PlatformIntegrationsConfig from Super Admin Console
    const updated = updatePlatformIntegrationsConfig(body.config || body);
    await commitPlatformSettingToTurso("platform_integrations", updated);
    await commitToTurso();
    return NextResponse.json({
      ok: true,
      config: updated,
    });
  } catch (err) {
    console.error("Error updating platform integrations:", err);
    return NextResponse.json(
      { error: "Failed to update platform integrations" },
      { status: 500 }
    );
  }
}

