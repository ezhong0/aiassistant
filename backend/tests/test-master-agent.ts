import { MasterAgent } from '../src/agents/master.agent';
import logger from '../src/utils/logger';

// Simple test function to verify the master agent
async function testMasterAgent() {
  logger.info('Starting MasterAgent test...');
  
  // Initialize master agent without OpenAI (rule-based routing only)
  const masterAgent = new MasterAgent();
  
  const testCases = [
    {
      name: 'Email with contact lookup',
      input: 'send an email to nate herkelman asking him what time he wants to leave',
      expected: ['contactAgent', 'emailAgent', 'Think']
    },
    {
      name: 'Calendar event',
      input: 'schedule a meeting with john tomorrow at 3pm',
      expected: ['contactAgent', 'calendarAgent', 'Think']
    },
    {
      name: 'Contact lookup',
      input: 'find contact information for sarah',
      expected: ['contactAgent', 'Think']
    },
    {
      name: 'Content creation',
      input: 'create a blog post about AI',
      expected: ['contentCreator', 'Think']
    },
    {
      name: 'Web search',
      input: 'search for the latest news about climate change',
      expected: ['Tavily', 'Think']
    },
    {
      name: 'Unclear request',
      input: 'help me with something',
      expected: ['Think']
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      logger.info(`\n--- Testing: ${testCase.name} ---`);
      logger.info(`Input: "${testCase.input}"`);
      
      const sessionId = `test-session-${Date.now()}`;
      const response = await masterAgent.processUserInput(testCase.input, sessionId);
      
      logger.info(`Response: ${response.message}`);
      logger.info(`Tool calls: ${response.toolCalls?.map(tc => tc.name).join(', ') || 'none'}`);
      
      // Check if expected tools are present
      const actualTools = response.toolCalls?.map(tc => tc.name) || [];
      const hasExpectedTools = testCase.expected.every(expectedTool => 
        actualTools.includes(expectedTool)
      );
      
      if (hasExpectedTools) {
        logger.info(`✅ PASSED: All expected tools called`);
        passedTests++;
      } else {
        logger.warn(`❌ FAILED: Expected ${testCase.expected.join(', ')}, got ${actualTools.join(', ')}`);
      }
      
    } catch (error) {
      logger.error(`❌ ERROR in test "${testCase.name}":`, error);
    }
  }

  logger.info(`\n=== TEST RESULTS ===`);
  logger.info(`Passed: ${passedTests}/${totalTests}`);
  logger.info(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    logger.info('🎉 All tests passed! Master agent is working correctly.');
  } else {
    logger.warn('⚠️  Some tests failed. Check the routing logic.');
  }
  
  return passedTests === totalTests;
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMasterAgent()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testMasterAgent };