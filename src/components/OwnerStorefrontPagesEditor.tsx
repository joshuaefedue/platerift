"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  ImagePlus,
  Info,
  Layout,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  RestaurantTenant,
  StorefrontFooterLink,
  StorefrontPagesConfig,
} from "@/lib/types";
import { buildDefaultStorefrontPages } from "@/lib/storefrontPagesDefaults";
import {
  getResolvedStorefrontPages,
  StorefrontBrandLogo,
} from "./StorefrontFooterAndAbout";

type EditorSubTab = "logo_about" | "footer_contact" | "privacy" | "terms";

export function OwnerStorefrontPagesEditor({
  restaurant,
  onChangeRestaurant,
  onSavePatch,
}: {
  restaurant: RestaurantTenant;
  onChangeRestaurant: (next: RestaurantTenant) => void;
  onSavePatch: (
    patch: Partial<RestaurantTenant>,
    toastMessage: string
  ) => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<EditorSubTab>("logo_about");
  const [saving, setSaving] = useState(false);

  const pages: StorefrontPagesConfig = getResolvedStorefrontPages(restaurant);

  const updatePages = (nextPages: StorefrontPagesConfig) => {
    onChangeRestaurant({
      ...restaurant,
      storefrontPages: nextPages,
    });
  };

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onLoadedUrl: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLoadedUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async (customToast?: string) => {
    setSaving(true);
    try {
      await onSavePatch(
        {
          logoEmoji: restaurant.logoEmoji,
          storefrontPages: pages,
        },
        customToast ||
          "✨ Saved Storefront About, Privacy Policy, Terms & Conditions, Logo & Footer!"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const freshDefaults = buildDefaultStorefrontPages(restaurant);
    updatePages(freshDefaults);
    await onSavePatch(
      { storefrontPages: freshDefaults },
      "🔄 Reset About, Policies, Terms & Footer to default templates for " +
        restaurant.name
    );
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 space-y-6">
      {/* Header & Live Storefront Page Links */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
            <Layout className="h-3 w-3" /> Easy Website Builder • Logo, About Us & Policies
          </span>
          <h3 className="mt-1.5 text-lg font-bold text-white">
            🎨 Edit Your Logo, &quot;About Us&quot; Story, Bottom Footer & Store Policies
          </h3>
          <p className="text-xs text-slate-300">
            Type in the simple boxes below and click <strong>Save</strong> —
            your customer website updates immediately (no coding needed!).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/store/${restaurant.slug}/about`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-orange-500/50 hover:text-white transition"
          >
            <Info className="h-3.5 w-3.5 text-orange-400" />
            <span>About Page</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </Link>
          <Link
            href={`/store/${restaurant.slug}/privacy`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Privacy Policy</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </Link>
          <Link
            href={`/store/${restaurant.slug}/terms`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/50 hover:text-white transition"
          >
            <Scale className="h-3.5 w-3.5 text-sky-400" />
            <span>Terms & Conditions</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </Link>
        </div>
      </div>

      {/* Sub-navigation Pills */}
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(
          [
            {
              id: "logo_about" as const,
              label: "1. Logo & About Us Section",
              icon: Info,
            },
            {
              id: "footer_contact" as const,
              label: "2. Footer, Contact & Links",
              icon: Link2,
            },
            {
              id: "privacy" as const,
              label: "3. Privacy Policy Page",
              icon: ShieldCheck,
            },
            {
              id: "terms" as const,
              label: "4. Terms, Refunds & Allergens",
              icon: Scale,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* SUB-TAB 1: LOGO & ABOUT US SECTION / PAGE                         */}
      {/* ================================================================= */}
      {subTab === "logo_about" && (
        <div className="space-y-6">
          {/* Brand Logo & Header/Footer Identity */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Storefront Logo & Brand Header/Footer Identity
                </h4>
                <p className="text-xs text-slate-400">
                  Displayed in the sticky navigation bar, standalone policy
                  pages, and storefront footer.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#0b0c10] px-4 py-2.5">
                <StorefrontBrandLogo
                  restaurant={restaurant}
                  brandColor={restaurant.primaryColor}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Logo Emoji Icon
                </label>
                <input
                  type="text"
                  value={restaurant.logoEmoji}
                  onChange={(e) =>
                    onChangeRestaurant({
                      ...restaurant,
                      logoEmoji: e.target.value,
                    })
                  }
                  placeholder="🍕"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Brand Subtitle (Shown Under Logo)
                </label>
                <input
                  type="text"
                  value={pages.brandSubtitle}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      brandSubtitle: e.target.value,
                    })
                  }
                  placeholder="Wood-Fired Pizza • Direct Ordering"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Custom Logo Image URL (Optional)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={pages.logoImageUrl}
                    onChange={(e) =>
                      updatePages({
                        ...pages,
                        logoImageUrl: e.target.value,
                      })
                    }
                    placeholder="https://... or upload image →"
                    className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                  <label className="shrink-0 inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                    <ImagePlus className="h-3.5 w-3.5 text-orange-400" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageFileUpload(e, (url) =>
                          updatePages({ ...pages, logoImageUrl: url })
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* About Us Section & Page Content */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  About Us Section & Dedicated `/store/{restaurant.slug}/about` Page
                </h4>
                <p className="text-xs text-slate-400">
                  Share your culinary heritage, chef philosophy, and sourcing
                  standards with guests.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pages.about.enabled}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: { ...pages.about, enabled: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded"
                />
                <span>Show About Section on Storefront</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Section Badge Label
                </label>
                <input
                  type="text"
                  value={pages.about.badge}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: { ...pages.about, badge: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300">
                  About Headline
                </label>
                <input
                  type="text"
                  value={pages.about.headline}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: { ...pages.about, headline: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Subheadline / Culinary Tagline
              </label>
              <input
                type="text"
                value={pages.about.subheadline}
                onChange={(e) =>
                  updatePages({
                    ...pages,
                    about: { ...pages.about, subheadline: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Story Paragraph 1 (Origins & Culinary Craft)
                </label>
                <textarea
                  rows={4}
                  value={pages.about.storyParagraph1}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: {
                        ...pages.about,
                        storyParagraph1: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Story Paragraph 2 (Ingredients & Hospitality)
                </label>
                <textarea
                  rows={4}
                  value={pages.about.storyParagraph2}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: {
                        ...pages.about,
                        storyParagraph2: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Chef / Founder Name
                </label>
                <input
                  type="text"
                  value={pages.about.chefOrFounderName}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: {
                        ...pages.about,
                        chefOrFounderName: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Chef / Founder Title
                </label>
                <input
                  type="text"
                  value={pages.about.chefOrFounderRole}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      about: {
                        ...pages.about,
                        chefOrFounderRole: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  About Showcase Photo URL
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={pages.about.imageUrl}
                    onChange={(e) =>
                      updatePages({
                        ...pages,
                        about: { ...pages.about, imageUrl: e.target.value },
                      })
                    }
                    className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                  <label className="shrink-0 inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                    <ImagePlus className="h-3.5 w-3.5 text-orange-400" />
                    <span>Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageFileUpload(e, (url) =>
                          updatePages({
                            ...pages,
                            about: { ...pages.about, imageUrl: url },
                          })
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Chef / Founder Quote
              </label>
              <input
                type="text"
                value={pages.about.chefQuote}
                onChange={(e) =>
                  updatePages({
                    ...pages,
                    about: { ...pages.about, chefQuote: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            {/* 3 Highlights Editor */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                About Section Key Highlights (3 Pillars)
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {pages.about.highlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2"
                  >
                    <input
                      type="text"
                      value={hl.label}
                      onChange={(e) => {
                        const next = [...pages.about.highlights];
                        next[idx] = { ...hl, label: e.target.value };
                        updatePages({
                          ...pages,
                          about: { ...pages.about, highlights: next },
                        });
                      }}
                      placeholder="Highlight Label"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-mono text-orange-300"
                    />
                    <input
                      type="text"
                      value={hl.value}
                      onChange={(e) => {
                        const next = [...pages.about.highlights];
                        next[idx] = { ...hl, value: e.target.value };
                        updatePages({
                          ...pages,
                          about: { ...pages.about, highlights: next },
                        });
                      }}
                      placeholder="Highlight Value"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: FOOTER, CONTACT INFO & CUSTOM LINKS                    */}
      {/* ================================================================= */}
      {subTab === "footer_contact" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Storefront Footer Contact Details, Social Links & Copyright
                </h4>
                <p className="text-xs text-slate-400">
                  Customize the contact details, operating hours summary, social
                  profiles, and newsletter signup shown in the storefront footer.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pages.footer.showNewsletterSignup}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        showNewsletterSignup: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded"
                />
                <span>Show VIP Newsletter Signup in Footer</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Footer Brand Tagline
                </label>
                <input
                  type="text"
                  value={pages.footer.tagline}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: { ...pages.footer, tagline: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Operating Hours Summary (Footer & About Card)
                </label>
                <input
                  type="text"
                  value={pages.footer.hoursSummary}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        hoursSummary: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-orange-400" /> Contact Phone
                </label>
                <input
                  type="text"
                  value={pages.footer.contactPhone}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        contactPhone: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-orange-400" /> Contact Email
                </label>
                <input
                  type="email"
                  value={pages.footer.contactEmail}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        contactEmail: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-orange-400" /> Physical Address
                </label>
                <input
                  type="text"
                  value={pages.footer.contactAddress}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        contactAddress: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Instagram URL
                </label>
                <input
                  type="text"
                  value={pages.footer.instagramUrl}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        instagramUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="https://instagram.com/..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Facebook URL
                </label>
                <input
                  type="text"
                  value={pages.footer.facebookUrl}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        facebookUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="https://facebook.com/..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  TikTok URL
                </label>
                <input
                  type="text"
                  value={pages.footer.tiktokUrl}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        tiktokUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="https://tiktok.com/@..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Main Website URL
                </label>
                <input
                  type="text"
                  value={pages.footer.websiteUrl}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      footer: {
                        ...pages.footer,
                        websiteUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Footer Copyright Notice
              </label>
              <input
                type="text"
                value={pages.footer.copyrightText}
                onChange={(e) =>
                  updatePages({
                    ...pages,
                    footer: {
                      ...pages.footer,
                      copyrightText: e.target.value,
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* Custom Footer Links Manager */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Custom Footer Navigation & Policy Links ({pages.footer.customLinks.length})
                </h4>
                <p className="text-xs text-slate-400">
                  Add extra links (e.g., Catering Inquiry, Gift Cards, Press
                  Kit, Careers, Nutrition PDF) to your storefront footer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newLink: StorefrontFooterLink = {
                    id: `lnk_${Date.now()}`,
                    label: "Private Events & Catering",
                    href: `/store/${restaurant.slug}/about`,
                    column: "navigation",
                  };
                  updatePages({
                    ...pages,
                    footer: {
                      ...pages.footer,
                      customLinks: [...pages.footer.customLinks, newLink],
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/20 border border-orange-500/40 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Footer Link
              </button>
            </div>

            <div className="space-y-2.5">
              {pages.footer.customLinks.map((lnk, idx) => (
                <div
                  key={lnk.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-slate-800 bg-slate-900 p-3"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={lnk.label}
                      onChange={(e) => {
                        const next = [...pages.footer.customLinks];
                        next[idx] = { ...lnk, label: e.target.value };
                        updatePages({
                          ...pages,
                          footer: { ...pages.footer, customLinks: next },
                        });
                      }}
                      placeholder="Link Label"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={lnk.href}
                      onChange={(e) => {
                        const next = [...pages.footer.customLinks];
                        next[idx] = { ...lnk, href: e.target.value };
                        updatePages({
                          ...pages,
                          footer: { ...pages.footer, customLinks: next },
                        });
                      }}
                      placeholder="/store/... or https://..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-sky-300"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      value={lnk.column}
                      onChange={(e) => {
                        const next = [...pages.footer.customLinks];
                        next[idx] = {
                          ...lnk,
                          column: e.target.value as StorefrontFooterLink["column"],
                        };
                        updatePages({
                          ...pages,
                          footer: { ...pages.footer, customLinks: next },
                        });
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="navigation">Navigation Col</option>
                      <option value="legal">Policies Col</option>
                      <option value="resources">Resources Col</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const next = pages.footer.customLinks.filter(
                          (item) => item.id !== lnk.id
                        );
                        updatePages({
                          ...pages,
                          footer: { ...pages.footer, customLinks: next },
                        });
                      }}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
                      title="Remove Link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 3: PRIVACY & DATA PROTECTION POLICY PAGE                  */}
      {/* ================================================================= */}
      {subTab === "privacy" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Privacy Policy Page (`/store/{restaurant.slug}/privacy`)
                </h4>
                <p className="text-xs text-slate-400">
                  Customize how {restaurant.name} discloses guest data usage,
                  Stripe/PayPal security, and Twilio SMS notifications.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextSections = [
                    ...pages.privacyPolicy.sections,
                    {
                      id: `priv_${Date.now()}`,
                      heading: `${pages.privacyPolicy.sections.length + 1}. Additional Privacy Clause`,
                      body: `Enter ${restaurant.name}'s custom privacy policy details here.`,
                    },
                  ];
                  updatePages({
                    ...pages,
                    privacyPolicy: {
                      ...pages.privacyPolicy,
                      sections: nextSections,
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Policy Section
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300">
                  Privacy Policy Title
                </label>
                <input
                  type="text"
                  value={pages.privacyPolicy.title}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      privacyPolicy: {
                        ...pages.privacyPolicy,
                        title: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Effective / Last Updated Date
                </label>
                <input
                  type="text"
                  value={pages.privacyPolicy.lastUpdated}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      privacyPolicy: {
                        ...pages.privacyPolicy,
                        lastUpdated: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Executive Summary Paragraph
              </label>
              <textarea
                rows={2}
                value={pages.privacyPolicy.summary}
                onChange={(e) =>
                  updatePages({
                    ...pages,
                    privacyPolicy: {
                      ...pages.privacyPolicy,
                      summary: e.target.value,
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-3 pt-2">
              {pages.privacyPolicy.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={sec.heading}
                      onChange={(e) => {
                        const next = [...pages.privacyPolicy.sections];
                        next[idx] = { ...sec, heading: e.target.value };
                        updatePages({
                          ...pages,
                          privacyPolicy: {
                            ...pages.privacyPolicy,
                            sections: next,
                          },
                        });
                      }}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = pages.privacyPolicy.sections.filter(
                          (s) => s.id !== sec.id
                        );
                        updatePages({
                          ...pages,
                          privacyPolicy: {
                            ...pages.privacyPolicy,
                            sections: next,
                          },
                        });
                      }}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                      title="Delete Section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={sec.body}
                    onChange={(e) => {
                      const next = [...pages.privacyPolicy.sections];
                      next[idx] = { ...sec, body: e.target.value };
                      updatePages({
                        ...pages,
                        privacyPolicy: {
                          ...pages.privacyPolicy,
                          sections: next,
                        },
                      });
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 4: TERMS & CONDITIONS + REFUND / CANCELLATION / ALLERGENS */}
      {/* ================================================================= */}
      {subTab === "terms" && (
        <div className="space-y-6">
          {/* Quick Ordering, Cancellation, Refund & Allergen Policies */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white">
                Cancellation, Refund & Allergen Disclosures (Shown in Footer & Terms Page)
              </h4>
              <p className="text-xs text-slate-400">
                Highlighted across the storefront footer and on{" "}
                <code>/store/{restaurant.slug}/terms</code>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-orange-300">
                  Order Cancellation Policy
                </label>
                <textarea
                  rows={3}
                  value={pages.orderingPolicy.cancellationPolicy}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      orderingPolicy: {
                        ...pages.orderingPolicy,
                        cancellationPolicy: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-emerald-300">
                  Refund & Quality Guarantee Policy
                </label>
                <textarea
                  rows={3}
                  value={pages.orderingPolicy.refundPolicy}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      orderingPolicy: {
                        ...pages.orderingPolicy,
                        refundPolicy: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-300">
                  Allergen & Shared Kitchen Disclaimer
                </label>
                <textarea
                  rows={3}
                  value={pages.orderingPolicy.allergenDisclaimer}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      orderingPolicy: {
                        ...pages.orderingPolicy,
                        allergenDisclaimer: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Full Terms & Conditions Sections */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Terms & Conditions Page (`/store/{restaurant.slug}/terms`)
                </h4>
                <p className="text-xs text-slate-400">
                  Manage the legal terms governing online orders, lead times,
                  and payments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextSections = [
                    ...pages.termsAndConditions.sections,
                    {
                      id: `terms_${Date.now()}`,
                      heading: `${pages.termsAndConditions.sections.length + 1}. Additional Service Term`,
                      body: `Enter ${restaurant.name}'s custom terms & conditions clause here.`,
                    },
                  ];
                  updatePages({
                    ...pages,
                    termsAndConditions: {
                      ...pages.termsAndConditions,
                      sections: nextSections,
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/20 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add Terms Section
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300">
                  Terms & Conditions Page Title
                </label>
                <input
                  type="text"
                  value={pages.termsAndConditions.title}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      termsAndConditions: {
                        ...pages.termsAndConditions,
                        title: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Effective / Last Updated Date
                </label>
                <input
                  type="text"
                  value={pages.termsAndConditions.lastUpdated}
                  onChange={(e) =>
                    updatePages({
                      ...pages,
                      termsAndConditions: {
                        ...pages.termsAndConditions,
                        lastUpdated: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Introductory Terms Summary
              </label>
              <textarea
                rows={2}
                value={pages.termsAndConditions.summary}
                onChange={(e) =>
                  updatePages({
                    ...pages,
                    termsAndConditions: {
                      ...pages.termsAndConditions,
                      summary: e.target.value,
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-3 pt-2">
              {pages.termsAndConditions.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={sec.heading}
                      onChange={(e) => {
                        const next = [...pages.termsAndConditions.sections];
                        next[idx] = { ...sec, heading: e.target.value };
                        updatePages({
                          ...pages,
                          termsAndConditions: {
                            ...pages.termsAndConditions,
                            sections: next,
                          },
                        });
                      }}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = pages.termsAndConditions.sections.filter(
                          (s) => s.id !== sec.id
                        );
                        updatePages({
                          ...pages,
                          termsAndConditions: {
                            ...pages.termsAndConditions,
                            sections: next,
                          },
                        });
                      }}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                      title="Delete Section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={sec.body}
                    onChange={(e) => {
                      const next = [...pages.termsAndConditions.sections];
                      next[idx] = { ...sec, body: e.target.value };
                      updatePages({
                        ...pages,
                        termsAndConditions: {
                          ...pages.termsAndConditions,
                          sections: next,
                        },
                      });
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save & Reset Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to Default Templates
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => handleSaveAll()}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving
            ? "Saving Storefront Pages..."
            : "Save All Pages, Policies, Logo & Footer"}
        </button>
      </div>
    </div>
  );
}

export default OwnerStorefrontPagesEditor;


