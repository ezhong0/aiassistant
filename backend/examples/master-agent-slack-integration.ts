/**
 * Example: Master Agent calling SlackAgent to read Slack DMs
 * 
 * This demonstrates how the Master Agent can use the SlackAgent
 * to read Slack message history, including DMs.
 */

import { MasterAgent } from '../src/agents/master.agent';
import { ToolExecutorService } from '../src/services/tool-executor.service';
import { SlackAgent } from '../src/agents/slack.agent';
import { initializeAllCoreServices } from '../src/services/service-initialization';
import { serviceManager } from '../src/services/service-manager';

/**
 * Example 1: Master Agent reading Slack DMs through SlackAgent
 */
export async function masterAgentReadSlackDMs() {
  try {
    // Initialize all services (including SlackMessageReaderService)
    await initializeAllCoreServices();

    // Create Master Agent
    const masterAgent = new MasterAgent({
      openaiApiKey: process.env.OPENAI_API_KEY || 'your-openai-key'
    });

    // Get ToolExecutorService
    const toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    if (!toolExecutorService) {
      throw new Error('ToolExecutorService not available');
    }

    // Example user input requesting to read Slack DMs
    const userInput = "Read my recent Slack DMs with John about the project update";
    
    console.log('User Input:', userInput);
    console.log('Processing with Master Agent...\n');

    // Master Agent processes the input and determines tool calls
    const masterResponse = await masterAgent.processUserInput(
      userInput,
      'session-123',
      'user-456'
    );

    console.log('Master Agent Response:');
    console.log('- Message:', masterResponse.message);
    console.log('- Tool Calls:', masterResponse.toolCalls?.map(tc => tc.name));
    console.log('- Needs Thinking:', masterResponse.needsThinking);
    console.log();

    // Execute the tool calls through ToolExecutorService
    if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
      console.log('Executing tool calls...\n');

      for (const toolCall of masterResponse.toolCalls) {
        console.log(`Executing tool: ${toolCall.name}`);
        console.log('Parameters:', JSON.stringify(toolCall.parameters, null, 2));

        try {
          const result = await toolExecutorService.executeWithConfirmation(
            toolCall,
            {
              sessionId: 'session-123',
              userId: 'user-456',
              timestamp: new Date(),
              slackContext: {
                userId: 'user-456',
                channelId: 'D123456789', // DM channel ID
                teamId: 'T123456789',
                isDirectMessage: true
              }
            }
          );

          console.log('Tool Result:', JSON.stringify(result, null, 2));
          console.log('---\n');

        } catch (error) {
          console.error(`Error executing tool ${toolCall.name}:`, error);
        }
      }
    }

  } catch (error) {
    console.error('Error in masterAgentReadSlackDMs:', error);
  }
}

/**
 * Example 2: Direct SlackAgent usage for reading DMs
 */
export async function directSlackAgentReadDMs() {
  try {
    // Initialize services
    await initializeAllCoreServices();

    // Create SlackAgent directly
    const slackAgent = new SlackAgent();

    // Example DM channel ID (you would get this from Slack API)
    const dmChannelId = 'D123456789';

    console.log('Reading Slack DMs directly with SlackAgent...\n');

    // Execute SlackAgent to read DMs
    const result = await slackAgent.executeWithAIPlanning({
      query: 'Read recent messages from this DM channel',
      channelId: dmChannelId,
      limit: 10,
      includeReactions: true,
      includeAttachments: true,
      accessToken: 'slack-bot-token' // This would come from OAuth
    }, {
      sessionId: 'session-123',
      userId: 'user-456',
      timestamp: new Date(),
      slackContext: {
        userId: 'user-456',
        channelId: dmChannelId,
        teamId: 'T123456789',
        isDirectMessage: true
      }
    });

    console.log('SlackAgent Result:');
    console.log('- Operation:', result.operation);
    console.log('- Total Messages:', result.totalCount);
    console.log('- Messages:', result.messages.map(msg => ({
      id: msg.id,
      text: msg.text.substring(0, 100) + '...',
      userId: msg.userId,
      timestamp: msg.timestamp,
      isBot: msg.isBot
    })));

  } catch (error) {
    console.error('Error in directSlackAgentReadDMs:', error);
  }
}

/**
 * Example 3: Master Agent with different Slack queries
 */
export async function masterAgentSlackQueries() {
  const queries = [
    "Show me messages from the #general channel about the meeting",
    "Read my DM conversation with Sarah from yesterday",
    "Search for messages containing 'deadline' in the project channel",
    "Get the latest messages from the #announcements channel",
    "Show me thread messages about the bug report"
  ];

  try {
    await initializeAllCoreServices();

    const masterAgent = new MasterAgent({
      openaiApiKey: process.env.OPENAI_API_KEY || 'your-openai-key'
    });

    const toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
    if (!toolExecutorService) {
      throw new Error('ToolExecutorService not available');
    }

    for (const query of queries) {
      console.log(`\n=== Processing Query: "${query}" ===`);

      const masterResponse = await masterAgent.processUserInput(
        query,
        `session-${Date.now()}`,
        'user-456'
      );

      console.log('Master Agent determined tool calls:', 
        masterResponse.toolCalls?.map(tc => tc.name));

      // Check if SlackAgent was called
      const slackToolCall = masterResponse.toolCalls?.find(tc => 
        tc.name === 'slackAgent' || tc.name === 'slack_operations'
      );

      if (slackToolCall) {
        console.log('✅ Master Agent will use SlackAgent to read Slack messages');
        console.log('SlackAgent parameters:', JSON.stringify(slackToolCall.parameters, null, 2));
      } else {
        console.log('❌ Master Agent did not determine Slack reading is needed');
      }
    }

  } catch (error) {
    console.error('Error in masterAgentSlackQueries:', error);
  }
}

/**
 * Example 4: Check if SlackMessageReaderService is available
 */
export async function checkSlackMessageReaderAvailability() {
  try {
    await initializeAllCoreServices();

    const slackMessageReaderService = serviceManager.getService('slackMessageReaderService');
    
    if (slackMessageReaderService) {
      console.log('✅ SlackMessageReaderService is available');
      
      const health = slackMessageReaderService.getHealth();
      console.log('Service Health:', JSON.stringify(health, null, 2));
      
      console.log('\nCapabilities:');
      console.log('- Read message history from channels and DMs');
      console.log('- Read thread messages');
      console.log('- Search messages across channels');
      console.log('- Rate limiting and privacy controls');
      console.log('- Message filtering and sensitive content redaction');
      
    } else {
      console.log('❌ SlackMessageReaderService is not available');
      console.log('This usually means Slack is not configured in the environment');
    }

  } catch (error) {
    console.error('Error checking SlackMessageReaderService:', error);
  }
}

/**
 * Example 5: Complete workflow - Master Agent → SlackAgent → SlackMessageReaderService
 */
export async function completeSlackWorkflow() {
  console.log('=== Complete Slack Workflow Demo ===\n');

  try {
    // Step 1: Initialize all services
    console.log('1. Initializing services...');
    await initializeAllCoreServices();
    console.log('✅ All services initialized\n');

    // Step 2: Check SlackMessageReaderService availability
    console.log('2. Checking SlackMessageReaderService...');
    const slackMessageReaderService = serviceManager.getService('slackMessageReaderService');
    if (!slackMessageReaderService) {
      console.log('❌ SlackMessageReaderService not available - Slack not configured');
      return;
    }
    console.log('✅ SlackMessageReaderService available\n');

    // Step 3: Create Master Agent
    console.log('3. Creating Master Agent...');
    const masterAgent = new MasterAgent({
      openaiApiKey: process.env.OPENAI_API_KEY || 'your-openai-key'
    });
    console.log('✅ Master Agent created\n');

    // Step 4: Process user request
    console.log('4. Processing user request...');
    const userRequest = "Read my recent Slack messages about the project";
    const masterResponse = await masterAgent.processUserInput(
      userRequest,
      'session-workflow',
      'user-workflow'
    );
    
    console.log('Master Agent Response:');
    console.log('- Message:', masterResponse.message);
    console.log('- Tool Calls:', masterResponse.toolCalls?.map(tc => tc.name));
    console.log();

    // Step 5: Execute tool calls
    if (masterResponse.toolCalls && masterResponse.toolCalls.length > 0) {
      console.log('5. Executing tool calls...');
      
      const toolExecutorService = serviceManager.getService('toolExecutorService') as ToolExecutorService;
      
      for (const toolCall of masterResponse.toolCalls) {
        console.log(`Executing: ${toolCall.name}`);
        
        try {
          const result = await toolExecutorService.executeWithConfirmation(
            toolCall,
            {
              sessionId: 'session-workflow',
              userId: 'user-workflow',
              timestamp: new Date(),
              slackContext: {
                userId: 'user-workflow',
                channelId: 'C123456789', // Example channel
                teamId: 'T123456789',
                isDirectMessage: false
              }
            }
          );

          console.log('✅ Tool executed successfully');
          console.log('Result:', JSON.stringify(result, null, 2));
          
        } catch (error) {
          console.log('❌ Tool execution failed:', error);
        }
      }
    }

    console.log('\n=== Workflow Complete ===');

  } catch (error) {
    console.error('Error in complete workflow:', error);
  }
}

// Export all examples
export const slackExamples = {
  masterAgentReadSlackDMs,
  directSlackAgentReadDMs,
  masterAgentSlackQueries,
  checkSlackMessageReaderAvailability,
  completeSlackWorkflow
};

// Run a specific example if this file is executed directly
if (require.main === module) {
  const exampleName = process.argv[2] || 'checkSlackMessageReaderAvailability';
  
  if (exampleName in slackExamples) {
    console.log(`Running Slack example: ${exampleName}`);
    slackExamples[exampleName as keyof typeof slackExamples]().catch(console.error);
  } else {
    console.log('Available Slack examples:');
    Object.keys(slackExamples).forEach(name => {
      console.log(`  - ${name}`);
    });
  }
}
