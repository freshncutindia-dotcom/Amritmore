# FreshCuts - Product Requirements Document

## Overview
FreshCuts is a mobile ecommerce app for whole & pre-cut vegetables and fruits, delivered to pincode-bound serviceable areas. Built with Expo (SDK 54) + expo-router + FastAPI + MongoDB.

## Core Features (MVP)
- **Browsing**: Home feed with hero, category grid (Whole Veg, Cut Veg, Whole Fruit, Cut Fruit), fresh picks carousel, and ready-to-eat row
- **Shop**: Sticky filter header (category chips + cut-type chips), search, 2-column product grid
- **Product detail**: Hero image, description, cut-style selector, pack-size (250g/500g/1kg), quantity picker, sticky Add-to-basket CTA with bouncy spring press animation
- **Cart**: Swipe-to-delete gesture (react-native-gesture-handler + reanimated), animated qty controls, inline pincode serviceability check
- **Checkout**: Address form, COD or Stripe payment, order summary, success screen with checkmark animation
- **Orders**: List with status badges (pending / paid / confirmed / out-for-delivery / delivered)
- **Auth**: Email + password JWT (bcrypt, 7-day expiry)
- **Admin panel**: Create/delete products & serviceable pincodes (admin role)
- **Floating gestures & animations**: Bouncy tab-bar cart badge, floating cart FAB with spring on item-add, fade-in-down list reveals, haptic feedback across all interactions

## Backend Endpoints (`/api`)
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /products` (with `?category=&cut_type=&q=`), `GET /products/{id}`
- `POST /products`, `DELETE /products/{id}` (admin)
- `GET /pincodes`, `GET /pincodes/check/{pincode}`
- `POST /pincodes`, `DELETE /pincodes/{pincode}` (admin)
- `POST /orders`, `GET /orders`, `GET /orders/{id}`
- `POST /payments/checkout`, `GET /payments/status/{session_id}` (Stripe via emergentintegrations)

## Seed Data
- 22 products across 4 categories & 6 cut types (whole, sliced, diced, shredded, batonnet, cubed, grated)
- 8 serviceable pincodes across Bengaluru, Mumbai, Delhi
- 1 admin user

## Tech Stack
- FastAPI + Motor (async MongoDB)
- Expo Router 6 + Reanimated 4 + Gesture Handler
- Stripe via `emergentintegrations.payments.stripe.checkout`
- JWT (pyjwt) + bcrypt

## Test Credentials
See `/app/memory/test_credentials.md`
