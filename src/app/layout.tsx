import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0b0c10",
};

export const metadata: Metadata = {
  title: "Platerift — Multi-Tenant Restaurant Ordering & Management SaaS",
  description:
    "Create and customize restaurants from your Platerift Super Admin dashboard, connect custom domains, take online orders with per-tenant Stripe & PayPal, manage menus, order limits, schedules, SMS notifications, and email campaigns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..800;1,400..800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0b0c10] text-zinc-200 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
