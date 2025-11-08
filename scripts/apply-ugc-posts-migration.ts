/**
 * Apply UGC Social Posts Migration
 *
 * Run this script to update the social_posts table to support UGC videos
 * Usage: npx tsx scripts/apply-ugc-posts-migration.ts
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function applyMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    console.log('✅ Connected to database');
    console.log('📝 Reading migration file...');

    // Read migration SQL
    const migrationPath = join(process.cwd(), 'db', 'migrations', '0005_ugc_social_posts.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Applying migration: 0005_ugc_social_posts.sql');
    console.log('----------------------------------------');
    console.log(migrationSQL);
    console.log('----------------------------------------');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Changes made:');
    console.log('  - project_id: NOT NULL → nullable');
    console.log('  - task_id: NOT NULL → nullable');
    console.log('  - Added media_asset_id column (nullable)');
    console.log('  - Added check constraint: (project_id + task_id) XOR media_asset_id');
    console.log('  - Added index on media_asset_id');
    console.log('');
    console.log('🎉 Database ready for UGC video posting!');

    client.release();
    await pool.end();
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

applyMigration();
