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
