# CLASSY V — storefront

Clothing store built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4.
Design language follows the raw utilitarian streetwear layout: paper-white background, black
hairline rules, small uppercase Helvetica, a full-width wordmark, a left category rail and a dense
product grid.

Everything runs against **Neon Postgres** for orders and admin accounts. The product
catalog still lives in code (`src/lib/products.ts`).

## Run it

```bash
npm install
cp .env.example .env.local   # then paste your Neon DATABASE_URL
npm run db:init              # create orders + backoffice_users tables
npm run dev
```

Open http://localhost:3000.

Other scripts:

```bash
npm run build     # production build
npm start         # serve the production build
npm run lint      # eslint
npm run media     # regenerate placeholder catalog / editorial images
```

## Routes

| Route | What it does |
| --- | --- |
| `/` | Shop index — category rail + full product grid |
| `/collection` | Same grid with `?category=`, `?q=`, `?sort=`, `?stock=in` |
| `/collection/[slug]` | Product page: gallery, size picker, add to cart, details, related |
| `/cart`, `/checkout` | Cart page and checkout (contact, address, payment method) |
| `/checkout/confirmation?ref=` | Order receipt after checkout |
| `/track?ref=` | Order status lookup by `CV-` reference |
| `/wishlist` | Locally saved pieces |
| `/about`, `/faq`, `/size-guide`, `/shipping-returns`, `/contact` | Info pages |
| `/legal/terms`, `/legal/refund-policy`, `/legal/privacy` | Policies |
| `/login` | Back-office sign-in (email + password) |
| `/admin` | Dashboard: stats + recent orders |
| `/admin/orders` | Order management: details + status updates |

API routes: `POST /api/orders`, `POST /api/contact`,
`POST /api/admin/{login,logout,order-status}`.

## Back office

A multi-page dashboard with its own fixed top nav (Dashboard · Orders · Site · Sign out).
Visit `/login` (or any `/admin` route, which redirects there when signed out).

**Preferred:** admin accounts live in Neon (`backoffice_users`) with PBKDF2 password hashes.
Seed or rotate one with:

```bash
npm run db:seed-admin -- --email you@example.com --password 'your-password'
```

If the email is not in that table, login falls back to `ADMIN_LOGIN_EMAIL` /
`ADMIN_PASSWORD` from `.env.local`. Sessions last 12 hours and are signed (HMAC) in an
httpOnly cookie. Failed login attempts are rate-limited. All `/admin/*` routes are guarded
in `src/app/admin/layout.tsx`.

## Data

- Catalog: `src/lib/products.ts` (products, categories, sizes, stock, sale prices).
- Orders & admin users: Neon Postgres (`orders`, `backoffice_users` tables). Schema in
  `scripts/schema.sql`, applied with `npm run db:init`.
- Cart and wishlist: `localStorage`, exposed through an external store
  (`src/lib/clientStore.ts`) and read with `useSyncExternalStore`.
- Checkout re-prices every line server-side, so client-side price tampering is ignored.

## Replacing the placeholder images

`npm run media` writes SVG placeholders to `public/products` and `public/media`. To use real
photography, drop files with the same names into those folders (product images are square,
`{slug}-1|2|3`), then update `images()` in `src/lib/products.ts` if you change the extension.

## Where things live

```
src/app         routes (App Router), API handlers, sitemap/robots
src/components  header, cart drawer, product grid/card, forms
src/lib         catalog, cart maths, client store, file-backed order store, site config
scripts         placeholder media generator
```
