/**
 * One-Time Migration: Reconcile User IDs Between Supabase Auth and Neon DB
 *
 * **Problem:** Split database architecture causes ID mismatches
 * - Supabase Auth creates users with UUID A
 * - Neon DB may have same email with UUID B
 * - This causes "duplicate key" errors and "user not found" issues
 *
 * **Solution:** Update Neon DB user IDs to match Supabase auth IDs
 *
 * **Usage:**
 *   npx tsx server/migrate-reconcile-user-ids.ts
 *
 * **Safety:**
 * - Dry-run mode by default (set DRY_RUN=false to execute)
 * - Only updates users where email matches but ID differs
 * - Preserves all user data (subscription, Stripe ID, etc.)
 */

import { supabaseAdmin } from './services/supabaseAuth';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry-run

interface UserMismatch {
  email: string;
  neonId: string;
  supabaseId: string;
  subscriptionStatus?: string;
  stripeCustomerId?: string;
}

async function findMismatchedUsers(): Promise<UserMismatch[]> {
  console.log('[Migration] Fetching users from Neon DB...');

  // Get all users from Neon
  const neonUsers = await db.select().from(users);
  console.log(`[Migration] Found ${neonUsers.length} users in Neon DB`);

  console.log('[Migration] Fetching users from Supabase Auth...');

  // Get all users from Supabase auth
  const { data: { users: supabaseUsers }, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    console.error('[Migration] Error fetching Supabase users:', error);
    throw error;
  }

  console.log(`[Migration] Found ${supabaseUsers?.length || 0} users in Supabase Auth`);

  // Find mismatches
  const mismatches: UserMismatch[] = [];

  for (const neonUser of neonUsers) {
    const supabaseUser = supabaseUsers?.find(su => su.email === neonUser.email);

    if (supabaseUser && supabaseUser.id !== neonUser.id) {
      mismatches.push({
        email: neonUser.email,
        neonId: neonUser.id,
        supabaseId: supabaseUser.id,
        subscriptionStatus: neonUser.subscriptionStatus || undefined,
        stripeCustomerId: neonUser.stripeCustomerId || undefined,
      });
    }
  }

  return mismatches;
}

async function reconcileUserIds(mismatches: UserMismatch[]) {
  console.log(`\n[Migration] Found ${mismatches.length} users with mismatched IDs\n`);

  if (mismatches.length === 0) {
    console.log('[Migration] ✅ No mismatches found. Database is in sync!');
    return;
  }

  // Display mismatches
  console.log('Mismatched Users:');
  console.log('='.repeat(100));
  mismatches.forEach((mismatch, index) => {
    console.log(`${index + 1}. Email: ${mismatch.email}`);
    console.log(`   Neon ID:     ${mismatch.neonId}`);
    console.log(`   Supabase ID: ${mismatch.supabaseId}`);
    if (mismatch.subscriptionStatus) {
      console.log(`   Subscription: ${mismatch.subscriptionStatus}`);
    }
    if (mismatch.stripeCustomerId) {
      console.log(`   Stripe Customer: ${mismatch.stripeCustomerId}`);
    }
    console.log('');
  });
  console.log('='.repeat(100));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN MODE: No changes will be made to the database');
    console.log('To execute this migration, run: DRY_RUN=false npx tsx server/migrate-reconcile-user-ids.ts\n');
    return;
  }

  // Execute migration
  console.log('\n[Migration] Updating user IDs in Neon DB...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const mismatch of mismatches) {
    try {
      console.log(`[Migration] Updating ${mismatch.email}...`);
      console.log(`  Old ID: ${mismatch.neonId}`);
      console.log(`  New ID: ${mismatch.supabaseId}`);

      const [updatedUser] = await db
        .update(users)
        .set({
          id: mismatch.supabaseId,
          updatedAt: new Date(),
        })
        .where(eq(users.email, mismatch.email))
        .returning();

      if (updatedUser) {
        console.log(`  ✅ Success`);
        successCount++;
      } else {
        console.log(`  ❌ Failed - user not found after update`);
        errorCount++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
    console.log('');
  }

  console.log('\n' + '='.repeat(100));
  console.log('[Migration] Summary:');
  console.log(`  Total mismatches: ${mismatches.length}`);
  console.log(`  Successful updates: ${successCount}`);
  console.log(`  Failed updates: ${errorCount}`);
  console.log('='.repeat(100));

  if (successCount === mismatches.length) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log(`\n⚠️  Migration completed with ${errorCount} errors. Please review the logs above.`);
  }
}

async function main() {
  try {
    console.log('[Migration] Starting User ID Reconciliation Migration...\n');
    console.log(`Mode: ${DRY_RUN ? '⚠️  DRY-RUN (no changes)' : '🚀 EXECUTE (will update database)'}\n`);

    const mismatches = await findMismatchedUsers();
    await reconcileUserIds(mismatches);

    console.log('\n[Migration] Migration script finished.');
    process.exit(0);
  } catch (error) {
    console.error('\n[Migration] Fatal error:', error);
    process.exit(1);
  }
}

main();
