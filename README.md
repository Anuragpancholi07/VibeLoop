# VibeLoop 🚀

VibeLoop is a premium, production-ready, mobile-first social event discovery, community, networking, and ticketing platform. It allows users to discover local experiences, join interest-based communities, buy tickets, scan QR codes, message in real-time, and host events.

## 🛠️ Tech Stack
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, React Router 7, React Query, Lucide Icons, i18next, Canvas Confetti
- **Backend:** Supabase (PostgreSQL with PostGIS, Auth, Realtime, Edge Functions, Storage)
- **Payments:** Razorpay (Test Mode API)
- **Mobile Native:** Capacitor (Ready for iOS & Android builds)
- **Deployment:** Vercel (SPA Routing & Security Headers ready)

---

## 🚀 Quick Start & Local Setup

### 1. Configure Local Environment
Copy the example environment file and fill in your keys:
```bash
cp .env.example .env.local
```
Or edit the pre-configured `.env.local` directly at the root.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Dev Server
```bash
npm run dev
```

---

## ⚡ Supabase Setup (Database, Storage & Auth)

For detailed step-by-step setup guidance, see the [Setup Guide](.gemini/antigravity-ide/brain/de98f205-5edd-42ca-bc6a-897ce148faf3/setup_guide.md).

1. **SQL Schema:** Paste and run the schema file in your Supabase SQL Editor:
   - File location: `supabase/migrations/001_initial_schema.sql`
2. **Storage Bucket:** Create a public bucket in Supabase storage named `user-uploads`. Apply `INSERT` and `UPDATE` policies for authenticated users.
3. **Auth Providers:** Enable Email OTP under Authentication. In Redirect URLs, add `http://localhost:5173/**` and your Vercel URL.
4. **Deploy Edge Functions:**
   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx
   supabase functions deploy create-razorpay-order
   supabase functions deploy verify-razorpay-payment
   supabase functions deploy send-notification
   ```

---

## 📦 Vercel Deployment

A `vercel.json` file is configured at the root to handle single-page application routing rewrites and serve the static assets with security headers.

1. Connect your repository to Vercel.
2. Add your environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_RAZORPAY_KEY_ID`
   - `VITE_GOOGLE_MAPS_API_KEY`
3. Click **Deploy**.
