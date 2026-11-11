import { NextRequest, NextResponse } from "next/server";

const PLATFORM_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "platerift.app",
  "www.platerift.app",
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

  // Support custom domain simulation on localhost via ?domain=orders.bellanapoli.com
  const simulatedDomain = url.searchParams.get("domain");
  if (simulatedDomain && url.pathname === "/") {
    url.pathname = `/store/${encodeURIComponent(simulatedDomain)}`;
    return NextResponse.rewrite(url);
  }

  // Real Host-header multi-tenant Custom Domain & Subdomain routing
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".vercel.app");

  if (!PLATFORM_HOSTS.has(hostname) && !isLocal) {
    // If a customer accesses https://orders.bellanapoli.com/ directly,
    // rewrite transparently to /store/orders.bellanapoli.com
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
