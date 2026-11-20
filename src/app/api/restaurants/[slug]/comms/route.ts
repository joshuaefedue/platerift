import { NextRequest, NextResponse } from "next/server";
import {
  commitToTurso,
  createEmailCampaign,
  createSmsLog,
  getDb,
  getPlatformTwilioConfig,
  getRestaurantBySlugOrDomain,
  hydrateFromTursoIfNeeded,
  listCustomers,
  syncPlatformSettingFromTurso,
} from "@/lib/db";
import { sanitizeHtmlContent } from "@/lib/security";
import {
  authorizeRestaurantStaff,
  authorizeStaffSessionPrecheck,
} from "@/lib/session";
import type { EmailCampaign, SmsLog } from "@/lib/types";

const MAX_LIVE_DISPATCH_PER_REQUEST = 25;

interface ResolvedLiveTwilio {
  accountSid: string;
  authToken: string;
  fromPhone: string;
  messagingServiceSid: string;
}

function hasValidTwilioCredentials(params: {
  enabled?: boolean;
  mode?: string;
  accountSid?: string;
  authToken?: string;
}): boolean {
  const accountSid = (params.accountSid || "").trim();
  const authToken = (params.authToken || "").trim();
  return Boolean(
    params.enabled &&
      params.mode === "live" &&
      accountSid &&
      authToken &&
      !accountSid.startsWith("AC_PLATERIFT_") &&
      !accountSid.startsWith("AC_SIMULATED_") &&
      !authToken.startsWith("platerift_master_") &&
      authToken !== "TWILIO_SIMULATED_TOKEN"
  );
}

function resolveLiveTwilioConfig(
  platformTwilio: ReturnType<typeof getPlatformTwilioConfig>,
  tenantSms?: {
    enabled?: boolean;
    mode?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    senderPhone?: string;
  }
): ResolvedLiveTwilio | null {
  if (hasValidTwilioCredentials(platformTwilio)) {
    const msgSvc = (platformTwilio.messagingServiceSid || "").trim();
    return {
      accountSid: platformTwilio.accountSid.trim(),
      authToken: platformTwilio.authToken.trim(),
      fromPhone: (
        platformTwilio.senderPhone ||
        tenantSms?.senderPhone ||
        ""
      ).trim(),
      messagingServiceSid:
        msgSvc && !msgSvc.startsWith("MG_PLATERIFT_") ? msgSvc : "",
    };
  }

  if (
    tenantSms &&
    hasValidTwilioCredentials({
      enabled: tenantSms.enabled,
      mode: tenantSms.mode,
      accountSid: tenantSms.twilioAccountSid,
      authToken: tenantSms.twilioAuthToken,
    })
  ) {
    return {
      accountSid: (tenantSms.twilioAccountSid || "").trim(),
      authToken: (tenantSms.twilioAuthToken || "").trim(),
      fromPhone: (tenantSms.senderPhone || "").trim(),
      messagingServiceSid: "",
    };
  }

  return null;
}

function normalizeTwilioPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return trimmed;
}

async function dispatchTwilioSms(params: {
  creds: ResolvedLiveTwilio;
  to: string;
  body: string;
}): Promise<{
  ok: boolean;
  status: SmsLog["status"];
  warning?: string;
}> {
  const toNumber = normalizeTwilioPhone(params.to);
  if (!toNumber) {
    return {
      ok: false,
      status: "failed",
      warning: "Missing recipient phone number for Twilio SMS.",
    };
  }

  const formParams = new URLSearchParams({
    To: toNumber,
    Body: params.body,
  });

  const fromNumber = normalizeTwilioPhone(params.creds.fromPhone);
  if (fromNumber) {
    formParams.set("From", fromNumber);
  } else if (params.creds.messagingServiceSid) {
    formParams.set("MessagingServiceSid", params.creds.messagingServiceSid);
  } else {
    return {
      ok: false,
      status: "failed",
      warning:
        "Twilio sender phone number (From) or MessagingServiceSid is missing.",
    };
  }

  try {
    const authHeader = Buffer.from(
      `${params.creds.accountSid}:${params.creds.authToken}`,
      "utf8"
    ).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        params.creds.accountSid
      )}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formParams.toString(),
        cache: "no-store",
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        status: "failed",
        warning: `Twilio API error (${res.status}): ${
          data.message || "Unable to deliver SMS"
        }`,
      };
    }

    const twStatus = String(data.status || "").toLowerCase();
    const mappedStatus: SmsLog["status"] =
      twStatus === "delivered" || twStatus === "sent"
        ? "delivered"
        : twStatus === "failed" || twStatus === "undelivered"
        ? "failed"
        : "queued";

    return {
      ok: mappedStatus !== "failed",
      status: mappedStatus,
      ...(mappedStatus === "failed"
        ? { warning: `Twilio returned status "${twStatus}"` }
        : {}),
    };
  } catch (err) {
    return {
      ok: false,
      status: "failed",
      warning: `Twilio network error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

function recordSmsLogWithStatus(input: {
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  triggerType: SmsLog["triggerType"];
  message: string;
  provider: SmsLog["provider"];
  status: SmsLog["status"];
}): SmsLog {
  const log = createSmsLog({
    restaurantId: input.restaurantId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    triggerType: input.triggerType,
    message: input.message,
    provider: input.provider,
  });
  if (input.status !== log.status) {
    getDb()
      .prepare("UPDATE sms_logs SET status = ? WHERE id = ?")
      .run(input.status, log.id);
    log.status = input.status;
  }
  return log;
}

function isRealResendApiKey(apiKey: string | undefined): boolean {
  const key = (apiKey || "").trim();
  if (!key || !key.startsWith("re_")) return false;
  if (key === "re_simulated_key") return false;
  if (key.includes("_live_")) return false;
  if (key.includes("placeholder") || key.includes("simulated")) return false;
  return true;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const preAuth = authorizeStaffSessionPrecheck(req);
    if (!preAuth.ok) {
      return NextResponse.json(
        { error: preAuth.error },
        { status: preAuth.status }
      );
    }

    await hydrateFromTursoIfNeeded();
    await syncPlatformSettingFromTurso("twilio_gateway");
    const { slug } = await context.params;
    const restaurant = getRestaurantBySlugOrDomain(decodeURIComponent(slug));
    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const baseAuthz = authorizeRestaurantStaff(req, restaurant.id);
    if (!baseAuthz.ok) {
      return NextResponse.json(
        { error: baseAuthz.error },
        { status: baseAuthz.status }
      );
    }

    const body = await req.json();

    if (body.action === "send_sms") {
      const smsAuthz = authorizeRestaurantStaff(req, restaurant.id, "sms");
      if (!smsAuthz.ok) {
        return NextResponse.json(
          { error: smsAuthz.error },
          { status: smsAuthz.status }
        );
      }
      const rawMessage = String(body.message || "");
      if (!rawMessage.trim()) {
        return NextResponse.json(
          { error: "SMS message is required" },
          { status: 400 }
        );
      }

      const platformTwilio = getPlatformTwilioConfig();
      const liveCreds = resolveLiveTwilioConfig(
        platformTwilio,
        restaurant.commsConfig?.sms
      );
      const provider: SmsLog["provider"] = liveCreds
        ? "twilio_live"
        : "twilio_simulated";

      if (body.broadcastToAll) {
        const optedInCustomers = listCustomers(restaurant.id).filter(
          (c) => c.smsOptIn
        );
        const targets = liveCreds
          ? optedInCustomers.slice(0, MAX_LIVE_DISPATCH_PER_REQUEST)
          : optedInCustomers;
        const warnings: string[] = [];
        if (
          liveCreds &&
          optedInCustomers.length > MAX_LIVE_DISPATCH_PER_REQUEST
        ) {
          warnings.push(
            `Live SMS broadcast capped at ${MAX_LIVE_DISPATCH_PER_REQUEST} recipients per request (${optedInCustomers.length} opted in).`
          );
        }

        const logs: SmsLog[] = [];
        let liveDispatchedCount = 0;

        for (const c of targets) {
          const personalized = rawMessage.replace(
            /\{\{customer_name\}\}/g,
            c.name
          );
          let smsStatus: SmsLog["status"] = "delivered";

          if (liveCreds) {
            const dispatch = await dispatchTwilioSms({
              creds: liveCreds,
              to: c.phone,
              body: personalized,
            });
            smsStatus = dispatch.status;
            if (dispatch.ok) {
              liveDispatchedCount += 1;
            } else if (dispatch.warning) {
              warnings.push(`${c.name}: ${dispatch.warning}`);
            }
          }

          logs.push(
            recordSmsLogWithStatus({
              restaurantId: restaurant.id,
              customerName: c.name,
              customerPhone: c.phone,
              triggerType: "broadcast",
              message: personalized,
              provider,
              status: smsStatus,
            })
          );
        }

        await commitToTurso();
        const sentCount = logs.filter((l) => l.status !== "failed").length;
        return NextResponse.json({
          sentCount,
          totalAttempted: logs.length,
          logs,
          liveDispatched: liveDispatchedCount > 0,
          liveDispatchedCount,
          ...(warnings.length > 0
            ? { warning: warnings[0], warnings }
            : {}),
        });
      }

      const recipientName = String(body.customerName || "Valued Guest");
      const recipientPhone = String(body.customerPhone || "+1 (555) 010-9999");
      let smsStatus: SmsLog["status"] = "delivered";
      let liveDispatched = false;
      let warning: string | undefined;

      if (liveCreds) {
        const dispatch = await dispatchTwilioSms({
          creds: liveCreds,
          to: recipientPhone,
          body: rawMessage,
        });
        smsStatus = dispatch.status;
        liveDispatched = dispatch.ok;
        warning = dispatch.warning;
      }

      const smsLog = recordSmsLogWithStatus({
        restaurantId: restaurant.id,
        customerName: recipientName,
        customerPhone: recipientPhone,
        triggerType: "manual",
        message: rawMessage,
        provider,
        status: smsStatus,
      });

      await commitToTurso();
      return NextResponse.json({
        smsLog,
        liveDispatched,
        ...(warning ? { warning } : {}),
      });
    }

    if (body.action === "send_email_campaign") {
      const emailAuthz = authorizeRestaurantStaff(req, restaurant.id, "email");
      if (!emailAuthz.ok) {
        return NextResponse.json(
          { error: emailAuthz.error },
          { status: emailAuthz.status }
        );
      }
      const segment = (String(body.segment || "all") ||
        "all") as EmailCampaign["segment"];
      const campaignName = String(
        body.name || body.subject || "Promotional Campaign"
      );
      const campaignSubject = String(
        body.subject || body.name || "Special Offer from Our Kitchen"
      );
      const rawBodyHtml = String(
        body.bodyHtml || "<p>Special offer from our kitchen!</p>"
      );
      const cleanSubject = sanitizeHtmlContent(campaignSubject);
      const cleanBodyHtml = sanitizeHtmlContent(rawBodyHtml);

      const emailCfg = restaurant.commsConfig?.email;
      const shouldSendLiveResend = Boolean(
        emailCfg?.enabled !== false &&
          emailCfg?.mode === "live" &&
          (emailCfg?.provider || "resend") === "resend" &&
          isRealResendApiKey(emailCfg?.apiKeyOrSmtpHost)
      );

      let liveSentCount = 0;
      const warnings: string[] = [];

      if (shouldSendLiveResend && emailCfg) {
        const resendApiKey = emailCfg.apiKeyOrSmtpHost.trim();
        const fromEmail = (
          emailCfg.fromEmail ||
          restaurant.ownerEmail ||
          "onboarding@resend.dev"
        ).trim();
        const fromName = (emailCfg.fromName || restaurant.name || "").trim();
        const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        const optedInCustomers = listCustomers(restaurant.id).filter(
          (c) => c.emailOptIn && c.email && c.email.includes("@")
        );
        const matchingCustomers = optedInCustomers.filter((c) => {
          if (segment === "vip") return c.vipStatus;
          if (segment === "repeat") return c.totalOrders >= 2;
          if (segment === "inactive") {
            if (!c.lastOrderAt) return true;
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            return new Date(c.lastOrderAt).getTime() < thirtyDaysAgo;
          }
          return true;
        });

        const recipients = matchingCustomers.slice(
          0,
          MAX_LIVE_DISPATCH_PER_REQUEST
        );
        if (matchingCustomers.length > MAX_LIVE_DISPATCH_PER_REQUEST) {
          warnings.push(
            `Live email send capped at ${MAX_LIVE_DISPATCH_PER_REQUEST} recipients per request (${matchingCustomers.length} matched).`
          );
        }

        for (const cust of recipients) {
          try {
            const htmlForCustomer = cleanBodyHtml.replace(
              /\{\{customer_name\}\}/g,
              cust.name
            );
            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: fromHeader,
                to: [cust.email],
                subject: cleanSubject,
                html: htmlForCustomer,
              }),
              cache: "no-store",
            });

            if (resendRes.ok) {
              liveSentCount += 1;
            } else {
              const errData = (await resendRes.json().catch(() => ({}))) as {
                message?: string;
                name?: string;
              };
              warnings.push(
                `Resend error for ${cust.email} (${resendRes.status}): ${
                  errData.message || errData.name || "Failed to send"
                }`
              );
            }
          } catch (err) {
            warnings.push(
              `Resend network error for ${cust.email}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      }

      const campaign = createEmailCampaign({
        restaurantId: restaurant.id,
        name: campaignName,
        subject: campaignSubject,
        segment,
        promoCode: body.promoCode,
        discountPercent: body.discountPercent
          ? Number(body.discountPercent)
          : undefined,
        bodyHtml: rawBodyHtml,
      });

      await commitToTurso();
      return NextResponse.json(
        {
          campaign,
          liveSentCount,
          liveDispatched: liveSentCount > 0,
          ...(warnings.length > 0
            ? { warning: warnings[0], warnings }
            : {}),
        },
        { status: 201 }
      );
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
