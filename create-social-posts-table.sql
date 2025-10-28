-- Create social_posts table for tracking social media posts via Late.dev API

CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  platform TEXT NOT NULL,
  late_post_id TEXT,
  platform_post_url TEXT,
  caption TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  late_response JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_social_posts_project_id ON social_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_task_id ON social_posts(task_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);

-- Verify table creation
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'social_posts'
ORDER BY ordinal_position;
