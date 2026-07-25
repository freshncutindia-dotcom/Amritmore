# FreshCuts — Farm-to-door Ecommerce Mobile App

## Vision
A premium, editorial-styled Expo mobile app for ordering **whole and pre-cut vegetables & fruits** and **ready-to-cook mixes**, with pin-code bound delivery, cool floating interactions, and gesture-first UX.

## Categories (v3)
1. **Pre-cut Veggies** — one product per vegetable; user picks a cut (sliced, diced, shredded, batonnet, grated, julienne, cubed) and a weight (250g / 500g / 1kg).
2. **Pre-cut Fruits** — mango, pineapple, watermelon, papaya, mixed bowl — with cut + weight tabs.
3. **Whole Vegetables & Fruits** — sold whole; only Weight tab (no cut chooser).
4. **Ready-to-cook Veggie Mixes** — Stir-fry, Biryani, Soup, Curry, Salad, Pav Bhaji.

## Key Screens
- **Home** — Hero, category tiles (Pre-cut Veggies / Fruits / Whole / Ready-mix), fresh picks carousel, ready-to-cook rail, floating cart FAB.
- **Shop** — sticky header with search + horizontally scrolling category chips + cut-type chips + 2-column product grid.
- **Product Detail** — hero image, weight tab (per-weight price), cut-type chips (only for pre-cut categories), quantity stepper, sticky Add-to-basket CTA.
- **Cart** — swipe-to-delete gesture rows, pincode serviceability check, animated total, sticky checkout CTA.
- **Checkout** — address + phone + payment method (COD / Stripe) + order summary + success screen.
- **Orders** — order history with status pill and thumbnails.
- **Auth** — email + password JWT (register/login).
- **Admin Panel** — add/delete products, add/delete pincodes.

## Delightful details (as requested — "cool floating gestures & animations")
- Spring-scaled cart badge on add.
- Fly-to-cart haptic + bouncy FAB scale on any addToCart.
- Swipe-left-to-delete cart row using `react-native-gesture-handler` + Reanimated.
- Staggered `FadeInDown` entrances across category tiles, grid cards, and lists.
- Press-in `withSpring(0.97)` scale on product cards.
- Confirmation success screen with animated check circle.
- Reanimated pull-to-refresh with brand-colored tint.

## Backend
- **FastAPI** + Motor + JWT auth + bcrypt.
- **Stripe** via `emergentintegrations.payments.stripe.checkout.StripeCheckout` (uses `sk_test_emergent`).
- Endpoints (all `/api` prefixed):
  - `POST /auth/register`, `/auth/login`, `GET /auth/me`
  - `GET /products` (filters: category, cut_type, q), `GET /products/{id}`, admin `POST` and `DELETE /products/{id}`
  - `GET /pincodes`, `GET /pincodes/check/{pin}`, admin `POST /pincodes`, admin `DELETE /pincodes/{pin}`
  - `POST /orders` (auth; validates pincode), `GET /orders`, `GET /orders/{id}`
  - `POST /payments/checkout`, `GET /payments/status/{session_id}`, `GET /payments/success`, `GET /payments/cancel`
- Seed data: admin user, 33 products across 4 categories, 8 pincodes.

## Frontend
- Expo SDK 54 + expo-router, TypeScript.
- Tabs: Home, Shop, Cart, Profile.
- Custom theme (`/app/frontend/src/theme.ts`) with organic palette (green, terracotta, warm oat) — no purple/indigo.
- `AsyncStorage` for token + local cart persistence (via `@react-native-async-storage/async-storage`).
- Cool motion using `react-native-reanimated`, gestures via `react-native-gesture-handler`, blur via `expo-blur`, haptics via `expo-haptics`.

## Test Credentials
See `/app/memory/test_credentials.md`.

## Status
- Backend: 30/30 tests passing (100%).
- Stripe: working with emergentintegrations.
- Frontend: home, shop, product detail (weight + cut tabs), cart (swipe delete + pincode), checkout, admin, orders — all functional.
