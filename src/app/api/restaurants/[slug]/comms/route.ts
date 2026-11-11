import { NextRequest, NextResponse } from "next/server";
import {
  createEmailCampaign,
  createSmsLog,
  getPlatformTwilioConfig,
  getRestaurantBySlugOrDomain,
  listCustomers,
} from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    if (body.action === "send_sms") {
      const platformTwilio = getPlatformTwilioConfig();
      const provider =
        platformTwilio.mode === "live"
          ? "twilio_live"
          : "twilio_simulated";

      if (body.broadcastToAll) {
        const optedInCustomers = listCustomers(restaurant.id).filter(
          (c) => c.smsOptIn
        );
        const logs = optedInCustomers.map((c) =>
          createSmsLog({
            restaurantId: restaurant.id,
            customerName: c.name,
            customerPhone: c.phone,
            triggerType: "broadcast",
            message: body.message.replace(/\{\{customer_name\}\}/g, c.name),
            provider,
          })
        );
        return NextResponse.json({ sentCount: logs.length, logs });
      }

      const smsLog = createSmsLog({
        restaurantId: restaurant.id,
        customerName: body.customerName || "Valued Guest",
        customerPhone: body.customerPhone || "+1 (555) 010-9999",
        triggerType: "manual",
        message: body.message,
        provider,
      });

      return NextResponse.json({ smsLog });
    }

    if (body.action === "send_email_campaign") {
      const campaign = createEmailCampaign({
        restaurantId: restaurant.id,
        name: body.name,
        subject: body.subject,
        segment: body.segment || "all",
        promoCode: body.promoCode,
        discountPercent: body.discountPercent
          ? Number(body.discountPercent)
          : undefined,
        bodyHtml: body.bodyHtml || "<p>Special offer from our kitchen!</p>",
      });

      return NextResponse.json({ campaign }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST comms error:", error);
    return NextResponse.json(
      { error: "Failed to execute communications action" },
      { status: 500 }
    );
  }
}
