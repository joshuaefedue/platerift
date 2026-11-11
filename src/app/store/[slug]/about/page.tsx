"use client";

import React from "react";
import { useParams } from "next/navigation";
import { StorefrontStandalonePageView } from "@/components/StorefrontFooterAndAbout";

export default function RestaurantAboutPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug || "bella-napoli");
  return <StorefrontStandalonePageView slug={slug} pageType="about" />;
}

