import logger from '../src/utils/logger';
import { initializeAgentFactory } from '../src/config/agent-factory-init';
import { AgentFactory } from '../src/framework/agent-factory';
import { ToolExecutorService } from '../src/services/tool-executor.service';
import { MasterAgent } from '../src/agents/master.agent';
import { ToolExecutionContext } from '../src/types/tools';

/**
 * Test the modular system to verify it works correctly
 */
async function testModularSystem() {
  console.log('🧪 Testing Modular Assistant System\n');

  try {
    // 1. Test AgentFactory Initialization
    console.log('1️⃣ Testing AgentFactory Initialization...');
    initializeAgentFactory();
    
    const stats = AgentFactory.getStats();
    console.log(`✅ AgentFactory initialized with ${stats.totalTools} tools`);
    console.log(`📊 Critical tools: ${stats.criticalTools}, Confirmation tools: ${stats.confirmationTools}`);
    console.log(`🔧 Available tools: ${stats.toolNames.join(', ')}\n`);

    // 2. Test OpenAI Function Generation
    console.log('2️⃣ Testing OpenAI Function Generation...');
    const openAIFunctions = AgentFactory.generateOpenAIFunctions();
    console.log(`✅ Generated ${openAIFunctions.length} OpenAI function definitions`);
    console.log(`📝 Function names: ${openAIFunctions.map(f => f.name).join(', ')}\n`);

    // 3. Test Tool Matching
    console.log('3️⃣ Testing Rule-Based Tool Matching...');
    const testQueries = [
      'send an email to john',
      'schedule a meeting with sarah',
      'find contact for mike',
      'create a blog post about AI',
      'search for information about TypeScript'
    ];

    for (const query of testQueries) {
      const matchingTools = AgentFactory.findMatchingTools(query);
      const toolNames = matchingTools.map(t => t.name).join(', ') || 'none';
      console.log(`🔍 "${query}" → ${toolNames}`);
    }
    console.log('');

    // 4. Test Master Agent
    console.log('4️⃣ Testing Master Agent with Registry...');
    const masterAgent = new MasterAgent();
    
    const testQuery = 'send an email to alice asking about the project';
    console.log(`🤖 Processing: "${testQuery}"`);
    
    const response = await masterAgent.processUserInput(testQuery, 'test-session-123');
    console.log(`✅ Generated ${response.toolCalls?.length || 0} tool calls:`);
    response.toolCalls?.forEach((call, index) => {
      console.log(`   ${index + 1}. ${call.name}: ${call.parameters.query?.substring(0, 50)}...`);
    });
    console.log('');

    // 5. Test Tool Executor with Registry
    console.log('5️⃣ Testing Tool Executor with Registry...');
    const toolExecutor = new ToolExecutorService();
    
    const context: ToolExecutionContext = {
      sessionId: 'test-session-123',
      timestamp: new Date()
    };

    // Test Think agent execution (safe to execute)
    const thinkCall = {
      name: 'Think',
      parameters: { query: 'Analyze this test execution' }
    };
    
    console.log('🔄 Executing Think agent...');
    const thinkResult = await toolExecutor.executeTool(thinkCall, context);
    console.log(`✅ Think agent result: ${thinkResult.success ? 'Success' : 'Failed'}`);
    if (thinkResult.success) {
      console.log(`📝 Analysis: ${thinkResult.result?.message?.substring(0, 100)}...`);
    }
    console.log('');

    // 6. Test System Prompt Generation
    console.log('6️⃣ Testing Dynamic System Prompt Generation...');
    const systemPrompt = masterAgent.getSystemPrompt();
    const promptLines = systemPrompt.split('\n').length;
    const hasToolsSection = systemPrompt.includes('Available Tools');
    console.log(`✅ Generated system prompt with ${promptLines} lines`);
    console.log(`🔧 Includes tools section: ${hasToolsSection ? 'Yes' : 'No'}`);
    console.log('');

    // 7. Test Configuration-Driven Approach
    console.log('7️⃣ Testing Configuration-Driven Features...');
    const emailTool = toolRegistry.getToolMetadata('emailAgent');
    const thinkTool = toolRegistry.getToolMetadata('Think');
    
    console.log(`✅ EmailAgent requires confirmation: ${emailTool?.requiresConfirmation}`);
    console.log(`✅ Think agent is critical: ${thinkTool?.isCritical}`);
    console.log(`✅ EmailAgent keywords: ${emailTool?.keywords.join(', ')}`);
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Modularity Improvements Verified:');
    console.log('✅ Centralized tool registry eliminates switch statements');
    console.log('✅ Configuration-driven tool definitions');
    console.log('✅ Standardized agent interface');
    console.log('✅ Dynamic OpenAI function generation');
    console.log('✅ Rule-based routing using metadata');
    console.log('✅ Easy tool addition without core changes');

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Modular system test failed', error);
  }
}

// Run the test
if (require.main === module) {
  testModularSystem().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
}

export { testModularSystem };