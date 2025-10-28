/**
 * Late.dev API Connection Test
 *
 * Run this script to verify Late.dev API connectivity and configuration
 *
 * Usage:
 *   npx tsx server/test-late-api.ts
 */

import 'dotenv/config';
import { lateService } from './services/late';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

async function main() {
  log('\n==========================================', COLORS.cyan);
  log('  Late.dev API Connection Test', COLORS.cyan);
  log('==========================================\n', COLORS.cyan);

  // Check environment variables
  log('1. Checking environment variables...', COLORS.blue);

  if (!process.env.LATE_API_KEY) {
    log('   ✗ LATE_API_KEY is not set', COLORS.red);
    log('   Please add LATE_API_KEY to your .env file\n', COLORS.yellow);
    process.exit(1);
  }

  log(`   ✓ LATE_API_KEY found (${process.env.LATE_API_KEY.substring(0, 10)}...)`, COLORS.green);

  // Test connection
  log('\n2. Testing connection to Late.dev API...', COLORS.blue);

  const isConnected = await lateService.testConnection();

  if (!isConnected) {
    log('   ✗ Connection failed', COLORS.red);
    log('   Check your API key and internet connection\n', COLORS.yellow);
    process.exit(1);
  }

  // Get connected accounts
  log('\n3. Fetching connected accounts...', COLORS.blue);

  try {
    const accountsData = await lateService.getAccounts();
    const accounts = accountsData.accounts || [];

    if (accounts.length === 0) {
      log('   ⚠ No connected accounts found', COLORS.yellow);
      log('   You need to connect an Instagram account via Late.dev dashboard\n', COLORS.yellow);
    } else {
      log(`   ✓ Found ${accounts.length} connected account(s):`, COLORS.green);

      accounts.forEach((account: any) => {
        log(`\n   Platform: ${account.platform}`, COLORS.reset);
        log(`   Username: ${account.username || 'N/A'}`, COLORS.reset);
        log(`   Account ID: ${account._id}`, COLORS.reset);
        log(`   Active: ${account.isActive ? 'Yes' : 'No'}`, COLORS.reset);
      });
    }
  } catch (error) {
    log('   ✗ Failed to fetch accounts', COLORS.red);
    log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`, COLORS.red);
  }

  // Summary
  log('\n==========================================', COLORS.cyan);
  log('  Test Summary', COLORS.cyan);
  log('==========================================\n', COLORS.cyan);

  log('✓ Environment configured', COLORS.green);
  log('✓ Late.dev API accessible', COLORS.green);

  log('\nYou can now use the social posting feature!', COLORS.green);
  log('\nNext steps:', COLORS.blue);
  log('1. Run database migration: npm run db:push', COLORS.reset);
  log('2. Start the server: npm run dev', COLORS.reset);
  log('3. Test the POST /api/social/post endpoint\n', COLORS.reset);
}

main().catch((error) => {
  log('\n✗ Test failed with error:', COLORS.red);
  console.error(error);
  process.exit(1);
});
