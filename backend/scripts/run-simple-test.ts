#!/usr/bin/env ts-node

/**
 * Simple test runner without Jest overhead
 * Runs a single test file to avoid memory issues
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';  
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

import { createMasterAgent } from '../src/config/agent-factory-init';

async function runSimpleTest() {
  console.log('🧪 Running Simple Master Agent Test');
  
  try {
    const masterAgent = createMasterAgent();
    
    // Test 1: Basic email routing
    console.log('\n📧 Test 1: Email routing');
    const emailResult = await masterAgent.processUserInput(
      'Send an email to john@company.com about the project', 
      'test-session-1'
    );
    console.log(`✅ Agents: [${emailResult.toolCalls?.map(c => c.name).join(', ')}]`);
    console.log(`📝 Message: ${emailResult.message.substring(0, 100)}...`);
    
    // Test 2: Calendar scheduling
    console.log('\n📅 Test 2: Calendar scheduling');
    const calendarResult = await masterAgent.processUserInput(
      'Schedule a meeting with the team tomorrow at 2pm', 
      'test-session-2'
    );
    console.log(`✅ Agents: [${calendarResult.toolCalls?.map(c => c.name).join(', ')}]`);
    console.log(`📝 Message: ${calendarResult.message.substring(0, 100)}...`);
    
    // Test 3: Contact lookup
    console.log('\n👤 Test 3: Contact lookup');
    const contactResult = await masterAgent.processUserInput(
      'Find Dr. Smith\'s phone number', 
      'test-session-3'
    );
    console.log(`✅ Agents: [${contactResult.toolCalls?.map(c => c.name).join(', ')}]`);
    console.log(`📝 Message: ${contactResult.message.substring(0, 100)}...`);
    
    // Test 4: Content creation
    console.log('\n✍️ Test 4: Content creation');
    const contentResult = await masterAgent.processUserInput(
      'Write a blog post about AI trends', 
      'test-session-4'
    );
    console.log(`✅ Agents: [${contentResult.toolCalls?.map(c => c.name).join(', ')}]`);
    console.log(`📝 Message: ${contentResult.message.substring(0, 100)}...`);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the test
runSimpleTest().then(() => {
  console.log('✨ Test runner completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
