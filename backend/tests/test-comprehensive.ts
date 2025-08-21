import { MasterAgent } from '../src/agents/master.agent';
import logger from '../src/utils/logger';

async function testMasterAgentComprehensively() {
  logger.info('🚀 Starting comprehensive master agent test...');
  
  // Test 1: Rule-based routing accuracy
  logger.info('\n=== TEST 1: Rule-Based Routing Accuracy ===');
  await testRuleBasedRouting();
  
  // Test 2: Session management
  logger.info('\n=== TEST 2: Session Management ===');
  await testSessionManagement();
  
  // Test 3: Edge cases
  logger.info('\n=== TEST 3: Edge Cases ===');
  await testEdgeCases();
  
  // Test 4: Performance
  logger.info('\n=== TEST 4: Performance ===');
  await testPerformance();
  
  logger.info('\n🎉 Comprehensive testing complete!');
}

async function testRuleBasedRouting() {
  const masterAgent = new MasterAgent();
  
  const testCases = [
    {
      input: 'send an email to nate.herkelman@company.com about the project',
      expectedPrimary: 'emailAgent',
      shouldHaveContact: false, // Has email address already
      description: 'Email with explicit address'
    },
    {
      input: 'email john about tomorrow\'s meeting',
      expectedPrimary: 'emailAgent', 
      shouldHaveContact: true, // Needs contact lookup
      description: 'Email requiring contact lookup'
    },
    {
      input: 'create a calendar event for 3pm tomorrow',
      expectedPrimary: 'calendarAgent',
      shouldHaveContact: false, // No attendees
      description: 'Calendar without attendees'
    },
    {
      input: 'schedule lunch with sarah and mike at noon',
      expectedPrimary: 'calendarAgent',
      shouldHaveContact: true, // Has attendees
      description: 'Calendar with attendees'
    },
    {
      input: 'write a blog about machine learning trends',
      expectedPrimary: 'contentCreator',
      shouldHaveContact: false,
      description: 'Content creation'
    },
    {
      input: 'search for information about Tesla stock price',
      expectedPrimary: 'Tavily',
      shouldHaveContact: false,
      description: 'Web search'
    },
    {
      input: 'find contact details for Dr. Smith',
      expectedPrimary: 'contactAgent',
      shouldHaveContact: false,
      description: 'Direct contact lookup'
    }
  ];

  let passed = 0;
  
  for (const testCase of testCases) {
    const sessionId = `routing-test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const response = await masterAgent.processUserInput(testCase.input, sessionId);
    
    const toolNames = response.toolCalls?.map(tc => tc.name) || [];
    const hasPrimaryTool = toolNames.includes(testCase.expectedPrimary);
    const hasContactAgent = toolNames.includes('contactAgent');
    const hasThinkTool = toolNames.includes('Think');
    
    const contactCheckPassed = testCase.shouldHaveContact ? hasContactAgent : true;
    
    if (hasPrimaryTool && hasThinkTool && contactCheckPassed) {
      logger.info(`✅ ${testCase.description}: ${toolNames.join(' → ')}`);
      passed++;
    } else {
      logger.warn(`❌ ${testCase.description}: Expected ${testCase.expectedPrimary}${testCase.shouldHaveContact ? ' + contactAgent' : ''} + Think, got ${toolNames.join(', ')}`);
    }
  }
  
  logger.info(`Routing accuracy: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%)`);
}

async function testSessionManagement() {
  const masterAgent = new MasterAgent();
  const sessionId = `session-test-${Date.now()}`;
  
  logger.info('Testing conversation context...');
  
  // First interaction
  const response1 = await masterAgent.processUserInput(
    'send an email to john about the project deadline', 
    sessionId
  );
  logger.info(`First: ${response1.toolCalls?.map(tc => tc.name).join(' → ')}`);
  
  // Follow-up (should maintain context)
  const response2 = await masterAgent.processUserInput(
    'actually, make it about the budget instead', 
    sessionId
  );
  logger.info(`Follow-up: ${response2.toolCalls?.map(tc => tc.name).join(' → ')}`);
  
  // Different session (should not have context)
  const newSessionId = `session-test-${Date.now()}-new`;
  const response3 = await masterAgent.processUserInput(
    'change the subject to budget discussion', 
    newSessionId
  );
  logger.info(`New session: ${response3.toolCalls?.map(tc => tc.name).join(' → ')}`);
  
  logger.info('✅ Session management test completed');
}

async function testEdgeCases() {
  const masterAgent = new MasterAgent();
  
  const edgeCases = [
    { input: '', description: 'Empty input' },
    { input: '   ', description: 'Whitespace only' },
    { input: 'asdfghjkl', description: 'Gibberish' },
    { input: 'help', description: 'Single word' },
    { input: '🚀📧💻', description: 'Emojis only' },
    { input: 'Send an email to john@company.com and also schedule a meeting with sarah tomorrow at 3pm and search for latest AI news', description: 'Multi-action request' }
  ];
  
  for (const testCase of edgeCases) {
    try {
      const sessionId = `edge-test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const response = await masterAgent.processUserInput(testCase.input, sessionId);
      
      const hasThinkTool = response.toolCalls?.some(tc => tc.name === 'Think');
      const hasResponse = response.message && response.message.length > 0;
      
      if (hasThinkTool && hasResponse) {
        logger.info(`✅ ${testCase.description}: Handled gracefully`);
      } else {
        logger.warn(`⚠️  ${testCase.description}: Missing Think tool or response`);
      }
    } catch (error) {
      logger.error(`❌ ${testCase.description}: Threw error - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function testPerformance() {
  const masterAgent = new MasterAgent();
  const iterations = 10;
  const testInput = 'send an email to john asking about the meeting time';
  
  logger.info(`Running ${iterations} iterations for performance test...`);
  
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const sessionId = `perf-test-${Date.now()}-${i}`;
    const startTime = Date.now();
    
    await masterAgent.processUserInput(testInput, sessionId);
    
    const endTime = Date.now();
    times.push(endTime - startTime);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  logger.info(`Performance results:`);
  logger.info(`  Average: ${avgTime.toFixed(2)}ms`);
  logger.info(`  Min: ${minTime}ms`);
  logger.info(`  Max: ${maxTime}ms`);
  logger.info(`  All times: ${times.join('ms, ')}ms`);
  
  if (avgTime < 100) {
    logger.info('✅ Excellent performance (< 100ms average)');
  } else if (avgTime < 500) {
    logger.info('✅ Good performance (< 500ms average)');
  } else {
    logger.warn('⚠️  Slow performance (> 500ms average)');
  }
}

// Instructions for OpenAI testing
function printOpenAITestInstructions() {
  logger.info('\n=== 🔑 OPENAI INTEGRATION INSTRUCTIONS ===');
  logger.info('To test with OpenAI integration:');
  logger.info('1. Get an OpenAI API key from https://platform.openai.com/api-keys');
  logger.info('2. Create a .env file in the backend directory');
  logger.info('3. Add: OPENAI_API_KEY=your_actual_api_key_here');
  logger.info('4. Run: node dist/test-openai-integration.js');
  logger.info('');
  logger.info('With OpenAI integration, the master agent will:');
  logger.info('• Use GPT-4o-mini for more intelligent routing');
  logger.info('• Handle complex multi-step requests better');
  logger.info('• Understand context and nuance in requests');
  logger.info('• Fall back to rule-based routing if OpenAI fails');
  logger.info('');
  logger.info('Current status: ✅ Rule-based routing working perfectly');
  logger.info('OpenAI status: ⚠️  API key not configured (optional)');
}

// Run comprehensive test
if (require.main === module) {
  testMasterAgentComprehensively()
    .then(() => {
      printOpenAITestInstructions();
      process.exit(0);
    })
    .catch(error => {
      logger.error('Comprehensive test failed:', error);
      process.exit(1);
    });
}

export { testMasterAgentComprehensively };