# Encuentra tu Hogar-CR

A Spanish-first, Zillow-inspired real estate marketplace for Costa Rica, built with React 19, TypeScript, Vite, Leaflet, and Lucide icons.

## Run Locally

Use Node.js 22.12+ (or a newer supported LTS release) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally http://localhost:5173. If the port is occupied, Vite selects the next available port.

```sh
npm test
npm run lint
npm run build
npm run preview
```

## Features

- Houses and apartments for sale or monthly rental.
- Accent-insensitive location search, property type, price, bedrooms, amenities, and sorting.
- USD/CRC display and currency-aware price filters.
- Seller-selected listing currency: each house or apartment can be priced in USD or CRC and is converted only for the shopper's display currency.
- Interactive map with price markers, zoom, recentering, and property details.
- Photo galleries, amenities, and a clearly labeled demo inquiry form.
- Favorite homes, saved searches, and a local profile that persist in the browser.
- Local listing publication with all seven Costa Rican provinces.
- Owner promotion plans: Esencial (7 days), Hogar Plus (30 days), and Premium (60 days).
- Demo checkout with an itemized 13% IVA calculation, confirmation, expiration, and featured listing placement.
- Responsive desktop, tablet, and phone layouts, keyboard-accessible dialogs, and reduced-motion support.

## Demo Boundaries

This is a functional frontend prototype, not a production marketplace. Listings and photos are illustrative, not verified Costa Rican inventory. Map positions are approximate; locally published listings use the province's approximate center.

Favorites, profiles, custom listings, saved searches, and promotions are stored in `localStorage` under `hogar-cr-*` keys. They are limited to the current browser and can be removed through browser site-data settings. A local profile is not authenticated, and the two seeded owner listings are available for testing the promotion flow.

No real payments are processed. Checkout never requests payment credentials. Contact forms do not send messages, saved searches do not send email alerts, and listings are not shared with other users. Promotion prices and the IVA calculation are examples to validate before launch. Currency conversion uses a fixed illustrative rate of CRC 510 per USD, not a live exchange rate.

## External Assets

- Property reference photography: Unsplash, loaded through HTTPS image URLs.
- Map data and tiles: OpenStreetMap contributors, with visible attribution. Public tiles require compliance with the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Use a suitable hosted tile service or self-hosting for production traffic; public tiles offer no SLA.
- Fonts: DM Sans and Manrope, loaded from Google Fonts.

An internet connection is required for these external assets. No API keys are needed for the local demo.

## Production Checklist

Before accepting real listings or money:

1. Add a backend and database, authenticated accounts, listing ownership checks, authorization, and moderation.
2. Store verified property information, image uploads, and precise owner-approved map coordinates.
3. Integrate a payment provider that supports the operating business in Costa Rica. Create checkout sessions server-side and activate promotions only after verified, idempotent payment webhooks.
4. Add receipts, refunds, promotion lifecycle jobs, tax validation, and an audit trail. Never trust browser-supplied prices or ownership.
5. Add secure inquiry delivery, consent, privacy/terms pages, abuse protection, and rate limits.
6. Replace the sample exchange rate with an approved source and timestamp, and arrange production map hosting.
7. Add backend/integration tests, monitoring, accessibility auditing, backups, and deployment configuration.

## Main Files

- `src/App.tsx`: marketplace views and local workflows.
- `src/App.css` and `src/index.css`: responsive design and shared styles.
- `src/marketplace.ts`: property model, sample listings, filtering, and price formatting.
- `src/marketplace.test.ts`: focused search and currency tests.

## Supabase Production Setup

The local listing flow is still a browser-only demo. The production foundation is in `src/lib/supabase.ts` and `supabase/migrations/20260914000000_create_listings.sql`.

1. Create a Supabase project and apply the migration with the Supabase CLI or SQL editor.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never expose a service-role key in Vite or the browser.
3. Add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under GitHub Settings > Secrets and variables > Actions so the Pages build receives the same values. Do not commit `.env.local`.
4. Enable an authentication provider and require an authenticated seller before inserting listings.
5. Add a private Storage bucket for listing photos, signed upload policies, image moderation, and size/type limits.
6. Connect the publish form to `listings`; create listings as `draft`, then use a server-side moderation workflow to approve them as `published`.
7. Add server-side inquiry delivery, rate limits, audit logs, payment webhooks, receipts/refunds, privacy/terms pages, backups, monitoring, and a reviewed CRC/USD exchange-rate policy before accepting real money.

The `currency` column stores the seller's original `USD` or `CRC` amount. Never convert and overwrite that value; convert only when rendering or filtering in a shopper-selected currency.
