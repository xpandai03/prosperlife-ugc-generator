/**
 * Apply UGC Chain Support Migration
 *
 * Adds generation_mode and chain_metadata columns to media_assets table
 * Usage: npx tsx scripts/apply-ugc-chain-migration.ts
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
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    console.log('✅ Connected to database');
    console.log('📝 Reading migration file...');

    // Read migration SQL
    const migrationPath = join(process.cwd(), 'db', 'migrations', '0006_ugc_chain_support.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Applying migration: 0006_ugc_chain_support.sql');
    console.log('----------------------------------------');
    console.log(migrationSQL);
    console.log('----------------------------------------');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Changes made:');
    console.log('  - Added generation_mode column (VARCHAR(50))');
    console.log('  - Added chain_metadata column (JSONB)');
    console.log('  - Added index on generation_mode');
    console.log('');
    console.log('Schema now supports:');
    console.log('  - Mode A: NanoBanana + Veo3 (best quality)');
    console.log('  - Mode B: Veo3 only (faster)');
    console.log('  - Mode C: Sora 2 (cheaper fallback)');
    console.log('');
    console.log('🎉 Database ready for UGC chain workflows!');

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
