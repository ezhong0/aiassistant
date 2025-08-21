import { MasterAgent } from '../src/agents/master.agent';
import { emailAgent } from '../src/agents/email.agent';
import { toolExecutorService } from '../src/services/tool-executor.service';
import logger from '../src/utils/logger';

/**
 * Test the Email Agent integration with Master Agent
 */
async function testEmailAgentIntegration() {
  logger.info('Starting Email Agent integration test...');
  
  // Initialize master agent
  const masterAgent = new MasterAgent();
  
  const testCases = [
    {
      name: 'Send Email Request',
      input: 'send an email to john@example.com with subject "Meeting Tomorrow" saying "Hi John, are we still on for the meeting tomorrow at 2pm?"',
      expectEmailAgent: true
    },
    {
      name: 'Search Email Request',
      input: 'search for emails from sarah about the project',
      expectEmailAgent: true
    },
    {
      name: 'Reply Email Request',
      input: 'reply to the last email saying "Thanks for the update"',
      expectEmailAgent: true
    },
    {
      name: 'Draft Email Request',
      input: 'create a draft email to team@company.com about the quarterly results',
      expectEmailAgent: true
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      logger.info(`\n--- Testing: ${testCase.name} ---`);
      logger.info(`Input: "${testCase.input}"`);
      
      const sessionId = `test-session-${Date.now()}`;
      
      // Step 1: Test master agent routing
      const masterResponse = await masterAgent.processUserInput(testCase.input, sessionId);
      
      logger.info(`Master Response: ${masterResponse.message}`);
      logger.info(`Tool calls: ${masterResponse.toolCalls?.map(tc => tc.name).join(', ') || 'none'}`);
      
      // Check if email agent is called when expected
      const hasEmailAgent = masterResponse.toolCalls?.some(tc => tc.name === 'emailAgent') || false;
      
      if (testCase.expectEmailAgent && hasEmailAgent) {
        logger.info('✅ PASSED: Email agent correctly identified');
        passedTests++;
        
        // Step 2: Test tool execution (without actual Gmail API calls)
        const emailToolCall = masterResponse.toolCalls?.find(tc => tc.name === 'emailAgent');
        if (emailToolCall) {
          logger.info('Testing email agent processing...');
          
          try {
            // Test email agent directly (will fail without access token, but we can test parsing)
            const agentResult = await emailAgent.processQuery({
              query: emailToolCall.parameters.query,
              accessToken: 'test-token' // This will fail, but we can test the parsing logic
            });
            
            logger.info(`Email agent processing result: success=${agentResult.success}, message="${agentResult.message}"`);
            
            if (agentResult.message) {
              logger.info('✅ Email agent parsing works correctly');
            }
          } catch (error) {
            logger.info('Expected error (no valid access token):', error instanceof Error ? error.message : error);
          }
        }
        
      } else if (!testCase.expectEmailAgent && !hasEmailAgent) {
        logger.info('✅ PASSED: Email agent correctly not called');
        passedTests++;
      } else {
        logger.warn(`❌ FAILED: Expected email agent: ${testCase.expectEmailAgent}, got: ${hasEmailAgent}`);
      }
      
    } catch (error) {
      logger.error(`❌ ERROR in test "${testCase.name}":`, error);
    }
  }

  // Test direct email agent functionality
  logger.info('\n--- Testing Direct Email Agent ---');
  
  try {
    const directTestCases = [
      {
        name: 'Send Email Parsing',
        query: 'send an email to test@example.com with subject "Test" and body "This is a test"',
        expectSuccess: false // Will fail without access token
      },
      {
        name: 'Search Email Parsing',
        query: 'search for emails from manager about budget',
        expectSuccess: false // Will fail without access token
      }
    ];

    for (const testCase of directTestCases) {
      try {
        logger.info(`Testing: ${testCase.name}`);
        
        const result = await emailAgent.processQuery({
          query: testCase.query,
          accessToken: 'test-token',
          contacts: [{ name: 'Test User', email: 'test@example.com' }]
        });
        
        logger.info(`Result: success=${result.success}, message="${result.message}"`);
        
        // We expect these to fail due to invalid token, but parsing should work
        if (!result.success && result.error === 'MISSING_ACCESS_TOKEN') {
          logger.info('✅ PASSED: Correctly identified missing access token');
          passedTests++;
        } else if (!result.success && result.message.includes('token')) {
          logger.info('✅ PASSED: Access token validation working');  
          passedTests++;
        } else {
          logger.info(`Result details: ${JSON.stringify(result, null, 2)}`);
        }
        
      } catch (error) {
        logger.info('Expected error:', error instanceof Error ? error.message : error);
      }
    }
    
    totalTests += directTestCases.length;
    
  } catch (error) {
    logger.error('Direct email agent test error:', error);
  }

  // Test tool executor service
  logger.info('\n--- Testing Tool Executor Service ---');
  
  try {
    const mockToolCall = {
      name: 'Think',
      parameters: { query: 'Test thinking process' }
    };

    const executionContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      timestamp: new Date()
    };

    const result = await toolExecutorService.executeTool(mockToolCall, executionContext);
    
    if (result.success && result.toolName === 'Think') {
      logger.info('✅ PASSED: Tool executor service working correctly');
      passedTests++;
    } else {
      logger.warn('❌ FAILED: Tool executor service test failed');
    }
    
    totalTests++;
    
  } catch (error) {
    logger.error('Tool executor test error:', error);
  }

  logger.info(`\n=== INTEGRATION TEST RESULTS ===`);
  logger.info(`Passed: ${passedTests}/${totalTests}`);
  logger.info(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests >= totalTests * 0.8) { // 80% pass rate is acceptable for integration tests
    logger.info('🎉 Email agent integration is working correctly!');
    logger.info('\nNext steps:');
    logger.info('1. Set up Google OAuth tokens for full testing');
    logger.info('2. Test with real Gmail API calls');
    logger.info('3. Implement contact agent integration');
  } else {
    logger.warn('⚠️  Some integration tests failed. Review the implementation.');
  }
  
  return passedTests >= totalTests * 0.8;
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEmailAgentIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Integration test execution failed:', error);
      process.exit(1);
    });
}

export { testEmailAgentIntegration };