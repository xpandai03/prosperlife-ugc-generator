-- Content Engine Migration (Jan 2026)
-- Creates channel_configs and scene_specs tables for the Content Engine feature

-- Channel Configs table - user's content direction settings
CREATE TABLE IF NOT EXISTS channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  tone TEXT NOT NULL,
  cadence TEXT,
  renderer_preference TEXT NOT NULL DEFAULT 'automation',
  default_duration INTEGER NOT NULL DEFAULT 60,
  extra_directives JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Scene Specs table - canonical content specification object
CREATE TABLE IF NOT EXISTS scene_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_config_id UUID NOT NULL REFERENCES channel_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT,
  tags JSONB,
  target_duration INTEGER NOT NULL,
  scenes JSONB NOT NULL,
  renderer_type TEXT NOT NULL DEFAULT 'automation',
  media_asset_id TEXT REFERENCES media_assets(id),
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  rendered_at TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_channel_configs_user_id ON channel_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_configs_is_active ON channel_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_scene_specs_user_id ON scene_specs(user_id);
CREATE INDEX IF NOT EXISTS idx_scene_specs_channel_config_id ON scene_specs(channel_config_id);
CREATE INDEX IF NOT EXISTS idx_scene_specs_status ON scene_specs(status);
CREATE INDEX IF NOT EXISTS idx_scene_specs_media_asset_id ON scene_specs(media_asset_id);

-- Add sceneSpecId to media_assets for reverse lookup (optional, but useful)
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS scene_spec_id UUID REFERENCES scene_specs(id);
CREATE INDEX IF NOT EXISTS idx_media_assets_scene_spec_id ON media_assets(scene_spec_id);
