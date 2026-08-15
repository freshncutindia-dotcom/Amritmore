# FreshCuts — Farm-to-door Ecommerce Mobile App

## Vision
A premium, editorial-styled Expo mobile app for ordering **whole and pre-cut vegetables & fruits** and **ready-to-cook mixes**, with pin-code bound delivery, subscribe & save weekly boxes, cool floating interactions, and gesture-first UX.

## Categories (v5)
1. **Pre-cut Veggies** — one product per vegetable; user picks a cut (sliced, diced, shredded, batonnet, grated, julienne, cubed) and a weight (250g / 500g / 1kg).
2. **Pre-cut Fruits** — mango, pineapple, watermelon, papaya, mixed bowl — with cut + weight tabs.
3. **Whole Vegetables & Fruits** — sold whole; only Weight tab (no cut chooser).
4. **Ready-to-cook Veggie Mixes** — Stir-fry, Biryani, Soup, Curry, Salad, Pav Bhaji — each with a recipe suggestion.

## Key Screens
- **Home** — Hero with hamburger menu, category tiles, **Subscribe & Save promo card**, fresh picks carousel, ready-to-cook rail, floating cart FAB.
- **Shop** — sticky header with hamburger + search + horizontally scrolling category chips + cut-type chips + 2-column product grid.
- **Product Detail** — hero image **that swaps when cut chip changes** (for Onions/Potatoes/Carrots/Cabbage/Bell Peppers/Mango/Pineapple), weight tab with per-weight price, cut-type chips (only for pre-cut), quantity stepper, **recipe suggestion cards for ready-mix products** (expandable ingredients + step-by-step instructions), sticky Add-to-basket CTA.
- **Subscribe & Save** — 3 curated boxes (Essentials ₹599, Mixed ₹999, Premium ₹1499), weekly/bi-weekly frequency, delivery day selector, address form.
- **Cart** — swipe-to-delete gesture rows, pincode serviceability check, animated total, sticky checkout CTA.
- **Checkout** — address + phone + payment method (COD / Stripe) + order summary + success screen.
- **Orders** — order history with status pill and thumbnails.
- **Auth** — email + password JWT (register/login).
- **Admin Panel** — add/delete products, add/delete pincodes.

## Sidebar Drawer (transparent glassmorphic)
- Slides in from the left with spring animation and semi-transparent scrim.
- BlurView / translucent surface backing → shows underlying screen through the drawer.
- Contents: FreshCuts brand + close btn, user/guest card, main menu (Home, Shop, **Subscribe & Save w/ NEW badge**, My Basket, My Orders, Profile, Admin if admin), Categories quick-nav, Sign-out.

## Delightful details
- Spring-scaled cart badge on add, fly-to-cart haptic, bouncy FAB.
- Swipe-left-to-delete cart row.
- Staggered `FadeInDown` entrances.
- Press-in `withSpring(0.97)` scale on product cards.
- Hero image transition (`expo-image`) on cut swap.
- Reanimated pull-to-refresh.
- Glass sidebar drawer with spring slide-in.

## Backend
- **FastAPI** + Motor + JWT auth + bcrypt.
- **Stripe** via `emergentintegrations.payments.stripe.checkout.StripeCheckout` (uses `sk_test_emergent`).
- Endpoints (all `/api` prefixed):
  - `POST /auth/register`, `/auth/login`, `GET /auth/me`
  - `GET /products` (filters: category, cut_type, q), `GET /products/{id}`, admin `POST` and `DELETE /products/{id}`
  - `GET /pincodes`, `GET /pincodes/check/{pin}`, admin `POST /pincodes`, admin `DELETE /pincodes/{pin}`
  - `POST /orders`, `GET /orders`, `GET /orders/{id}`
  - `POST /payments/checkout`, `GET /payments/status/{session_id}`, `GET /payments/success`, `GET /payments/cancel`
  - **`GET /subscriptions/boxes`, `POST /subscriptions`, `GET /subscriptions`, `POST /subscriptions/{id}/pause`, `DELETE /subscriptions/{id}`**
- Seed data: admin user, 33 products (with `cut_images` for select pre-cut items and `recipes` for all ready-mix items), 8 pincodes, 3 subscription boxes.

## Frontend
- Expo SDK 54 + expo-router, TypeScript.
- Tabs: Home, Shop, Cart, Profile. Additional routes: `/product/[id]`, `/checkout`, `/orders`, `/admin`, `/subscribe`, `/auth`.
- Custom theme (`/app/frontend/src/theme.ts`) with organic palette (green, terracotta, warm oat) — no purple/indigo.
- Drawer via `/app/frontend/src/components/SideDrawer.tsx` (Reanimated + BlurView).
- `AsyncStorage` for token + local cart persistence.

## Test Credentials
See `/app/memory/test_credentials.md`.

## Status
- Backend: 41/41 tests passing (100%).
- Frontend: all screens functional, drawer overlay works, recipe expansion works, cut image swap works.

## Phase: Full Admin Control Panel (June 2026) — DONE ✅
- **Email notifications (Emergent-managed, no user API key)**: Admin gets email for every new order + every customer support message. Notify address editable in Admin → Dashboard (default admin@freshcuts.com — placeholder; friendly error prompts admin to set a real inbox). "Send test email" button. Sends logged in db.email_log.
- **Product management**: Add product (category/cuts/weights/stock/image), edit modal (name, description, price, stock, image, weights chips, cut types), availability switch (hidden from public /products when off), quick stock +/- ; order placement decrements stock.
- **Admin dashboard (6 tabs in /admin)**: Dashboard (stat cards: orders/revenue today+total, open orders, low stock alerts <10, customers, unread messages banner; notification email settings), Orders (status filters, expandable cards, status flow Placed→Confirmed→Packed→Out for delivery→Delivered/Cancel; COD delivered auto-marks paid), Products, Deals, PINs, Inbox (customer messages, mark read/delete).
- **Customer support**: /support screen (Contact Support in Profile) → POST /api/contact (auth, 5/hour throttle) → stored + emailed to admin.
- Key endpoints: /api/admin/stats, /api/admin/orders[+/{id}/status], /api/admin/products/{id}[+/stock], /api/admin/messages, /api/admin/settings[+/test-email], /api/contact
- Tested: iteration_14 (backend 20/21 → last issue fixed: friendly 400 for undeliverable test email), frontend all flows pass.

### Remaining backlog (unchanged)
- Phase 5: Razorpay payments (P0, playbook fetched earlier)
- Phase 3: Powerful search (P1); Smart cart suggestions (P1); Subscriptions (P1)
- Notifications system (P2); Pre-cut product images upload (blocked on user); CSV price update (blocked on user)
- Refactor: split server.py (~1900 lines) into routers

## Phase: Smart Search + Subscriptions (June 2026) — DONE ✅
- **Smart search (Shop tab)**: debounced auto-suggest dropdown with product thumbnails, local-name synonyms (dhaniya→coriander, bhindi→okra, aloo→potato, ~50 mappings in SYNONYMS dict in server.py), "Also matching" hint; filter sheet (price range chips, in-stock toggle) + active-filter dot. Endpoints: GET /api/search/suggest?q=, /api/products now supports min_price/max_price/in_stock.
- **Subscriptions (custom basket, COD)**: build basket from cart → /subscribe (qty edit, frequency Daily/Alternate/Weekly + weekday, start date, saved-address picker, per-delivery pricing). Manage at /subscriptions (pause/resume, skip next, two-tap cancel). Hourly backend loop (IST dates) auto-generates COD orders (source="subscription", 🔁 badge in admin Orders), decrements stock, emails admin. Admin: GET /api/admin/subscriptions, POST /api/admin/subscriptions/run (force), active_subscriptions stat card. LEGACY box-based subscription system (BOXES, /subscriptions/boxes) REMOVED; old subscribe.tsx rewritten. Entry points: home banner, cart "Subscribe & repeat", profile "My Subscriptions", side drawer.
- Fixed: cart persistence race in store.tsx (write gated on hydration `ready`).
- Tested: iteration_15 — backend 23/23 pytest + full frontend e2e pass.

### Remaining backlog
- Phase 5: Razorpay payments (P0); Notifications (P2); pre-cut images + CSV prices (blocked on user); split server.py into routers; RN-web shadow/pointerEvents deprecation warnings (cosmetic).

## Phase: Security Audit + Fixes (June 2026) — DONE ✅
Audit findings fixed & verified (iteration_16, 8/8 backend + full frontend e2e):
- SEC-001: server-side pricing on /api/orders & /api/subscriptions (weight multiplier + live deals; express ₹49/scheduled ₹29 slot fee; handling ₹9) — client money fields ignored
- SEC-002: admin password rotated → `Fc!LdZB5RH3sprvcI` (backend/.env, seed upserts hash on startup; see memory/test_credentials.md)
- SEC-003: OTP mock hardened — only exact 123456, no dev_code in API response, 5-attempt cap. REAL SMS PROVIDER STILL PENDING before production.
- SEC-004: strong random JWT secret; SEC-005: re.escape on cut_type regex
- Hardening: login lockout (5 fails/15min per email → 429), generic Stripe errors, CORS allow_credentials=False, auth token in expo-secure-store on native (AsyncStorage web) with migration, removed admin-credential hint from auth.tsx
Remaining (accepted for now): RN-web shadow*/pointerEvents deprecation warnings (cosmetic).
