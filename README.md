# Encuentra tu Hogar-CR

A Spanish-first, Zillow-inspired real estate marketplace for Costa Rica, built with React 19, TypeScript, Vite, Leaflet, and Lucide icons.

## Run Locally

Use Node.js 22.12+ (or a newer supported LTS release) and npm.

Install dependencies, create your untracked `.env.local` using `.env.example`, and supply the Supabase project URL and public publishable/anon key. All `VITE_*` values are public browser configuration. Never put secret or service-role keys in these variables.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally http://localhost:5173. If the port is occupied, Vite selects the next available port.

```sh
npm test
npm run lint
npm run build
npm run preview
```

## Release Scope

This release connects real email-link accounts and shared property listings to Supabase. It is a limited listing beta, not a complete commercial marketplace. Complete the deployment steps and operational checks below before opening registration to the public.

## Features

- Houses and apartments for sale or monthly rental.
- Accent-insensitive location search, property type, price, bedrooms, amenities, and sorting.
- USD/CRC display and currency-aware price filters.
- Seller-selected listing currency: each house or apartment can be priced in USD or CRC and is converted only for the shopper's display currency.
- Interactive map with price markers, zoom, recentering, and property details.
- Real property photos and amenities, without fabricated gallery images or descriptions.
- Favorites and saved searches that persist in the current browser, not the account.
- Supabase email-link registration, sign-in, session restoration, and sign-out.
- Authenticated draft creation with all seven provinces, original USD/CRC prices, and a required HTTPS property photo URL.
- Owner listing status, review submission, refresh, and deletion.
- Public inventory limited to published listings; owner drafts remain private under database row-level security.
- Loading, empty, and retry states; failed requests never fall back to demo inventory.
- Responsive desktop, tablet, and phone layouts, keyboard-accessible dialogs, and reduced-motion support.

## Disabled And Limited Features

Payments, paid promotions, and inquiry submission are disabled in production. No payment information or inquiry messages are collected. Saved searches do not send email alerts. Currency conversion remains a clearly labeled reference rate of CRC 510 per USD, not a live rate. Map positions are approximate province centers unless a moderator supplies coordinates.

The public search loads up to the newest 1,000 published listings and filters them in the browser. Add server-side search and pagination before growing beyond that limit. Photos are owner-provided external HTTPS URLs, not uploaded files; review image rights and content before approval. Owners can submit or delete drafts; a full editing workflow is not included.

The original sample listings, local profiles, and simulated promotions are available only during `npm run dev` with `VITE_DEMO_MODE=true`. Production builds reject this setting. Existing `hogar-cr-*` browser data is retained but local listings, profiles, and promotions are ignored outside demo mode. Favorites and searches remain browser-local, including after sign-out on shared devices.

## External Assets

- Property photography: owner-provided HTTPS URLs; demo reference photography uses Unsplash.
- Map data and tiles: OpenStreetMap contributors, with visible attribution. Public tiles require compliance with the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Use a suitable hosted tile service or self-hosting for production traffic; public tiles offer no SLA.
- Fonts: DM Sans and Manrope, loaded from Google Fonts.

An internet connection is required for Supabase and these external assets.

## Production Checklist

Before accepting real listings or money:

1. Apply both database migrations, configure authentication, and assign a moderator. Database policies are implemented, but production project configuration must still be verified.
2. Store verified property information, image uploads, and precise owner-approved map coordinates.
3. Integrate a payment provider that supports the operating business in Costa Rica. Create checkout sessions server-side and activate promotions only after verified, idempotent payment webhooks.
4. Add receipts, refunds, promotion lifecycle jobs, tax validation, and an audit trail. Never trust browser-supplied prices or ownership.
5. Add secure inquiry delivery, consent, privacy/terms pages, abuse protection, and rate limits.
6. Replace the sample exchange rate with an approved source and timestamp, and arrange production map hosting.
7. Verify backups and restore procedures, monitoring, accessibility, and authentication abuse protection. Run the live two-account smoke test below; embedded database and mocked browser tests do not replace it.

## Main Files

- `src/App.tsx`: marketplace views, public inventory loading, and draft publication.
- `src/Account.tsx`: email-link authentication and owner listing management.
- `src/lib/listings.ts`: Supabase listing operations, validation, and database-to-UI mapping.
- `src/App.css` and `src/index.css`: responsive design and shared styles.
- `src/marketplace.ts`: property model, sample listings, filtering, and price formatting.
- `src/marketplace.test.ts` and `src/lib/*.test.ts`: search, currency, input, configuration, and PostgreSQL row-level security tests.

## Production Deployment

1. Back up the target Supabase database. Apply `supabase/migrations/20260914000000_create_listings.sql` if not already applied, then `supabase/migrations/20260915000000_harden_listing_moderation.sql`, using the Supabase SQL editor or your migration process. Do not rerun the initial migration on an existing schema. The new constraints validate existing rows; review and correct incompatible data instead of bypassing constraints.
2. In Supabase Authentication, enable email authentication and new-user registration. Require email confirmation. Configure production SMTP with a verified sender: Supabase's default mail service has delivery restrictions unsuitable for general public registration. Configure appropriate auth rate limits and review CAPTCHA requirements before broad public access.
3. Set the Auth Site URL and allowed redirect URL to `https://kyassassin17.github.io/Tu-hogar-CR/`. Add the exact local testing URL separately, such as `http://127.0.0.1:5180/`. Keep the email template's standard confirmation link; this app consumes the resulting session automatically. Do not use wildcard production redirects.
4. Set GitHub repository Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the same production project's URL and public key. `.env.local` is ignored by Git and is not used by GitHub Actions. Both legacy anon JWTs and current `sb_publishable_*` keys are supported; builds reject missing, placeholder, expired, and privileged keys. Structural validation does not prove a key is valid for a project.
5. In GitHub Settings > Pages, select **GitHub Actions** as the source. Configure branch protection to require the pull-request validation job. Merging the reviewed changes into `main` runs lint, tests, and the production build, then deploys only on success. Builds use `/Tu-hogar-CR/` as the base path, including the home link and auth redirect.
6. Run the live smoke test below, approve a verified listing, and confirm the public site from another browser. No migration or remote deployment is performed by `npm run build`.

## Moderation

New listings are saved as `draft`. Owners send them to `pending_review` from **Mi cuenta**. The database locks pending and published listings against owner edits; only an administrator using the Supabase dashboard or a trusted server can approve them. Never grant a browser user a service-role key.

Review the property, price/currency, photo rights and content, location, and abuse reports before approval. In the Supabase SQL editor, replace the placeholder with a verified pending listing ID:

```sql
update public.listings
set status = 'published'
where id = '<verified-listing-uuid>'::uuid
	and status = 'pending_review'
returning id, status;
```

Use `rejected` instead of `published` to reject a pending listing, or `archived` to withdraw a published one. An approved listing's seller currency and amount must not be converted or overwritten. Set real coordinates only with the owner's approval. Assign an actual operator to this process; there is no browser admin panel, automated moderation, or moderation audit trail yet.

## Live Smoke Test

1. In a fresh browser, confirm that only published inventory appears and no sample listings or promotions appear.
2. Sign in using a real mailbox, follow the single-use email link, reload, and confirm the session restores at the correct Pages URL. Verify expired links and resend behavior.
3. Create a CRC draft with a property photo. Confirm it is visible only in the owner's account, then send it for review. A second signed-in account must not read or modify the draft, including through direct API requests.
4. Approve the pending listing as an administrator. Reload a signed-out browser, clear location filters as needed, and verify its photo, original CRC price, display conversion, and approximate map location.
5. Delete the listing as its owner, reload the public view, and confirm it disappears. Sign out and confirm publishing requires sign-in again.
6. Check desktop and mobile layouts, network error/retry behavior, SMTP delivery, logs, auth limits, backups, and restore access before opening registration broadly.

`npm test` executes both migrations in embedded PostgreSQL with a minimal Supabase Auth schema and exercises RLS under anonymous and authenticated database roles. The test harness uses PostgreSQL's built-in UUID generator instead of loading `pgcrypto`; live Supabase migration execution remains a separate deployment gate.
