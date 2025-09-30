#!/usr/bin/env ts-node

/**
 * Redis Cleanup Script
 *
 * Removes stale keys and keeps only active data:
 * - Context storage: context:{sessionId}
 * - OAuth state: oauth_state:{state} (temporary with TTL)
 *
 * Run with: npx ts-node scripts/cleanup-redis.ts
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function cleanupRedis() {
  const redis = new Redis(REDIS_URL);

  console.log('🔍 Scanning Redis for keys...\n');

  try {
    // Get all keys
    const allKeys = await redis.keys('*');
    console.log(`Found ${allKeys.length} total keys\n`);

    if (allKeys.length === 0) {
      console.log('✅ Redis is already clean!');
      await redis.quit();
      return;
    }

    // Categorize keys
    const contextKeys: string[] = [];
    const oauthStateKeys: string[] = [];
    const unknownKeys: string[] = [];

    for (const key of allKeys) {
      if (key.startsWith('context:')) {
        contextKeys.push(key);
      } else if (key.startsWith('oauth_state:')) {
        oauthStateKeys.push(key);
      } else {
        unknownKeys.push(key);
      }
    }

    console.log('📊 Key Categories:');
    console.log(`  - Context keys: ${contextKeys.length}`);
    console.log(`  - OAuth state keys: ${oauthStateKeys.length}`);
    console.log(`  - Unknown keys: ${unknownKeys.length}\n`);

    // Show details about keys
    if (contextKeys.length > 0) {
      console.log('📝 Context Keys (keeping):');
      for (const key of contextKeys.slice(0, 5)) {
        const ttl = await redis.ttl(key);
        console.log(`  - ${key} (TTL: ${ttl === -1 ? 'no expiry' : ttl + 's'})`);
      }
      if (contextKeys.length > 5) {
        console.log(`  ... and ${contextKeys.length - 5} more`);
      }
      console.log();
    }

    if (oauthStateKeys.length > 0) {
      console.log('🔐 OAuth State Keys (keeping):');
      for (const key of oauthStateKeys.slice(0, 5)) {
        const ttl = await redis.ttl(key);
        console.log(`  - ${key} (TTL: ${ttl === -1 ? 'no expiry' : ttl + 's'})`);
      }
      if (oauthStateKeys.length > 5) {
        console.log(`  ... and ${oauthStateKeys.length - 5} more`);
      }
      console.log();
    }

    if (unknownKeys.length > 0) {
      console.log('❓ Unknown Keys (will delete):');
      for (const key of unknownKeys) {
        const type = await redis.type(key);
        const ttl = await redis.ttl(key);
        console.log(`  - ${key} (type: ${type}, TTL: ${ttl === -1 ? 'no expiry' : ttl + 's'})`);
      }
      console.log();

      // Confirm deletion
      console.log('⚠️  Ready to delete unknown keys. Press Ctrl+C to cancel, or hit Enter to continue...');

      // Wait for user input (only in interactive mode)
      if (process.stdin.isTTY) {
        await new Promise((resolve) => {
          process.stdin.once('data', resolve);
        });
      } else {
        console.log('Non-interactive mode: skipping confirmation');
      }

      // Delete unknown keys
      console.log('🗑️  Deleting unknown keys...');
      for (const key of unknownKeys) {
        await redis.del(key);
        console.log(`  ✓ Deleted: ${key}`);
      }
      console.log();
    }

    // Check for expired context keys (older than 5 minutes without access)
    console.log('🕐 Checking for stale context keys...');
    const staleContextKeys: string[] = [];
    for (const key of contextKeys) {
      const ttl = await redis.ttl(key);
      if (ttl !== -1 && ttl < 0) {
        // TTL expired but key still exists
        staleContextKeys.push(key);
      }
    }

    if (staleContextKeys.length > 0) {
      console.log(`Found ${staleContextKeys.length} stale context keys:`);
      for (const key of staleContextKeys) {
        await redis.del(key);
        console.log(`  ✓ Deleted: ${key}`);
      }
      console.log();
    }

    // Final summary
    const remainingKeys = await redis.keys('*');
    console.log('✅ Cleanup complete!');
    console.log(`\n📊 Summary:`);
    console.log(`  - Deleted: ${allKeys.length - remainingKeys.length} keys`);
    console.log(`  - Remaining: ${remainingKeys.length} keys`);
    console.log(`    - Context: ${contextKeys.length - staleContextKeys.length}`);
    console.log(`    - OAuth state: ${oauthStateKeys.length}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await redis.quit();
  }
}

// Run the cleanup
cleanupRedis()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });