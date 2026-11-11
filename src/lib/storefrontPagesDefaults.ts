import type { RestaurantTenant, StorefrontPagesConfig } from "./types";

export function buildDefaultStorefrontPages(
  tenant: Pick<
    RestaurantTenant,
    | "name"
    | "slug"
    | "tagline"
    | "cuisine"
    | "description"
    | "ownerName"
    | "ownerEmail"
    | "phone"
    | "address"
    | "customDomain"
    | "heroBannerUrl"
    | "prepTimeMinutes"
    | "advanceNoticeDays"
    | "advanceNoticeHours"
  >
): StorefrontPagesConfig {
  const year = new Date().getFullYear();
  const leadTimeText =
    (tenant.advanceNoticeDays || 0) > 0 || (tenant.advanceNoticeHours || 0) > 0
      ? `${tenant.advanceNoticeDays ? `${tenant.advanceNoticeDays} day(s) ` : ""}${
          tenant.advanceNoticeHours ? `${tenant.advanceNoticeHours} hour(s) ` : ""
        }advance notice plus ~${tenant.prepTimeMinutes || 25} minutes kitchen preparation`
      : `approximately ${tenant.prepTimeMinutes || 25} minutes fresh-to-order preparation`;

  return {
    logoImageUrl: "",
    brandSubtitle: `${tenant.cuisine} • Direct Online Provisioning`,
    about: {
      enabled: true,
      badge: `About ${tenant.name}`,
      headline: `The Culinary Craft Behind ${tenant.name}`,
      subheadline: tenant.tagline || `Authentic ${tenant.cuisine} crafted fresh to order.`,
      storyParagraph1:
        tenant.description ||
        `Founded by ${tenant.ownerName}, ${tenant.name} brings authentic ${tenant.cuisine} directly from our kitchen to your table without third-party markups or middlemen.`,
      storyParagraph2: `Every dish on our menu is prepared in small batches using peak-season ingredients, time-honored culinary techniques, and bespoke packaging designed to preserve temperature and texture for pickup, local delivery, or table service at ${tenant.address}.`,
      chefOrFounderName: tenant.ownerName || "Executive Chef",
      chefOrFounderRole: "Founder & Executive Chef",
      chefQuote: `"When you order directly through ${tenant.customDomain}, 100% of your support goes straight to our kitchen team and local purveyors—allowing us to never compromise on ingredient quality."`,
      imageUrl:
        tenant.heroBannerUrl ||
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
      highlights: [
        {
          label: "Culinary Heritage",
          value: `Chef-driven ${tenant.cuisine}`,
        },
        {
          label: "Preparation Standard",
          value: `100% Fresh to Order (~${tenant.prepTimeMinutes || 25}m Prep)`,
        },
        {
          label: "Direct Guest Promise",
          value: "Zero Hidden Third-Party Commissions",
        },
      ],
    },
    privacyPolicy: {
      title: "Privacy & Data Protection Policy",
      lastUpdated: `November ${year}`,
      summary: `At ${tenant.name} (${tenant.customDomain}), we respect your privacy and are committed to protecting the personal data you share when ordering directly from our kitchen, joining our VIP loyalty program, or subscribing to SMS/Email updates.`,
      sections: [
        {
          id: "priv_1",
          heading: "1. Information We Collect",
          body: `When you place an order or register a VIP guest profile at ${tenant.name}, we collect your name, mobile phone number, email address, fulfillment preferences, delivery address (when applicable), and dietary/allergy notes so our kitchen and hospitality team can fulfill your order accurately.`,
        },
        {
          id: "priv_2",
          heading: "2. Direct Payment Processing (Stripe & PayPal)",
          body: `All credit card, Apple Pay, Google Pay, and PayPal transactions are processed directly through ${tenant.name}'s encrypted merchant gateways (Stripe and PayPal). We never store raw payment card numbers or CVV security codes on our servers.`,
        },
        {
          id: "priv_3",
          heading: "3. Automated Order SMS & Email Notifications",
          body: `We use your mobile number and email address to dispatch real-time transactional updates—including Order Confirmation, Kitchen Preparation, and Ready-for-Pickup/Delivery alerts. Promotional broadcasts are sent only to guests who explicitly opt in, and you may opt out at any time.`,
        },
        {
          id: "priv_4",
          heading: "4. Data Sharing & Zero Third-Party Broker Sales",
          body: `${tenant.name} never sells, rents, or trades your personal guest data to third-party data brokers or external advertising networks. Your order history and preferences remain strictly within ${tenant.name}'s private CRM.`,
        },
        {
          id: "priv_5",
          heading: "5. Your Privacy Rights & Contact",
          body: `You may view, update, or request deletion of your guest account and order history at any time by contacting ${tenant.ownerName} at ${tenant.ownerEmail} or calling ${tenant.phone}.`,
        },
      ],
    },
    termsAndConditions: {
      title: "Terms & Conditions of Service",
      lastUpdated: `November ${year}`,
      summary: `These Terms & Conditions govern all online orders, scheduled/recurring orders, table reservations, and digital services provided by ${tenant.name} via ${tenant.customDomain}.`,
      sections: [
        {
          id: "terms_1",
          heading: "1. Direct Online Ordering & Order Acceptance",
          body: `By placing an order on ${tenant.customDomain}, you are ordering directly from ${tenant.name} located at ${tenant.address}. All orders are subject to kitchen capacity, operating hours, and real-time ingredient availability.`,
        },
        {
          id: "terms_2",
          heading: "2. Preparation Lead Times & Advance Notice",
          body: `Our kitchen prepares every dish fresh to order and requires ${leadTimeText}. During peak dinner hours, hourly order throttling may apply to guarantee culinary quality.`,
        },
        {
          id: "terms_3",
          heading: "3. Menu Pricing, Taxes & Direct Settlement",
          body: `All menu prices are listed in USD and settle directly to ${tenant.name}'s merchant account. Applicable state/local taxes, optional staff gratuities, and delivery fees (where selected) are itemized transparently prior to checkout authorization.`,
        },
        {
          id: "terms_4",
          heading: "4. Cancellations, Refunds & Sold-Out (86'd) Items",
          body: `Because orders enter preparation immediately or according to your scheduled prep window, cancellations must be requested before kitchen preparation begins. If an item becomes unavailable (86'd), our team will contact you immediately via SMS/phone to offer a chef substitution or a full refund.`,
        },
        {
          id: "terms_5",
          heading: "5. Dietary Tags, Allergens & Guest Responsibility",
          body: `While ${tenant.name} offers dietary filters and custom kitchen notes, our dishes are prepared in a shared artisan kitchen that handles wheat/gluten, dairy, nuts, shellfish, soy, and eggs. Guests with severe allergies should contact us directly at ${tenant.phone} prior to ordering.`,
        },
      ],
    },
    orderingPolicy: {
      cancellationPolicy: `Orders may be modified or cancelled for a full refund prior to the kitchen starting preparation. For scheduled or catering orders, please notify ${tenant.name} at least 4 hours in advance at ${tenant.phone}.`,
      refundPolicy: `If any dish does not meet ${tenant.name}'s culinary standards or is missing from your order, please reach out within 24 hours at ${tenant.ownerEmail} or ${tenant.phone} for an immediate replacement, house credit, or refund to your original payment method.`,
      allergenDisclaimer: `Please include any food allergies in the Special Kitchen Instructions box at checkout. Cross-contact may occur in our kitchen environment.`,
    },
    footer: {
      tagline:
        tenant.tagline ||
        `Direct online ordering, bespoke catering, and VIP guest provisioning by ${tenant.name}.`,
      contactPhone: tenant.phone,
      contactEmail: tenant.ownerEmail,
      contactAddress: tenant.address,
      hoursSummary: "Mon–Thu 11:00 AM – 10:00 PM • Fri–Sat 11:00 AM – 11:30 PM • Sun 12:00 PM – 9:30 PM",
      instagramUrl: `https://instagram.com/${tenant.slug.replace(/-/g, "")}`,
      facebookUrl: `https://facebook.com/${tenant.slug.replace(/-/g, "")}`,
      tiktokUrl: "",
      websiteUrl: `https://${tenant.customDomain}`,
      copyrightText: `© ${year} ${tenant.name}. All rights reserved. Powered by Platerift Direct Merchant Ordering.`,
      showNewsletterSignup: true,
      customLinks: [
        {
          id: "lnk_menu",
          label: "Culinary Menu",
          href: `/store/${tenant.slug}#section-cat-0`,
          column: "navigation",
        },
        {
          id: "lnk_about",
          label: "About Our Kitchen",
          href: `/store/${tenant.slug}/about`,
          column: "navigation",
        },
        {
          id: "lnk_privacy",
          label: "Privacy Policy",
          href: `/store/${tenant.slug}/privacy`,
          column: "legal",
        },
        {
          id: "lnk_terms",
          label: "Terms & Conditions",
          href: `/store/${tenant.slug}/terms`,
          column: "legal",
        },
      ],
    },
  };
}

