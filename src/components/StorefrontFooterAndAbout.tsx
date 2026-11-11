"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  Info,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Phone,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import type { RestaurantTenant, StorefrontPagesConfig } from "@/lib/types";
import { buildDefaultStorefrontPages } from "@/lib/storefrontPagesDefaults";

export function formatSpacedBrandName(name: string): string {
  const firstWord = (name.split(" ")[0] || name).toUpperCase();
  return firstWord.split("").join(" ");
}

export function getResolvedStorefrontPages(
  restaurant: RestaurantTenant
): StorefrontPagesConfig {
  const defaults = buildDefaultStorefrontPages(restaurant);
  if (!restaurant.storefrontPages) return defaults;
  return {
    ...defaults,
    ...restaurant.storefrontPages,
    about: {
      ...defaults.about,
      ...(restaurant.storefrontPages.about || {}),
      highlights:
        restaurant.storefrontPages.about?.highlights?.length
          ? restaurant.storefrontPages.about.highlights
          : defaults.about.highlights,
    },
    privacyPolicy: {
      ...defaults.privacyPolicy,
      ...(restaurant.storefrontPages.privacyPolicy || {}),
      sections:
        restaurant.storefrontPages.privacyPolicy?.sections?.length
          ? restaurant.storefrontPages.privacyPolicy.sections
          : defaults.privacyPolicy.sections,
    },
    termsAndConditions: {
      ...defaults.termsAndConditions,
      ...(restaurant.storefrontPages.termsAndConditions || {}),
      sections:
        restaurant.storefrontPages.termsAndConditions?.sections?.length
          ? restaurant.storefrontPages.termsAndConditions.sections
          : defaults.termsAndConditions.sections,
    },
    orderingPolicy: {
      ...defaults.orderingPolicy,
      ...(restaurant.storefrontPages.orderingPolicy || {}),
    },
    footer: {
      ...defaults.footer,
      ...(restaurant.storefrontPages.footer || {}),
      customLinks:
        restaurant.storefrontPages.footer?.customLinks !== undefined
          ? restaurant.storefrontPages.footer.customLinks
          : defaults.footer.customLinks,
    },
  };
}

export function StorefrontBrandLogo({
  restaurant,
  brandColor,
  compact = false,
}: {
  restaurant: RestaurantTenant;
  brandColor: string;
  compact?: boolean;
}) {
  const pages = getResolvedStorefrontPages(restaurant);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {pages.logoImageUrl ? (
        <img
          src={pages.logoImageUrl}
          alt={restaurant.name}
          className={`${
            compact ? "h-8 w-8" : "h-10 w-10"
          } shrink-0 rounded-xl object-cover border border-zinc-700 bg-zinc-900`}
        />
      ) : (
        <span
          className={`flex ${
            compact ? "h-8 w-8 text-lg" : "h-10 w-10 text-xl"
          } shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 shadow-inner`}
        >
          {restaurant.logoEmoji}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`truncate ${
              compact
                ? "text-base sm:text-xl tracking-[0.12em] sm:tracking-[0.22em]"
                : "text-lg sm:text-2xl tracking-[0.16em] sm:tracking-[0.22em]"
            } font-serif font-bold text-white`}
          >
            {formatSpacedBrandName(restaurant.name)}
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: brandColor }}
          />
        </div>
        {!compact && pages.brandSubtitle && (
          <p className="truncate text-[10px] font-mono uppercase tracking-widest text-zinc-400">
            {pages.brandSubtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function StorefrontAboutSection({
  restaurant,
  brandColor,
}: {
  restaurant: RestaurantTenant;
  brandColor: string;
}) {
  const pages = getResolvedStorefrontPages(restaurant);
  const { about, footer } = pages;

  if (!about.enabled) return null;

  return (
    <section
      id="about-section"
      className="border-b border-zinc-900 bg-gradient-to-b from-[#0b0c10] via-[#0e1017] to-[#0b0c10] py-12 sm:py-16 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left 7 Columns: Story, Highlights & Chef Quote */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1 text-[11px] font-mono uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5" style={{ color: brandColor }} />
              <span style={{ color: brandColor }}>{about.badge}</span>
            </div>

            <div className="space-y-3">
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white leading-tight">
                {about.headline}
              </h2>
              {about.subheadline && (
                <p
                  className="text-sm sm:text-base font-medium"
                  style={{ color: brandColor }}
                >
                  {about.subheadline}
                </p>
              )}
            </div>

            <div className="space-y-4 text-sm sm:text-base text-zinc-300 leading-relaxed font-light">
              {about.storyParagraph1 && <p>{about.storyParagraph1}</p>}
              {about.storyParagraph2 && <p>{about.storyParagraph2}</p>}
            </div>

            {/* 3 Key Highlights */}
            {about.highlights && about.highlights.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                {about.highlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 p-4 space-y-1"
                  >
                    <p
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: brandColor }}
                    >
                      {hl.label}
                    </p>
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {hl.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Chef / Founder Quote Box */}
            {about.chefQuote && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
                <p className="font-serif italic text-sm sm:text-base text-zinc-200 leading-relaxed">
                  {about.chefQuote}
                </p>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black"
                      style={{ backgroundColor: brandColor }}
                    >
                      {(about.chefOrFounderName || restaurant.ownerName)
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {about.chefOrFounderName || restaurant.ownerName}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-400">
                        {about.chefOrFounderRole || "Founder & Executive Chef"}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/store/${restaurant.slug}/about`}
                    style={{ color: brandColor }}
                    className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider hover:underline"
                  >
                    Read Full Story <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Columns: Visual Showcase & Direct Contact Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 aspect-[4/3] shadow-2xl">
              <img
                src={about.imageUrl || restaurant.heroBannerUrl}
                alt={about.headline}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-4 backdrop-blur-md space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: brandColor }}
                    />
                    {footer.contactAddress || restaurant.address}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
                  <a
                    href={`tel:${footer.contactPhone || restaurant.phone}`}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <Phone
                      className="h-3 w-3"
                      style={{ color: brandColor }}
                    />
                    {footer.contactPhone || restaurant.phone}
                  </a>
                  <a
                    href={`mailto:${footer.contactEmail || restaurant.ownerEmail}`}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <Mail
                      className="h-3 w-3"
                      style={{ color: brandColor }}
                    />
                    {footer.contactEmail || restaurant.ownerEmail}
                  </a>
                </div>
                {footer.hoursSummary && (
                  <p className="text-[10px] font-mono text-zinc-400 border-t border-zinc-800 pt-1.5 flex items-center gap-1.5">
                    <Clock
                      className="h-3 w-3 shrink-0"
                      style={{ color: brandColor }}
                    />
                    <span className="truncate">{footer.hoursSummary}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Quick Policy & Transparency Strip */}
            <div className="grid grid-cols-3 gap-2.5">
              <Link
                href={`/store/${restaurant.slug}/about`}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-center hover:border-zinc-700 transition"
              >
                <Info className="h-4 w-4" style={{ color: brandColor }} />
                <span className="text-[11px] font-semibold text-white">
                  About Us
                </span>
                <span className="text-[10px] text-zinc-400">Our Story</span>
              </Link>
              <Link
                href={`/store/${restaurant.slug}/privacy`}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-center hover:border-zinc-700 transition"
              >
                <ShieldCheck
                  className="h-4 w-4"
                  style={{ color: brandColor }}
                />
                <span className="text-[11px] font-semibold text-white">
                  Privacy Policy
                </span>
                <span className="text-[10px] text-zinc-400">Data & SMS</span>
              </Link>
              <Link
                href={`/store/${restaurant.slug}/terms`}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-center hover:border-zinc-700 transition"
              >
                <Scale className="h-4 w-4" style={{ color: brandColor }} />
                <span className="text-[11px] font-semibold text-white">
                  Terms & Rules
                </span>
                <span className="text-[10px] text-zinc-400">
                  Refunds & Prep
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StorefrontFooter({
  restaurant,
  brandColor,
}: {
  restaurant: RestaurantTenant;
  brandColor: string;
}) {
  const pages = getResolvedStorefrontPages(restaurant);
  const { footer, orderingPolicy } = pages;
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const navLinks = footer.customLinks.filter((l) => l.column === "navigation");
  const legalLinks = footer.customLinks.filter(
    (l) => l.column === "legal" || l.column === "resources"
  );

  return (
    <footer
      id="contact-footer"
      className="border-t border-zinc-800/90 bg-[#07080b] text-zinc-400 pb-24 lg:pb-10"
    >
      {/* Top Policy Highlights Banner */}
      <div className="border-b border-zinc-900 bg-zinc-950/60 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Clock className="h-4 w-4 shrink-0" style={{ color: brandColor }} />
              <span>Cancellation & Scheduling Policy</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
              {orderingPolicy.cancellationPolicy}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck
                className="h-4 w-4 shrink-0"
                style={{ color: brandColor }}
              />
              <span>Direct Quality & Refund Guarantee</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
              {orderingPolicy.refundPolicy}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-white">
              <UtensilsCrossed
                className="h-4 w-4 shrink-0"
                style={{ color: brandColor }}
              />
              <span>Allergen & Dietary Transparency</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
              {orderingPolicy.allergenDisclaimer}
            </p>
          </div>
        </div>
      </div>

      {/* Main 4-Column Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* Col 1 (4 cols): Brand Logo, Tagline, Domain Badge & Newsletter */}
          <div className="lg:col-span-4 space-y-4">
            <Link href={`/store/${restaurant.slug}`} className="inline-block">
              <StorefrontBrandLogo
                restaurant={restaurant}
                brandColor={brandColor}
              />
            </Link>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {footer.tagline || restaurant.description}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[10px] text-zinc-300">
                <Lock className="h-3 w-3 text-emerald-400" />
                https://{restaurant.customDomain}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] text-zinc-400">
                SSL Verified
              </span>
            </div>

            {/* Social Media Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {footer.instagramUrl && (
                <a
                  href={footer.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition"
                >
                  Instagram
                </a>
              )}
              {footer.facebookUrl && (
                <a
                  href={footer.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition"
                >
                  Facebook
                </a>
              )}
              {footer.tiktokUrl && (
                <a
                  href={footer.tiktokUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition"
                >
                  TikTok
                </a>
              )}
              {footer.websiteUrl && (
                <a
                  href={footer.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition"
                >
                  Official Site
                </a>
              )}
            </div>

            {/* Optional VIP Newsletter Signup */}
            {footer.showNewsletterSignup && (
              <div className="pt-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mb-2">
                  Join {restaurant.name} VIP Table & Tasting Alerts
                </p>
                {newsletterSubscribed ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      You&apos;re subscribed to {restaurant.name} VIP updates!
                    </span>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newsletterEmail.trim()) {
                        setNewsletterSubscribed(true);
                        setNewsletterEmail("");
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      required
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="Enter your email for VIP offers..."
                      className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      style={{ backgroundColor: brandColor, color: "#000" }}
                      className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Col 2 (2 cols): Storefront Navigation Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4
              className="text-xs font-mono uppercase tracking-widest font-semibold"
              style={{ color: brandColor }}
            >
              Navigation
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link
                  href={`/store/${restaurant.slug}`}
                  className="text-zinc-300 hover:text-white transition"
                >
                  Online Ordering Menu
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${restaurant.slug}#about-section`}
                  className="text-zinc-300 hover:text-white transition"
                >
                  About {restaurant.name}
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${restaurant.slug}/about`}
                  className="text-zinc-300 hover:text-white transition"
                >
                  Our Culinary Story
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${restaurant.slug}#provisioning-desk`}
                  className="text-zinc-300 hover:text-white transition"
                >
                  Provisioning Cart & Schedule
                </Link>
              </li>
              {navLinks
                .filter(
                  (l) =>
                    !l.href.endsWith("/about") &&
                    !l.href.includes("#section-cat-0")
                )
                .map((lnk) => (
                  <li key={lnk.id}>
                    <Link
                      href={lnk.href}
                      className="text-zinc-300 hover:text-white transition"
                    >
                      {lnk.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Col 3 (3 cols): Legal, Privacy Policy & Terms and Conditions */}
          <div className="lg:col-span-3 space-y-3">
            <h4
              className="text-xs font-mono uppercase tracking-widest font-semibold"
              style={{ color: brandColor }}
            >
              Policies & Legal
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link
                  href={`/store/${restaurant.slug}/privacy`}
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition"
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: brandColor }}
                  />
                  <span>Privacy & Data Protection Policy</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${restaurant.slug}/terms`}
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition"
                >
                  <Scale
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: brandColor }}
                  />
                  <span>Terms & Conditions of Service</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${restaurant.slug}/terms#refund-policy`}
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition"
                >
                  <FileText
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: brandColor }}
                  />
                  <span>Cancellation & Refund Policy</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${restaurant.slug}/terms#allergen-policy`}
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition"
                >
                  <UtensilsCrossed
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: brandColor }}
                  />
                  <span>Allergen & Dietary Disclosure</span>
                </Link>
              </li>
              {legalLinks
                .filter(
                  (l) =>
                    !l.href.endsWith("/privacy") && !l.href.endsWith("/terms")
                )
                .map((lnk) => (
                  <li key={lnk.id}>
                    <Link
                      href={lnk.href}
                      className="text-zinc-300 hover:text-white transition"
                    >
                      {lnk.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Col 4 (3 cols): Contact Information, Address, Hours & Owner Portal Link */}
          <div className="lg:col-span-3 space-y-3">
            <h4
              className="text-xs font-mono uppercase tracking-widest font-semibold"
              style={{ color: brandColor }}
            >
              Contact & Location
            </h4>
            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-start gap-2.5">
                <MapPin
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: brandColor }}
                />
                <span>{footer.contactAddress || restaurant.address}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone
                  className="h-4 w-4 shrink-0"
                  style={{ color: brandColor }}
                />
                <a
                  href={`tel:${footer.contactPhone || restaurant.phone}`}
                  className="hover:text-white transition font-mono"
                >
                  {footer.contactPhone || restaurant.phone}
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail
                  className="h-4 w-4 shrink-0"
                  style={{ color: brandColor }}
                />
                <a
                  href={`mailto:${footer.contactEmail || restaurant.ownerEmail}`}
                  className="hover:text-white transition truncate"
                >
                  {footer.contactEmail || restaurant.ownerEmail}
                </a>
              </div>
              {footer.hoursSummary && (
                <div className="flex items-start gap-2.5 pt-1 text-[11px] text-zinc-400">
                  <Clock
                    className="h-4 w-4 shrink-0 mt-0.5"
                    style={{ color: brandColor }}
                  />
                  <span>{footer.hoursSummary}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Link
                href={`/dashboard/${restaurant.slug}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-zinc-200 hover:border-zinc-600 hover:text-white transition"
              >
                <LayoutDashboard
                  className="h-3.5 w-3.5"
                  style={{ color: brandColor }}
                />
                <span>Manage Pages in Owner Dashboard</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Settlement Bar */}
        <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <p>{footer.copyrightText}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/store/${restaurant.slug}/about`}
              className="hover:text-zinc-300 transition"
            >
              About Us
            </Link>
            <Link
              href={`/store/${restaurant.slug}/privacy`}
              className="hover:text-zinc-300 transition"
            >
              Privacy Policy
            </Link>
            <Link
              href={`/store/${restaurant.slug}/terms`}
              className="hover:text-zinc-300 transition"
            >
              Terms & Conditions
            </Link>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400">
              <CreditCard className="h-3 w-3" style={{ color: brandColor }} />
              Stripe & PayPal Direct
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function StorefrontStandalonePageView({
  slug,
  pageType,
}: {
  slug: string;
  pageType: "about" | "privacy" | "terms";
}) {
  const [restaurant, setRestaurant] = useState<RestaurantTenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          setRestaurant(data.restaurant);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c10] text-zinc-300">
        <div className="flex items-center gap-3 text-sm font-mono uppercase tracking-widest">
          <Sparkles className="h-5 w-5 animate-spin text-amber-400" />
          Loading Storefront Page...
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0c10] text-zinc-200 p-6">
        <p className="text-lg font-serif">Restaurant not found</p>
        <Link
          href="/admin"
          className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Super Admin Console
        </Link>
      </div>
    );
  }

  const brandColor = restaurant.primaryColor || "#d4af37";
  const pages = getResolvedStorefrontPages(restaurant);
  const { about, privacyPolicy, termsAndConditions, orderingPolicy, footer } =
    pages;

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-300 font-sans antialiased flex flex-col justify-between">
      <div>
        {/* Top Concierge Bar */}
        <div className="bg-zinc-950 border-b border-zinc-800/80 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 tracking-widest uppercase text-zinc-400 text-[10px] sm:text-[11px] truncate">
              <Sparkles
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: brandColor }}
              />
              <span className="truncate">
                {restaurant.name} — Official Storefront Information & Policies
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 font-mono text-[10px] text-zinc-300">
                <Lock className="h-2.5 w-2.5 text-emerald-400" />
                https://{restaurant.customDomain}
              </span>
              <Link
                href={`/dashboard/${restaurant.slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:border-amber-400 transition"
              >
                <LayoutDashboard className="h-2.5 w-2.5" /> Edit in Owner Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Sticky Navbar */}
        <nav className="sticky top-0 z-40 bg-[#0b0c10]/90 backdrop-blur-md border-b border-zinc-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
            <Link href={`/store/${restaurant.slug}`} className="min-w-0">
              <StorefrontBrandLogo
                restaurant={restaurant}
                brandColor={brandColor}
                compact
              />
            </Link>

            <div className="no-scrollbar flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
              <Link
                href={`/store/${restaurant.slug}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 sm:px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Menu</span>
              </Link>
              <Link
                href={`/store/${restaurant.slug}/about`}
                style={
                  pageType === "about"
                    ? { backgroundColor: brandColor, color: "#000" }
                    : undefined
                }
                className={`shrink-0 rounded-full px-3 sm:px-4 py-2 text-xs font-semibold transition ${
                  pageType === "about"
                    ? "shadow"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
              >
                About Us
              </Link>
              <Link
                href={`/store/${restaurant.slug}/privacy`}
                style={
                  pageType === "privacy"
                    ? { backgroundColor: brandColor, color: "#000" }
                    : undefined
                }
                className={`shrink-0 rounded-full px-3 sm:px-4 py-2 text-xs font-semibold transition ${
                  pageType === "privacy"
                    ? "shadow"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
              >
                Privacy Policy
              </Link>
              <Link
                href={`/store/${restaurant.slug}/terms`}
                style={
                  pageType === "terms"
                    ? { backgroundColor: brandColor, color: "#000" }
                    : undefined
                }
                className={`shrink-0 rounded-full px-3 sm:px-4 py-2 text-xs font-semibold transition ${
                  pageType === "terms"
                    ? "shadow"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
              >
                Terms & Conditions
              </Link>
            </div>
          </div>
        </nav>

        {/* Page Body */}
        {pageType === "about" && (
          <div>
            <StorefrontAboutSection
              restaurant={restaurant}
              brandColor={brandColor}
            />
            {/* Extended Contact & Hospitality Commitment Section on Dedicated About Page */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <span
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: brandColor }}
                    >
                      Direct Hospitality & Guest Support
                    </span>
                    <h3 className="font-serif text-2xl text-white mt-1">
                      Visit or Contact {restaurant.name}
                    </h3>
                  </div>
                  <Link
                    href={`/store/${restaurant.slug}`}
                    style={{ backgroundColor: brandColor, color: "#000" }}
                    className="rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition"
                  >
                    Order Online Now →
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-1.5">
                    <p className="text-[10px] font-mono uppercase text-zinc-400">
                      Kitchen Address
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {footer.contactAddress || restaurant.address}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-1.5">
                    <p className="text-[10px] font-mono uppercase text-zinc-400">
                      Direct Telephone & SMS
                    </p>
                    <p className="text-sm font-semibold text-white font-mono">
                      {footer.contactPhone || restaurant.phone}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-1.5">
                    <p className="text-[10px] font-mono uppercase text-zinc-400">
                      Concierge & Events Email
                    </p>
                    <p className="text-sm font-semibold text-white truncate">
                      {footer.contactEmail || restaurant.ownerEmail}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {pageType === "privacy" && (
          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 sm:p-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-mono uppercase tracking-widest">
                <ShieldCheck
                  className="h-3.5 w-3.5"
                  style={{ color: brandColor }}
                />
                <span style={{ color: brandColor }}>
                  {restaurant.name} • Official Privacy Policy
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl text-white">
                {privacyPolicy.title}
              </h1>
              <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Last Updated: {privacyPolicy.lastUpdated} • Domain:{" "}
                https://{restaurant.customDomain}
              </p>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed pt-2">
                {privacyPolicy.summary}
              </p>
            </div>

            <div className="space-y-4">
              {privacyPolicy.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-6 space-y-2.5"
                >
                  <h2 className="font-serif text-xl text-white">
                    {sec.heading}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>
          </main>
        )}

        {pageType === "terms" && (
          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 sm:p-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-mono uppercase tracking-widest">
                <Scale className="h-3.5 w-3.5" style={{ color: brandColor }} />
                <span style={{ color: brandColor }}>
                  {restaurant.name} • Terms & Ordering Rules
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl text-white">
                {termsAndConditions.title}
              </h1>
              <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Last Updated: {termsAndConditions.lastUpdated} • Merchant:{" "}
                {restaurant.name}
              </p>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed pt-2">
                {termsAndConditions.summary}
              </p>
            </div>

            <div className="space-y-4">
              {termsAndConditions.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-6 space-y-2.5"
                >
                  <h2 className="font-serif text-xl text-white">
                    {sec.heading}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Dedicated Refund, Cancellation & Allergen Policy Cards */}
            <div
              id="refund-policy"
              className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4"
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-2">
                <h3
                  className="text-xs font-mono uppercase tracking-widest font-bold"
                  style={{ color: brandColor }}
                >
                  Order Cancellation Policy
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {orderingPolicy.cancellationPolicy}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-2">
                <h3
                  className="text-xs font-mono uppercase tracking-widest font-bold"
                  style={{ color: brandColor }}
                >
                  Refund & Quality Guarantee
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {orderingPolicy.refundPolicy}
                </p>
              </div>
              <div
                id="allergen-policy"
                className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-2"
              >
                <h3
                  className="text-xs font-mono uppercase tracking-widest font-bold"
                  style={{ color: brandColor }}
                >
                  Allergen & Shared Kitchen Disclosure
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {orderingPolicy.allergenDisclaimer}
                </p>
              </div>
            </div>
          </main>
        )}
      </div>

      <StorefrontFooter restaurant={restaurant} brandColor={brandColor} />
    </div>
  );
}

