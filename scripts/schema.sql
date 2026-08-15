-- CLASSY V Neon schema (admin accounts).
-- Orders and catalog live in the back-office schema: scripts/shop-schema.sql (npm run shop:init).

-- Admin accounts (password stored as pbkdf2$iter$saltHex$hashHex — never plaintext)
CREATE TABLE IF NOT EXISTS backoffice_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backoffice_users_email_lower_idx
  ON backoffice_users (lower(trim(email)));
