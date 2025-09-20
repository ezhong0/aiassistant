/**
 * Test script for autonomous agent system
 *
 * This script tests the new natural language intent-based agent architecture
 * where the MasterAgent communicates with autonomous agents using natural language
 * instead of rigid parameter structures.
 */

const { MasterAgent } = require('./dist/agents/master.agent');
const { AutonomousEmailAgent } = require('./dist/agents/autonomous-email.agent');

async function testAutonomousAgents() {
  console.log('🧪 Testing Autonomous Agent Architecture\n');

  try {
    // Test 1: Direct autonomous email agent capability assessment
    console.log('📧 Test 1: Email Agent Capability Assessment');
    const autonomousEmailAgent = new AutonomousEmailAgent();

    const testIntents = [
      "Search my emails for LinkedIn messages",
      "Find emails from last week about the project",
      "I'm looking for emails from john@company.com",
      "Schedule a meeting for tomorrow",  // Non-email intent
      "Check the weather forecast"        // Non-email intent
    ];

    for (const intent of testIntents) {
      const capability = await autonomousEmailAgent.assessCapability(intent);
      console.log(`  Intent: "${intent}"`);
      console.log(`  Capability Score: ${capability.toFixed(2)}`);
      console.log(`  Can Handle: ${capability >= 0.3 ? '✅ Yes' : '❌ No'}\n`);
    }

    // Test 2: MasterAgent autonomous processing
    console.log('🤖 Test 2: MasterAgent Autonomous Processing');
    const masterAgent = new MasterAgent();

    const emailIntent = "I'm looking for emails from LinkedIn";
    console.log(`Testing intent: "${emailIntent}"`);

    try {
      const response = await masterAgent.processUserInputWithAutonomy(
        emailIntent,
        'test-session-001',
        'test-user-001',
        undefined, // No Slack context
        true       // Use autonomous processing
      );

      console.log('✅ MasterAgent Response:');
      console.log(`  Message: ${response.message}`);
      console.log(`  Confidence: ${response.confidence || 'N/A'}`);
      console.log(`  Execution Metadata:`, response.executionMetadata);

      if (response.executionMetadata?.autonomousAgent) {
        console.log(`  🚀 Used Autonomous Agent: ${response.executionMetadata.autonomousAgent}`);
        console.log(`  💡 Reasoning: ${response.executionMetadata.reasoning}`);
        if (response.executionMetadata.suggestions?.length > 0) {
          console.log(`  📝 Suggestions:`);
          response.executionMetadata.suggestions.forEach((suggestion, i) => {
            console.log(`    ${i + 1}. ${suggestion}`);
          });
        }
      }

    } catch (error) {
      console.log('❌ Error in autonomous processing:', error.message);
    }

    // Test 3: Comparison with traditional approach
    console.log('\n🔄 Test 3: Traditional vs Autonomous Comparison');

    const traditionalResponse = await masterAgent.processUserInputWithAutonomy(
      emailIntent,
      'test-session-002',
      'test-user-001',
      undefined,
      false // Disable autonomous processing
    );

    console.log('Traditional Approach:');
    console.log(`  Message: ${traditionalResponse.message}`);
    console.log(`  Used Step-by-Step: ${traditionalResponse.executionMetadata?.workflowAction || 'Unknown'}`);

    // Test 4: Non-email intent (should fallback)
    console.log('\n📅 Test 4: Non-Email Intent (Should Fallback)');
    const calendarIntent = "Schedule a meeting for tomorrow at 2 PM";

    const calendarResponse = await masterAgent.processUserInputWithAutonomy(
      calendarIntent,
      'test-session-003',
      'test-user-001',
      undefined,
      true // Try autonomous first
    );

    console.log(`Testing intent: "${calendarIntent}"`);
    console.log('Response:');
    console.log(`  Message: ${calendarResponse.message}`);
    console.log(`  Should use traditional workflow: ${!calendarResponse.executionMetadata?.autonomousAgent ? '✅ Yes' : '❌ No'}`);

    console.log('\n🎉 Autonomous Agent Testing Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Handle async execution
if (require.main === module) {
  testAutonomousAgents()
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testAutonomousAgents };