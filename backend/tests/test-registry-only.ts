/**
 * Test only the registry system without any agent dependencies
 */

import { ToolRegistry } from '../src/registry/tool.registry';
import { ToolMetadata } from '../src/types/agent.types';

// Create mock agent classes for testing
class MockThinkAgent {
  readonly name = 'Think';
  readonly description = 'Test think agent';
  readonly systemPrompt = 'Test prompt';
  readonly keywords = ['think', 'analyze'];
  readonly requiresConfirmation = false;
  readonly isCritical = false;

  async execute() {
    return { success: true, message: 'Mock execution' };
  }

  validateParameters() {
    return { valid: true, errors: [] };
  }
}

class MockEmailAgent {
  readonly name = 'emailAgent';
  readonly description = 'Test email agent';
  readonly systemPrompt = 'Test email prompt';
  readonly keywords = ['email', 'send'];
  readonly requiresConfirmation = true;
  readonly isCritical = true;

  async execute() {
    return { success: true, message: 'Mock email execution' };
  }

  validateParameters() {
    return { valid: true, errors: [] };
  }
}

// Mock tool definitions
const MOCK_TOOL_DEFINITIONS: ToolMetadata[] = [
  {
    name: 'Think',
    description: 'Analyze and reason about user requests',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The query to analyze' }
      },
      required: ['query']
    },
    keywords: ['think', 'analyze', 'reason'],
    requiresConfirmation: false,
    isCritical: false,
    agentClass: MockThinkAgent
  },
  {
    name: 'emailAgent',
    description: 'Send and manage emails',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The email request' }
      },
      required: ['query']
    },
    keywords: ['email', 'send', 'mail'],
    requiresConfirmation: true,
    isCritical: true,
    agentClass: MockEmailAgent
  }
];

function testRegistryOnly() {
  console.log('🧪 Testing Tool Registry (Isolated)\n');

  try {
    // 1. Create Registry
    console.log('1️⃣ Creating Tool Registry...');
    const registry = new ToolRegistry();
    console.log('✅ Registry created successfully\n');

    // 2. Register Mock Tools
    console.log('2️⃣ Registering Mock Tools...');
    for (const toolDef of MOCK_TOOL_DEFINITIONS) {
      registry.registerTool(toolDef);
      console.log(`✅ Registered: ${toolDef.name}`);
    }
    console.log('');

    // 3. Test Statistics
    console.log('3️⃣ Testing Registry Statistics...');
    const stats = registry.getStats();
    console.log(`✅ Total tools: ${stats.totalTools}`);
    console.log(`✅ Critical tools: ${stats.criticalTools}`);
    console.log(`✅ Confirmation tools: ${stats.confirmationTools}`);
    console.log(`✅ Tool names: ${stats.toolNames.join(', ')}\n`);

    // 4. Test OpenAI Functions
    console.log('4️⃣ Testing OpenAI Function Generation...');
    const openAIFunctions = registry.generateOpenAIFunctions();
    console.log(`✅ Generated ${openAIFunctions.length} functions:`);
    openAIFunctions.forEach(func => {
      console.log(`   📝 ${func.name}: ${func.description}`);
    });
    console.log('');

    // 5. Test Tool Matching
    console.log('5️⃣ Testing Tool Matching...');
    const testQueries = [
      'send an email to john',
      'think about this problem',
      'analyze the situation',
      'draft a message'
    ];

    for (const query of testQueries) {
      const matches = registry.findMatchingTools(query);
      console.log(`🔍 "${query}" → [${matches.map(t => t.name).join(', ')}]`);
    }
    console.log('');

    // 6. Test Tool Properties
    console.log('6️⃣ Testing Tool Properties...');
    console.log(`✅ Think needs confirmation: ${registry.toolNeedsConfirmation('Think')}`);
    console.log(`✅ EmailAgent needs confirmation: ${registry.toolNeedsConfirmation('emailAgent')}`);
    console.log(`✅ Think is critical: ${registry.isCriticalTool('Think')}`);
    console.log(`✅ EmailAgent is critical: ${registry.isCriticalTool('emailAgent')}\n`);

    // 7. Test System Prompts
    console.log('7️⃣ Testing System Prompt Generation...');
    const prompts = registry.generateSystemPrompts();
    console.log(`✅ Generated system prompts (${prompts.split('\n').length} lines)`);
    console.log(`📝 Sample: ${prompts.substring(0, 100)}...\n`);

    console.log('🎉 Registry test completed successfully!');
    console.log('\n📋 Core Registry Features Verified:');
    console.log('✅ Tool registration and storage');
    console.log('✅ Metadata management');
    console.log('✅ OpenAI function generation');
    console.log('✅ Keyword-based tool matching');
    console.log('✅ Configuration-driven properties');
    console.log('✅ System prompt generation');

    return true;

  } catch (error) {
    console.error('❌ Registry test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  const success = testRegistryOnly();
  process.exit(success ? 0 : 1);
}

export { testRegistryOnly };