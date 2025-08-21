import { MasterAgent } from '../src/agents/master.agent';
import logger from '../src/utils/logger';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from main project root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testOpenAIIntegration() {
  logger.info('Starting OpenAI Integration test...');
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    logger.warn('OPENAI_API_KEY not found in environment variables');
    logger.info('Testing without OpenAI (rule-based routing only)...');
    return testRuleBasedOnly();
  }

  logger.info('Found OpenAI API key, testing with OpenAI integration...');

  // Initialize master agent WITH OpenAI
  const masterAgent = new MasterAgent({
    openaiApiKey,
    model: 'gpt-4o-mini'
  });
  
  const testCases = [
    {
      name: 'Complex email request',
      input: 'send an email to nate herkelman asking him what time he wants to leave for the conference tomorrow',
      expectedTools: ['contactAgent', 'emailAgent', 'Think'],
      description: 'Should lookup contact first, then send email, then verify'
    },
    {
      name: 'Calendar with multiple attendees',
      input: 'schedule a meeting with john and sarah tomorrow at 3pm to discuss the project',
      expectedTools: ['contactAgent', 'calendarAgent', 'Think'],
      description: 'Should lookup contacts for attendees first'
    },
    {
      name: 'Direct contact lookup',
      input: 'what is sarah\'s email address?',
      expectedTools: ['contactAgent', 'Think'],
      description: 'Simple contact lookup'
    },
    {
      name: 'Blog post creation',
      input: 'write a blog post about the benefits of AI in healthcare',
      expectedTools: ['contentCreator', 'Think'],
      description: 'Content creation task'
    },
    {
      name: 'Web search query',
      input: 'find the latest information about OpenAI GPT-4 updates',
      expectedTools: ['Tavily', 'Think'],
      description: 'Web search task'
    },
    {
      name: 'Ambiguous request',
      input: 'help me organize my day',
      expectedTools: ['Think'],
      description: 'Should use Think to analyze unclear request'
    },
    {
      name: 'Multi-step request',
      input: 'find john\'s contact info and then send him an email about tomorrow\'s meeting',
      expectedTools: ['contactAgent', 'emailAgent', 'Think'],
      description: 'Explicit multi-step request'
    },
    {
      name: 'Calendar without attendees',
      input: 'schedule a personal reminder for 9am tomorrow to call the dentist',
      expectedTools: ['calendarAgent', 'Think'],
      description: 'Calendar event without attendees - no contact lookup needed'
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      logger.info(`\n--- Testing: ${testCase.name} ---`);
      logger.info(`Input: "${testCase.input}"`);
      logger.info(`Description: ${testCase.description}`);
      
      const sessionId = `openai-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
      
      const response = await masterAgent.processUserInput(testCase.input, sessionId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logger.info(`Response (${duration}ms): ${response.message}`);
      logger.info(`Tool calls: ${response.toolCalls?.map(tc => `${tc.name}(${JSON.stringify(tc.parameters).slice(0, 50)}...)`).join(', ') || 'none'}`);
      
      // Check if expected tools are present
      const actualTools = response.toolCalls?.map(tc => tc.name) || [];
      const hasExpectedTools = testCase.expectedTools.every(expectedTool => 
        actualTools.includes(expectedTool)
      );
      
      // Check for Think tool (should always be present)
      const hasThinkTool = actualTools.includes('Think');
      
      if (hasExpectedTools && hasThinkTool) {
        logger.info(`✅ PASSED: All expected tools called including Think`);
        passedTests++;
      } else {
        logger.warn(`❌ FAILED: Expected ${testCase.expectedTools.join(', ')}, got ${actualTools.join(', ')}`);
        if (!hasThinkTool) {
          logger.warn('   ⚠️  Missing mandatory Think tool!');
        }
      }
      
      // Test conversation context by asking a follow-up
      if (actualTools.length > 0) {
        logger.info('   Testing conversation context with follow-up...');
        const followUpResponse = await masterAgent.processUserInput(
          'actually, change that to 4pm instead', 
          sessionId
        );
        logger.info(`   Follow-up response: ${followUpResponse.message}`);
        logger.info(`   Follow-up tools: ${followUpResponse.toolCalls?.map(tc => tc.name).join(', ') || 'none'}`);
      }
      
    } catch (error) {
      logger.error(`❌ ERROR in test "${testCase.name}":`, error);
    }
  }

  logger.info(`\n=== OPENAI INTEGRATION TEST RESULTS ===`);
  logger.info(`Passed: ${passedTests}/${totalTests}`);
  logger.info(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    logger.info('🎉 All OpenAI integration tests passed!');
  } else {
    logger.warn('⚠️  Some OpenAI integration tests failed.');
  }
  
  return passedTests === totalTests;
}

async function testRuleBasedOnly() {
  logger.info('Testing rule-based routing only...');
  
  const masterAgent = new MasterAgent(); // No OpenAI config
  
  const testInput = 'send an email to john asking about the meeting';
  const sessionId = `rule-test-${Date.now()}`;
  
  const response = await masterAgent.processUserInput(testInput, sessionId);
  
  logger.info(`Rule-based response: ${response.message}`);
  logger.info(`Rule-based tools: ${response.toolCalls?.map(tc => tc.name).join(', ') || 'none'}`);
  
  return response.toolCalls && response.toolCalls.length > 0;
}

// Health check for OpenAI service
async function healthCheckOpenAI() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    logger.warn('No OpenAI API key for health check');
    return false;
  }

  try {
    const { OpenAIService } = await import('./services/openai.service');
    const openaiService = new OpenAIService({ apiKey: openaiApiKey });
    
    const isHealthy = await openaiService.healthCheck();
    logger.info(`OpenAI health check: ${isHealthy ? '✅ HEALTHY' : '❌ FAILED'}`);
    return isHealthy;
  } catch (error) {
    logger.error('OpenAI health check error:', error);
    return false;
  }
}

// Run comprehensive test
async function runComprehensiveTest() {
  logger.info('🚀 Starting comprehensive master agent test...');
  
  // 1. Health check
  logger.info('\n1. OpenAI Health Check...');
  const isOpenAIHealthy = await healthCheckOpenAI();
  
  // 2. Integration test
  logger.info('\n2. Running Integration Tests...');
  const integrationSuccess = await testOpenAIIntegration();
  
  // 3. Summary
  logger.info('\n=== COMPREHENSIVE TEST SUMMARY ===');
  logger.info(`OpenAI Health: ${isOpenAIHealthy ? '✅' : '❌'}`);
  logger.info(`Integration Tests: ${integrationSuccess ? '✅' : '❌'}`);
  
  const overallSuccess = integrationSuccess; // Health check is optional
  logger.info(`Overall Result: ${overallSuccess ? '🎉 SUCCESS' : '❌ FAILED'}`);
  
  return overallSuccess;
}

// Run the test if this file is executed directly
if (require.main === module) {
  runComprehensiveTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testOpenAIIntegration, runComprehensiveTest };