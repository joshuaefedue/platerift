import { NextRequest, NextResponse } from "next/server";
import {
  commitPlatformSettingToTurso,
  commitToTurso,
  createSmsLog,
  getPlatformTwilioConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listAllPlatformSmsLogs,
  syncPlatformSettingFromTurso,
  updatePlatformTwilioConfig,
} from "@/lib/db";
import { authorizePlatformAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const authz = authorizePlatformAdmin(req);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("twilio_gateway");
    const config = getPlatformTwilioConfig();
    const recentSmsLogs = listAllPlatformSmsLogs(50);
    return NextResponse.json({
      config,
      recentSmsLogs,
    });
  } catch (error) {
    console.error("GET /api/platform/twilio error:", error);
    return NextResponse.json(
      { error: "Failed to load platform Twilio configuration" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authz = authorizePlatformAdmin(req);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("twilio_gateway");
    const body = await req.json();

    // Action 1: Test Order Notification to a Restaurant Owner
    if (body.action === "test_owner_alert") {
      const config = getPlatformTwilioConfig();
      const restaurant = getRestaurantBySlugOrDomain(
        String(body.restaurantId || "rest_bella_napoli")
      );
      if (!restaurant) {
        return NextResponse.json(
          { error: "Restaurant not found" },
          { status: 404 }
        );
      }

      const targetPhone =
        restaurant.commsConfig.sms.ownerAlertPhone || restaurant.phone;
      const sampleOrderNum = `${restaurant.name
        .slice(0, 2)
        .toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const msg = config.ownerNewOrderTemplate
        .replace(/\{\{restaurant_name\}\}/g, restaurant.name)
        .replace(/\{\{order_type\}\}/g, "DELIVERY")
        .replace(/\{\{order_number\}\}/g, sampleOrderNum)
        .replace(/\{\{total\}\}/g, "$68.50")
        .replace(/\{\{customer_name\}\}/g, "Sophia Vance (Test Order)")
        .replace(/\{\{prep_time\}\}/g, String(restaurant.prepTimeMinutes))
        .replace(/\{\{owner_name\}\}/g, restaurant.ownerName);

      const smsLog = createSmsLog({
        restaurantId: restaurant.id,
        customerName: `${restaurant.ownerName} (Restaurant Owner)`,
        customerPhone: targetPhone,
        triggerType: "owner_new_order_alert",
        message: msg,
        provider: config.mode === "live" ? "twilio_live" : "twilio_simulated",
      });

      await commitToTurso();
      const recentSmsLogs = listAllPlatformSmsLogs(50);
      return NextResponse.json({
        smsLog,
        recentSmsLogs,
      });
    }

    // Action 2: Save Super Admin Platform Twilio Gateway Config
    const updated = updatePlatformTwilioConfig(body);
    await commitPlatformSettingToTurso("twilio_gateway", updated);
    await commitToTurso();
    const recentSmsLogs = listAllPlatformSmsLogs(50);
    return NextResponse.json({
      config: updated,
      recentSmsLogs,
    });
  } catch (error) {
    console.error("POST /api/platform/twilio error:", error);
    return NextResponse.json(
      { error: "Failed to update platform Twilio configuration" },
      { status: 500 }
    );
  }
}
