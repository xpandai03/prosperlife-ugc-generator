-- Migration: Add stripe_settings table for white-label Stripe configuration
-- This allows clients to use their own Stripe accounts

CREATE TABLE IF NOT EXISTS stripe_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publishable_key TEXT,
  secret_key TEXT,
  webhook_secret TEXT,
  price_id_starter TEXT,
  price_id_basic TEXT,
  price_id_pro TEXT,
  price_id_business TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Insert a default empty row so we always have one settings record
INSERT INTO stripe_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
