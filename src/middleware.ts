import { NextRequest, NextResponse } from "next/server";

const PLATFORM_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "platerift.app",
  "www.platerift.app",
  "platerift.com",
  "www.platerift.com",
]);

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostHeader = req.headers.get("host") || "";
  const hostname = hostHeader.split(":")[0].toLowerCase();

  // Skip internal Next.js assets and API routes
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Support custom domain simulation via ?domain=orders.bellanapoli.com
  const simulatedDomain = url.searchParams.get("domain");
  if (simulatedDomain && url.pathname === "/") {
    url.pathname = `/store/${encodeURIComponent(simulatedDomain)}`;
    return NextResponse.rewrite(url);
  }

  // Route tenant subdomains on platerift.com (e.g. bella-napoli.platerift.com) to their storefront
  const isTenantPlateriftSubdomain =
    hostname.endsWith(".platerift.com") &&
    !PLATFORM_HOSTS.has(hostname) &&
    !hostname.startsWith("api.") &&
    !hostname.startsWith("admin.");

  // Always serve the Marketing Landing Page at "/" on primary platform / local / Vercel hosts
  const isPlatformOrDefaultHost =
    !isTenantPlateriftSubdomain &&
    (PLATFORM_HOSTS.has(hostname) ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".vercel.app") ||
      hostname.includes("platerift"));

  if (!isPlatformOrDefaultHost) {
    // Only rewrite to /store/<hostname> if a restaurant explicitly mapped a verified custom domain
    if (
      !url.pathname.startsWith("/store/") &&
      !url.pathname.startsWith("/dashboard/") &&
      !url.pathname.startsWith("/admin")
    ) {
      url.pathname = `/store/${hostname}${
        url.pathname === "/" ? "" : url.pathname
      }`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
