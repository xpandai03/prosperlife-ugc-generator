-- Migration: Make social_posts support UGC videos (no project/task required)
-- Created: 2025-11-07
-- Purpose: Allow posting UGC videos from media_assets without project_id/task_id

-- Make project_id and task_id nullable to support UGC video posts
ALTER TABLE social_posts
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN task_id DROP NOT NULL;

-- Add optional reference to media_assets for UGC posts
ALTER TABLE social_posts
  ADD COLUMN media_asset_id TEXT REFERENCES media_assets(id);

-- Add comment for clarity
COMMENT ON COLUMN social_posts.project_id IS 'Klap video project ID (nullable for UGC posts)';
COMMENT ON COLUMN social_posts.task_id IS 'Klap video task ID (nullable for UGC posts)';
COMMENT ON COLUMN social_posts.media_asset_id IS 'UGC video media asset ID (nullable for Klap posts)';

-- Add constraint: either project_id OR media_asset_id must be present
ALTER TABLE social_posts
  ADD CONSTRAINT social_posts_source_check
  CHECK (
    (project_id IS NOT NULL AND task_id IS NOT NULL AND media_asset_id IS NULL) OR
    (project_id IS NULL AND task_id IS NULL AND media_asset_id IS NOT NULL)
  );

-- Index for querying UGC posts by media asset
CREATE INDEX idx_social_posts_media_asset_id ON social_posts(media_asset_id);
