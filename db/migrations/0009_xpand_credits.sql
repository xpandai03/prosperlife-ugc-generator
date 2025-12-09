-- XPAND Credits System Migration
-- Phase 9: Universal credit-based billing

-- 1. Global Credit Settings
CREATE TABLE IF NOT EXISTS global_credit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  markup_factor NUMERIC(5, 2) NOT NULL DEFAULT 1.40,
  price_per_credit_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0200,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Insert default global settings
INSERT INTO global_credit_settings (markup_factor, price_per_credit_usd)
VALUES (1.40, 0.0200)
ON CONFLICT DO NOTHING;

-- 2. Credit Pricing (per feature)
CREATE TABLE IF NOT EXISTS credit_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  base_cost_usd NUMERIC(10, 4) NOT NULL,
  credit_cost INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Seed initial pricing data
INSERT INTO credit_pricing (feature_key, feature_name, base_cost_usd, credit_cost) VALUES
  ('ugc_veo3_quality', 'UGC Ad (Veo3 Quality)', 1.0000, 70),
  ('ugc_veo3_fast', 'UGC Ad (Veo3 Fast)', 0.5000, 35),
  ('ugc_sora2', 'UGC Ad (Sora2)', 0.2500, 18),
  ('klap_video_input', 'Video Processing', 0.4400, 31),
  ('klap_clip_generate', 'Clip Generation', 0.3200, 22),
  ('klap_export', 'Clip Export', 0.4800, 34),
  ('klap_full_workflow', 'Full Video Workflow', 1.5000, 100),
  ('social_post', 'Instagram Post', 0.1500, 11),
  ('caption_generate', 'AI Caption', 0.0100, 1),
  ('media_flux', 'Image (Flux Kontext)', 0.0800, 6),
  ('media_4o', 'Image (GPT-4O)', 0.0300, 3),
  ('media_veo3', 'Video (Veo3)', 0.6000, 40),
  ('media_sora2', 'Video (Sora2)', 0.2500, 18)
ON CONFLICT (feature_key) DO NOTHING;

-- 3. User Credits (balance per user)
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- 4. Credit Transactions (audit log)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  feature_key TEXT,
  description TEXT NOT NULL,
  stripe_payment_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create index for user transaction history
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- 5. Migrate existing Pro users: give them 1000 free credits
-- This creates a user_credits record for each Pro user with 1000 credits
INSERT INTO user_credits (user_id, balance, lifetime_purchased, lifetime_used)
SELECT
  id AS user_id,
  1000 AS balance,
  1000 AS lifetime_purchased,
  0 AS lifetime_used
FROM users
WHERE subscription_status = 'pro'
ON CONFLICT (user_id) DO UPDATE SET
  balance = user_credits.balance + 1000,
  lifetime_purchased = user_credits.lifetime_purchased + 1000;

-- Log the Pro user migration as transactions
INSERT INTO credit_transactions (user_id, amount, balance_after, description, metadata)
SELECT
  uc.user_id,
  1000 AS amount,
  uc.balance AS balance_after,
  'Pro user migration bonus' AS description,
  '{"migration": "pro_to_credits", "bonus": 1000}'::jsonb AS metadata
FROM user_credits uc
INNER JOIN users u ON u.id = uc.user_id
WHERE u.subscription_status = 'pro';
