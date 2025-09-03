import { createClient } from 'redis';
import logger from '../src/utils/logger';

/**
 * Test Redis connection for Railway deployment
 */
async function testRedisConnection(): Promise<void> {
  console.log('🔄 Testing Redis connection...\n');

  // Check environment variables
  const redisEnvVars = Object.keys(process.env).filter(key => 
    key.toLowerCase().includes('redis'));
  
  if (redisEnvVars.length === 0) {
    console.log('❌ No Redis environment variables found');
    console.log('   Available environment variables that might be Redis:');
    Object.keys(process.env)
      .filter(key => key.toUpperCase().includes('URL') || key.toUpperCase().includes('HOST'))
      .forEach(key => console.log(`   - ${key}`));
    return;
  }

  console.log('📋 Found Redis environment variables:');
  redisEnvVars.forEach(key => {
    const value = process.env[key];
    const masked = value ? value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : '';
    console.log(`   - ${key}=${masked}`);
  });

  // Determine Redis URL
  const redisUrl = process.env.REDIS_URL || 
                   process.env.REDISCLOUD_URL || 
                   process.env.REDIS_PRIVATE_URL ||
                   process.env.REDIS_PUBLIC_URL ||
                   process.env.RAILWAY_REDIS_URL ||
                   'redis://localhost:6379';

  console.log(`\n🔗 Using Redis URL: ${redisUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

  // Test connection
  let client;
  try {
    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: false // Don't retry for testing
      },
      disableOfflineQueue: true
    });

    // Set up error handler
    client.on('error', (error) => {
      console.log('❌ Redis connection error:', error.message);
    });

    console.log('🔄 Attempting to connect...');
    await client.connect();

    console.log('✅ Connected to Redis!');

    // Test basic operations
    console.log('🧪 Testing basic operations...');
    
    await client.set('test:connection', 'success', { EX: 10 });
    console.log('✅ SET operation successful');
    
    const value = await client.get('test:connection');
    console.log(`✅ GET operation successful: ${value}`);
    
    await client.del('test:connection');
    console.log('✅ DELETE operation successful');

    // Get server info
    const info = await client.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown';
    console.log(`✅ Redis server version: ${version}`);

    await client.ping();
    console.log('✅ PING successful');

    console.log('\n🎉 Redis connection test completed successfully!');

  } catch (error: any) {
    console.log('\n❌ Redis connection test failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting suggestions:');
      console.log('   1. Ensure Redis service is provisioned in Railway');
      console.log('   2. Check if REDIS_URL environment variable is set');
      console.log('   3. Verify Redis service is running and accessible');
      console.log('   4. Consider setting DISABLE_REDIS=true to bypass Redis');
    }
  } finally {
    if (client) {
      try {
        await client.disconnect();
        console.log('🔌 Disconnected from Redis');
      } catch (disconnectError) {
        console.log('⚠️ Warning: Error during disconnect:', (disconnectError as Error).message);
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testRedisConnection().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { testRedisConnection };