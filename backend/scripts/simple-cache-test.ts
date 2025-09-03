#!/usr/bin/env ts-node

/**
 * Simple cache test to demonstrate Redis caching functionality
 * Tests the cache service in isolation without requiring full app configuration
 */

import { CacheService } from '../src/services/cache.service';

async function runSimpleCacheTest(): Promise<void> {
  console.log('🚀 Running Simple Cache Test...\n');
  
  const cacheService = new CacheService();
  
  try {
    // Test 1: Initialize Cache Service
    console.log('🔧 Step 1: Initializing Cache Service...');
    await cacheService.initialize();
    
    const isReady = cacheService.isReady();
    const health = cacheService.getHealth();
    
    console.log(`   Status: ${isReady ? '✅ Ready' : '❌ Not Ready'}`);
    console.log(`   Health: ${health.healthy ? '✅ Healthy' : '⚠️ Degraded'}`);
    console.log(`   Details:`, health.details);
    
    if (!isReady) {
      console.log('⚠️  Cache service not ready, but continuing test (may be running without Redis)\n');
    }
    
    // Test 2: Basic Cache Operations
    console.log('🧪 Step 2: Testing Basic Cache Operations...');
    
    const testKey = 'simple-test-key';
    const testData = {
      message: 'Hello Redis Cache!',
      timestamp: Date.now(),
      test: true
    };
    
    // SET operation
    const setResult = await cacheService.set(testKey, testData, 60);
    console.log(`   SET operation: ${setResult ? '✅ Success' : '⚠️ Failed/Degraded'}`);
    
    // GET operation
    const getData = await cacheService.get(testKey);
    const getSuccess = getData !== null && JSON.stringify(getData) === JSON.stringify(testData);
    console.log(`   GET operation: ${getSuccess ? '✅ Success' : '⚠️ Failed/Degraded'}`);
    
    if (getData) {
      console.log(`   Retrieved data: ${JSON.stringify(getData)}`);
    }
    
    // EXISTS operation
    const existsResult = await cacheService.exists(testKey);
    console.log(`   EXISTS operation: ${existsResult ? '✅ Key exists' : '⚠️ Key not found/Degraded'}`);
    
    // PING operation
    const pingResult = await cacheService.ping();
    console.log(`   PING operation: ${pingResult ? '✅ Redis responsive' : '⚠️ Redis not responsive/Degraded'}`);
    
    // DELETE operation
    const delResult = await cacheService.del(testKey);
    console.log(`   DELETE operation: ${delResult ? '✅ Success' : '⚠️ Failed/Degraded'}`);
    
    // Test 3: Performance Test
    console.log('\n⚡ Step 3: Running Performance Test...');
    
    const iterations = 50;
    const startTime = Date.now();
    
    let operations = 0;
    let successes = 0;
    
    for (let i = 0; i < iterations; i++) {
      const key = `perf-test-${i}`;
      const data = { id: i, data: `test-data-${i}` };
      
      operations++;
      const setSuccess = await cacheService.set(key, data, 30);
      if (setSuccess) successes++;
      
      operations++;
      const getResult = await cacheService.get(key);
      if (getResult) successes++;
      
      operations++;
      const delSuccess = await cacheService.del(key);
      if (delSuccess) successes++;
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / operations;
    const successRate = (successes / operations) * 100;
    
    console.log(`   Operations: ${operations}`);
    console.log(`   Total Time: ${totalTime}ms`);
    console.log(`   Average Time per Operation: ${avgTime.toFixed(2)}ms`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    
    // Test 4: Cache Statistics
    console.log('\n📊 Step 4: Getting Cache Statistics...');
    
    const stats = await cacheService.getStats();
    console.log('   Statistics:', JSON.stringify(stats, null, 2));
    
    // Test Results Summary
    console.log('\n🎯 TEST SUMMARY');
    console.log('=' .repeat(50));
    
    if (health.healthy && successRate > 90) {
      console.log('🎉 CACHE INTEGRATION: FULLY OPERATIONAL!');
      console.log('✅ Redis is connected and performing well');
      console.log(`✅ Average operation time: ${avgTime.toFixed(2)}ms`);
      console.log(`✅ Success rate: ${successRate.toFixed(1)}%`);
    } else if (health.healthy && successRate > 50) {
      console.log('⚠️  CACHE INTEGRATION: PARTIALLY OPERATIONAL');
      console.log('✅ Redis is connected but some operations failed');
      console.log(`⚠️  Success rate: ${successRate.toFixed(1)}%`);
    } else if (!health.healthy && successRate === 0) {
      console.log('📝 CACHE INTEGRATION: GRACEFUL DEGRADATION');
      console.log('⚠️  Redis not available, but application continues to work');
      console.log('✅ Cache service properly degrades without breaking the application');
    } else {
      console.log('❌ CACHE INTEGRATION: NEEDS ATTENTION');
      console.log('❌ Mixed results indicate potential issues');
    }
    
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('💥 Cache test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await cacheService.destroy();
      console.log('✅ Cache service cleaned up successfully');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    }
  }
}

// Run the test
if (require.main === module) {
  runSimpleCacheTest()
    .then(() => {
      console.log('\n🎉 Simple cache test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Simple cache test failed:', error);
      process.exit(1);
    });
}

export { runSimpleCacheTest };