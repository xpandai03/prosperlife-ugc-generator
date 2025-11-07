/**
 * Database Migration Script - Add Media Assets Table
 *
 * Adds AI media generation tracking for Phase 4
 * Run with: tsx scripts/migrate-media-assets.ts
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const client = neon(DATABASE_URL);
const db = drizzle(client);

async function runMigration() {
  console.log("🚀 Starting Phase 4 Media Assets Migration...\n");

  try {
    // Step 1: Create media_assets table
    console.log("📝 Step 1: Creating media_assets table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        reference_image_url TEXT,
        status TEXT NOT NULL,
        task_id TEXT,
        result_url TEXT,
        result_urls JSONB,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        metadata JSONB,
        api_response JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        completed_at TIMESTAMP
      )
    `);

    console.log("✅ Created media_assets table\n");

    // Step 2: Create indexes
    console.log("📝 Step 2: Creating indexes...");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
      CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);
      CREATE INDEX IF NOT EXISTS idx_media_assets_provider ON media_assets(provider);
      CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(type);
      CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_media_assets_processing ON media_assets(status, created_at)
        WHERE status = 'processing';
    `);

    console.log("✅ Created indexes\n");

    // Step 3: Add media_generations_created to user_usage
    console.log("📝 Step 3: Updating user_usage table...");

    await db.execute(sql`
      ALTER TABLE user_usage
      ADD COLUMN IF NOT EXISTS media_generations_created INTEGER NOT NULL DEFAULT 0
    `);

    console.log("✅ Updated user_usage table\n");

    // Step 4: Verify
    console.log("📝 Step 4: Verifying migration...");

    const columnsCheck = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'media_assets'
      ORDER BY ordinal_position
    `);

    console.log("Media assets table columns:", columnsCheck.rows.length);

    const indexesCheck = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'media_assets'
    `);

    console.log("Media assets indexes:", indexesCheck.rows.length);

    console.log("\n✅ Migration verification complete\n");

    console.log("🎉 Phase 4 migration completed successfully!");
    console.log("\nNew table created:");
    console.log("  ✓ media_assets (tracks AI-generated images and videos)");
    console.log("\nNew column added:");
    console.log("  ✓ user_usage.media_generations_created (for usage limits)");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log("✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  });
