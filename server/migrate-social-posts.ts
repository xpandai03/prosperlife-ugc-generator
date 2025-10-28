/**
 * Create social_posts table migration
 *
 * Run this script to manually create the social_posts table
 *
 * Usage:
 *   npx tsx server/migrate-social-posts.ts
 */

import 'dotenv/config';
import { pool } from './db';

const createTableSQL = `
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
`;

async function migrate() {
  console.log('🔧 Running migration: Create social_posts table...\n');

  try {
    // Execute the migration
    await pool.query(createTableSQL);
    console.log('✅ Migration completed successfully!\n');

    // Verify table exists
    const result = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'social_posts'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length > 0) {
      console.log('📋 Table structure:');
      console.table(result.rows);
    } else {
      console.log('⚠️  Warning: Table may not have been created');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
