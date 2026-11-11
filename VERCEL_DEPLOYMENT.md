# Platerift — Vercel Deployment Guide

This guide walks you step-by-step through deploying the **Platerift Multi-Tenant Restaurant & Food Truck Platform** to **Vercel**, including custom tenant domain routing, webhook configuration (**DoorDash Drive**, **Square**, **Clover**, **Vapi Voice AI**), Node.js 22 runtime settings, and database persistence options.

---

## 1. Pre-Deployment Readiness (Already Configured in Code)

To ensure a zero-error build and runtime on Vercel Serverless Functions, the following have already been configured in your repository:

1. **Node.js 22 Runtime (`node:sqlite`)** — [package.json](file:///c:/Users/Jefedue/Desktop/SAAS/package.json#L5-L7) specifies `"engines": { "node": "22.x" }` so Vercel provisions Node 22.x (which includes the built-in `node:sqlite` engine).
2. **Serverless-Safe Writable Database Directory (`/tmp`)** — [db.ts](file:///c:/Users/Jefedue/Desktop/SAAS/src/lib/db.ts#L36-L43) automatically detects `process.env.VERCEL` and writes/seeds `saas.db` inside `/tmp/platerift-data/saas.db` (since `/var/task` is read-only on Vercel Serverless Functions) and auto-seeds all demo restaurants, menus, variants, sides, inventory items, and integration defaults on cold start.

---

## 2. Step-by-Step Deployment to Vercel

### Option A: Deploy via GitHub + Vercel Dashboard (Recommended)

1. **Push your code to GitHub (`https://github.com/joshuaefedue/platerift`)**:
   ```bash
   git init
   git add .
   git commit -m "Deploy Platerift platform"
   git branch -M main
   git remote add origin https://github.com/joshuaefedue/platerift.git
   git push -u origin main
   ```
2. **Import into Vercel**:
   - Go to https://vercel.com/new and select your GitHub repository.
   - **Framework Preset**: `Next.js` (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `next build`
   - **Install Command**: `npm install`
3. **Verify Node.js Version in Vercel Project Settings**:
   - In your Vercel project dashboard, go to **Settings → General → Node.js Version** and ensure **`22.x`** is selected.
4. Click **Deploy**.

### Option B: Deploy Directly from Terminal via Vercel CLI

```bash
npx vercel login
npx vercel
# When ready to promote to production:
npx vercel --prod
```

---

## 3. Environment Variables (`Settings → Environment Variables`)

The platform works out-of-the-box in **Simulated / Sandbox Mode** with zero environment variables required, and also allows you to configure credentials directly inside the **Super Admin Console (`/admin`)**.

If you want to set optional environment variables in Vercel (`Settings → Environment Variables`):

| Variable Name | Required? | Example / Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Optional | `https://your-project.vercel.app` (Used for webhook callback URL display) |
| `NODE_OPTIONS` | Optional | `--no-experimental-strip-types` (Suppresses Node 22 experimental SQLite warning in logs) |
| `SQLITE_DATA_DIR` | Optional | Leave blank on Vercel (auto-uses `/tmp/platerift-data`) |

---

## 4. Live Application URLs After Deployment

Once deployed to `https://your-project.vercel.app`, all 3 tiers of the platform are immediately live:

| Portal / Route | URL Path | Purpose |
| :--- | :--- | :--- |
| **Platform Landing & Directory** | `/` | Browse all restaurants, switch roles, and launch portals |
| **Platform Super Admin Console** | `/admin` | Manage tenants, Twilio SMS gateway, and **Plug & Play Integrations** (`DoorDash`, `Square`, `Clover`, `Vapi`) |
| **Restaurant Owner Dashboard** | `/dashboard/bella-napoli` (or `/dashboard/[slug]`) | Live kitchen orders, 3-per-row menu builder modals, African/Nigerian inventory cards, payments, and 9. Plug & Play Apps |
| **Customer Online Storefront** | `/store/bella-napoli` (or `/store/[slug]`) | Customer ordering, variants & sides, DoorDash live tracking, Square/Clover/Stripe/PayPal checkout, and AI Voice Concierge |

---

## 5. Connecting Live Third-Party Webhooks to Your Vercel Domain

Once your Vercel URL (`https://your-project.vercel.app`) is live, register these 4 webhook endpoints in your provider dashboards (or update them in `/admin` → **Plug & Play Integrations**):

1. **🚗 DoorDash Drive API v2 Webhook**:
   - **Endpoint**: `https://your-project.vercel.app/api/webhooks/doordash`
   - **Events**: `DASHER_CONFIRMED`, `DASHER_CONFIRMED_STORE_ARRIVAL`, `DELIVERY_PICKED_UP`, `DELIVERY_DELIVERED`, `DELIVERY_CANCELLED`
2. **⬛ Square POS & Inventory Webhook**:
   - **Endpoint**: `https://your-project.vercel.app/api/webhooks/square`
   - **Events**: `inventory.count.updated`, `catalog.version.updated`, `order.updated`, `payment.updated`
3. **🍀 Clover POS & Kitchen KDS Webhook**:
   - **Endpoint**: `https://your-project.vercel.app/api/webhooks/clover`
   - **Events**: `item_stock`, `items`, `orders`, `payments`
4. **🎙️ Vapi Voice AI Server URL**:
   - **Endpoint**: `https://your-project.vercel.app/api/webhooks/vapi`
   - **Messages**: `assistant-request`, `tool-calls` (`get_live_menu_and_stock`, `check_delivery_quote`, `place_voice_order`, `check_order_status`)

---

## 6. Important Note on Database Persistence on Vercel

- **How `/tmp` SQLite Works on Vercel (Default)**:
  - Vercel Serverless Functions run in stateless containers. Writing `saas.db` to `/tmp/platerift-data/saas.db` works immediately for demos, previews, and active sessions, and automatically re-seeds if a new container spins up.
  - However, `/tmp` is ephemeral across cold starts and separate serverless lambda instances.
- **Upgrading to Permanent Cloud Storage for Production Traffic**:
  - When moving from demo/staging to live customer production on Vercel, swap or back [src/lib/db.ts](file:///c:/Users/Jefedue/Desktop/SAAS/src/lib/db.ts) with one of these managed cloud databases:
    1. **Turso (LibSQL / Managed Distributed SQLite)** — Keeps 100% of your existing SQLite schema (`restaurants`, `menu_items`, `orders`, `customers`, `scheduled_reorders`, `sms_logs`, `platform_settings`) with `@libsql/client`.
    2. **Neon Serverless Postgres / Vercel Postgres** — Native integration in the Vercel Storage tab.
    3. **Single-Instance VPS / Railway / Render / Fly.io with Persistent Volume** — If you want to keep native `node:sqlite` on a persistent disk without changing a single line of database code, mount a persistent volume at `/app/data` and set `SQLITE_DATA_DIR=/app/data`.

