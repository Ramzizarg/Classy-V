-- CLASSY V back-office (Vero7-style) shop schema.
-- Catalog + orders live in Neon. Run with: npm run shop:init
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Categories ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (lower(slug));

-- Colors --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS colors (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  hex  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS colors_slug_key ON colors (lower(slug));

-- Products ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  description       JSONB,
  price             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_price    NUMERIC(12, 2),
  stock             INTEGER NOT NULL DEFAULT 0,
  category_id       INTEGER REFERENCES categories (id) ON DELETE SET NULL,
  color_id          INTEGER REFERENCES colors (id) ON DELETE SET NULL,
  color_id_2        INTEGER REFERENCES colors (id) ON DELETE SET NULL,
  images            JSONB NOT NULL DEFAULT '[]'::jsonb,
  sizes             JSONB NOT NULL DEFAULT '[]'::jsonb,
  size_guide_image  TEXT,
  measurement_table JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON products (created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);

-- Products sharing a variant_group are the same piece in different colours and
-- link to each other from the product page.
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_group TEXT;
CREATE INDEX IF NOT EXISTS products_variant_group_idx ON products (variant_group);

-- Coupons -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id             SERIAL PRIMARY KEY,
  code           TEXT NOT NULL,
  discount_type  TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  product_id     INTEGER REFERENCES products (id) ON DELETE CASCADE,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at      TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_key ON coupons (lower(code));

-- Orders (Vero7 shape) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_orders (
  id              SERIAL PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone_number    TEXT NOT NULL,
  phone_number_2  TEXT,
  address         TEXT,
  city            TEXT,
  governorate     TEXT,
  coupon_code     TEXT,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  confirmed_by_phone BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Storefront checkout fields (Classy V ships internationally: postal code + country,
-- an order reference the customer can track, and the split totals).
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS reference      TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS postal_code    TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS country        TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS note           TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash-on-delivery';
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS subtotal       NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS shop_orders_created_at_idx ON shop_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON shop_orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_reference_key ON shop_orders (upper(reference));

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES shop_orders (id) ON DELETE CASCADE,
  product_id   INTEGER,
  product_name TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  price        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  size         TEXT,
  color        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- Home CMS + coming-soon ----------------------------------------------------
CREATE TABLE IF NOT EXISTS home_content (
  id         TEXT PRIMARY KEY,
  content    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coming_soon_settings (
  id               TEXT PRIMARY KEY,
  enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  hero_image_url   TEXT NOT NULL DEFAULT '',
  end_at           TIMESTAMPTZ,
  require_password  BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash    TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store settings ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_settings (
  id             TEXT PRIMARY KEY,
  delivery_price NUMERIC(12, 2) NOT NULL DEFAULT 8,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live visitor presence -----------------------------------------------------
CREATE TABLE IF NOT EXISTS site_presence (
  visitor_id text PRIMARY KEY,
  last_seen  timestamptz NOT NULL DEFAULT now(),
  path       text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_presence_last_seen_idx ON site_presence (last_seen DESC);
