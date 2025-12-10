-- Migration: Add rating and soft delete support to media_assets (UGC)
-- Created: 2025-12-09

-- Add rating column (1-5 stars, nullable)
ALTER TABLE media_assets
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Add deleted_at column for soft delete
ALTER TABLE media_assets
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for faster filtering of non-deleted assets
CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at ON media_assets(deleted_at);

-- Create index for filtering by user + deleted status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_media_assets_user_deleted ON media_assets(user_id, deleted_at);
