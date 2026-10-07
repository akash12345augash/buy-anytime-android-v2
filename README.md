# Buy Anytime — Real-time E-commerce Starter

This project upgrades the original demo into a production-oriented architecture:

- Android customer app (WebView UI)
- Supabase Postgres database + Auth + Realtime
- Real phone OTP via Supabase Auth SMS provider
- Node/Express backend with server-side Razorpay order creation and signature verification
- Admin dashboard with product and order management
- Android app icon
- Target SDK 36 and Play Store AAB-ready Gradle config

## Important: credentials are not included
Before this becomes a live store, configure your own Supabase project, SMS provider, Razorpay account, backend hosting, domain/HTTPS and admin user ID. Never put Supabase service-role keys or Razorpay secrets inside the Android app.

## 1. Supabase
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Enable Phone Auth and configure an SMS provider.
4. Create your admin user by logging in once; copy its Auth user UUID.
5. Put that UUID in `backend/.env` as `ADMIN_USER_IDS`.
6. Copy the project's URL and publishable key into `app/src/main/assets/www/config.js` and `admin/config.js`.

Supabase Auth supports phone OTP, and database access should be protected with Row Level Security. See the official Supabase docs.

## 2. Backend
Inside `backend/`:

```bash
npm install
cp .env.example .env
npm start
```

Set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET` (server only)
- `ADMIN_USER_IDS`
- `CORS_ORIGIN`

Deploy the backend to Render, Railway, Fly.io, a VPS, or another HTTPS Node host. The Android app must use the deployed HTTPS API URL.

## 3. Razorpay
Create a Razorpay account, complete business/KYC requirements, obtain API keys, and configure the backend environment variables. The server creates Razorpay orders; the Android/WebView client never receives the secret. Payment signatures are verified on the server.

For production, also configure Razorpay webhooks and reconcile payment/order status from webhook events.

## 4. Android app
Update `app/src/main/assets/www/config.js` with:
- API_BASE_URL
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- RAZORPAY_KEY_ID (if native checkout is added)

The current UI checkout calls the backend payment API and is intentionally structured so the payment SDK/key can be wired without exposing secrets.

Build:

```bash
gradle assembleDebug
gradle bundleRelease
```

For Play Store, create a signed release and upload the `.aab`. Do not publish the debug APK.

## 5. Admin
Deploy `admin/` with the backend or a static host. Set `admin/config.js` to the same Supabase project and backend URL. Admin API access is restricted by `ADMIN_USER_IDS`.

## 6. Production checklist
- Replace all example URLs/keys
- Configure SMS provider and OTP limits
- Configure Razorpay production keys + webhooks
- Add privacy policy, terms, refund/shipping policy
- Add real product images via Supabase Storage/CDN
- Configure backups/monitoring
- Create signed AAB
- Test payments, refunds, order states, stock race conditions and account deletion before launch
