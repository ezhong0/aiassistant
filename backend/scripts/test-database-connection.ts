#!/usr/bin/env ts-node

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection...\n');

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔗 Connecting to PostgreSQL database...');
  console.log(`URL: ${databaseUrl.replace(/:[^:@]*@/, ':****@')}`); // Hide password
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('postgresql://') ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');

    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sessions', 'oauth_tokens', 'slack_workspaces', 'slack_users')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Database Tables:');
    const expectedTables = ['sessions', 'oauth_tokens', 'slack_workspaces', 'slack_users'];
    const foundTables = tablesResult.rows.map(row => row.table_name);
    
    expectedTables.forEach(table => {
      const exists = foundTables.includes(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    });

    // Check if there are any OAuth tokens stored
    const tokensResult = await client.query(`
      SELECT COUNT(*) as count FROM oauth_tokens
    `);
    
    console.log(`\n🔑 OAuth Tokens Stored: ${tokensResult.rows[0].count}`);

    // Check if there are any sessions
    const sessionsResult = await client.query(`
      SELECT COUNT(*) as count FROM sessions
    `);
    
    console.log(`📝 Sessions Stored: ${sessionsResult.rows[0].count}`);

    // Show recent OAuth tokens (without sensitive data)
    const recentTokensResult = await client.query(`
      SELECT 
        session_id,
        token_type,
        scope,
        created_at,
        expires_at
      FROM oauth_tokens 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (recentTokensResult.rows.length > 0) {
      console.log('\n🕒 Recent OAuth Tokens:');
      recentTokensResult.rows.forEach((token, index) => {
        console.log(`  ${index + 1}. Session: ${token.session_id.substring(0, 20)}...`);
        console.log(`     Type: ${token.token_type}`);
        console.log(`     Scope: ${token.scope}`);
        console.log(`     Created: ${token.created_at}`);
        console.log(`     Expires: ${token.expires_at}`);
        console.log('');
      });
    }

    client.release();
    await pool.end();
    
    console.log('✅ Database test completed successfully!');
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`  • Database connection: ✅ Working`);
    console.log(`  • Tables created: ${foundTables.length}/${expectedTables.length}`);
    console.log(`  • OAuth tokens stored: ${tokensResult.rows[0].count}`);
    console.log(`  • Sessions stored: ${sessionsResult.rows[0].count}`);
    
    if (foundTables.length === expectedTables.length) {
      console.log('  • Database schema: ✅ Complete');
    } else {
      console.log('  • Database schema: ❌ Incomplete');
    }

  } catch (error: any) {
    console.error('❌ Database test failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 This is likely because you\'re trying to connect to Railway\'s internal database URL from outside Railway.');
      console.log('   The database will work when deployed to Railway, but not from local development.');
      console.log('   To fix this, get the public database URL from your Railway dashboard.');
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testDatabaseConnection().then(() => {
    console.log('\n🎉 Database connection test completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Database connection test failed:', error);
    process.exit(1);
  });
}

export { testDatabaseConnection };
