-- Migration: Add UGC Chain Support to media_assets
-- Created: 2025-11-07
-- Purpose: Enable tracking of chained generation workflows (NanoBanana + Veo3)

-- Add generation_mode column to track which workflow was used
ALTER TABLE media_assets
  ADD COLUMN generation_mode VARCHAR(50);

-- Add chain_metadata column to store intermediate results and chain state
ALTER TABLE media_assets
  ADD COLUMN chain_metadata JSONB;

-- Add comments for clarity
COMMENT ON COLUMN media_assets.generation_mode IS 'Generation workflow mode: "nanobana+veo3", "veo3-only", "sora2", or null for legacy';
COMMENT ON COLUMN media_assets.chain_metadata IS 'Stores chain state: { step, nanoImageUrl, imageAnalysis, videoPrompt }';

-- Create index for querying by generation mode
CREATE INDEX idx_media_assets_generation_mode ON media_assets(generation_mode);

-- Example chain_metadata structure:
-- {
--   "step": "analyzing_image",  // "generating_image" | "analyzing_image" | "generating_video" | "completed"
--   "nanoImageUrl": "https://...",
--   "nanoTaskId": "...",
--   "imageAnalysis": "Person in gym holding product...",
--   "videoPrompt": "Full video prompt text",
--   "videoTaskId": "...",
--   "timestamps": {
--     "imageStarted": "2025-11-07T10:00:00Z",
--     "imageCompleted": "2025-11-07T10:00:15Z",
--     "videoStarted": "2025-11-07T10:00:20Z"
--   }
-- }
