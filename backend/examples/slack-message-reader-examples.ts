/**
 * SlackMessageReaderService Usage Examples
 * 
 * This file demonstrates how to use the SlackMessageReaderService
 * for reading Slack message history with proper error handling and filtering.
 */

import { SlackMessageReaderError, SlackMessageReaderErrorCode } from '../src/types/slack-message-reader.types';
import { serviceManager } from '../src/services/service-manager';

/**
 * Example 1: Basic message history reading
 */
export async function readBasicMessageHistory() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    // Initialize the service
    await service.initialize();

    // Read recent messages from a channel
    const messages = await service.readMessageHistory('C123456789', {
      limit: 20
    });

    console.log(`Found ${messages.length} messages`);
    messages.forEach(msg => {
      console.log(`[${msg.timestamp.toISOString()}] ${msg.userId}: ${msg.text}`);
    });

  } catch (error) {
    if (error instanceof SlackMessageReaderError) {
      console.error(`Slack error (${error.code}): ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await service.destroy();
  }
}

/**
 * Example 2: Reading messages with filtering
 */
export async function readFilteredMessages() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    await service.initialize();

    // Read messages with filtering options
    const messages = await service.readMessageHistory('C123456789', {
      limit: 50,
      filter: {
        excludeBotMessages: true,
        excludeSystemMessages: true,
        excludeKeywords: ['spam', 'test'],
        userIds: ['U123456789'], // Only messages from specific user
        dateAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    });

    console.log(`Found ${messages.length} filtered messages`);
    
    // Process messages
    messages.forEach(msg => {
      console.log(`User: ${msg.userId}`);
      console.log(`Text: ${msg.text}`);
      console.log(`Timestamp: ${msg.timestamp.toISOString()}`);
      console.log(`Attachments: ${msg.attachments.length}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error reading filtered messages:', error);
  } finally {
    await service.destroy();
  }
}

/**
 * Example 3: Reading thread messages
 */
export async function readThreadMessages() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    await service.initialize();

    // Read messages from a specific thread
    const threadTs = '1234567890.123456'; // Thread timestamp
    const messages = await service.readThreadMessages('C123456789', threadTs, {
      limit: 100
    });

    console.log(`Found ${messages.length} thread messages`);
    
    // Separate original message from replies
    const originalMessage = messages.find(msg => msg.id === threadTs);
    const replies = messages.filter(msg => msg.isThreadReply);

    if (originalMessage) {
      console.log('Original message:', originalMessage.text);
    }
    
    console.log(`Replies: ${replies.length}`);
    replies.forEach(reply => {
      console.log(`Reply from ${reply.userId}: ${reply.text}`);
    });

  } catch (error) {
    console.error('Error reading thread messages:', error);
  } finally {
    await service.destroy();
  }
}

/**
 * Example 4: Searching messages
 */
export async function searchMessages() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    await service.initialize();

    // Search for messages containing specific keywords
    const searchResults = await service.searchMessages('project update', {
      channels: ['C123456789', 'C987654321'], // Search in specific channels
      limit: 30,
      sort: 'timestamp',
      sortDir: 'desc'
    });

    console.log(`Found ${searchResults.length} search results`);
    
    searchResults.forEach(result => {
      console.log(`Channel: ${result.channelId}`);
      console.log(`User: ${result.userId}`);
      console.log(`Text: ${result.text}`);
      console.log(`Timestamp: ${result.timestamp.toISOString()}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error searching messages:', error);
  } finally {
    await service.destroy();
  }
}

/**
 * Example 5: Getting channel information
 */
export async function getChannelInfo() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    await service.initialize();

    // Get information about a channel
    const channelInfo = await service.getChannelInfo('C123456789');
    
    console.log('Channel Information:');
    console.log(`ID: ${channelInfo.id}`);
    console.log(`Name: ${channelInfo.name}`);
    console.log(`Type: ${channelInfo.type}`);
    console.log(`Private: ${channelInfo.isPrivate}`);
    console.log(`Members: ${channelInfo.memberCount || 'Unknown'}`);
    console.log(`Topic: ${channelInfo.topic || 'No topic'}`);
    console.log(`Purpose: ${channelInfo.purpose || 'No purpose'}`);

  } catch (error) {
    if (error instanceof SlackMessageReaderError) {
      if (error.code === SlackMessageReaderErrorCode.NOT_FOUND) {
        console.error('Channel not found or not accessible');
      } else {
        console.error(`Slack error: ${error.message}`);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await service.destroy();
  }
}

/**
 * Example 6: Using with service manager
 */
export async function useWithServiceManager() {
  try {
    // Initialize all core services (including SlackMessageReaderService if configured)
    const { initializeAllCoreServices } = await import('../src/services/service-initialization');
    await initializeAllCoreServices();

    // Get the service from service manager
    const service = serviceManager.getService('slackMessageReaderService') as any; // SlackMessageReaderService;
    
    if (!service) {
      console.log('SlackMessageReaderService not available (Slack not configured)');
      return;
    }

    // Check service health
    const health = service.getHealth();
    console.log('Service health:', health);

    if (health.healthy) {
      // Use the service
      const messages = await service.readRecentMessages('C123456789', 10);
      console.log(`Read ${messages.length} recent messages`);
    }

  } catch (error) {
    console.error('Error using service manager:', error);
  }
}

/**
 * Example 7: Error handling patterns
 */
export async function handleErrors() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    await service.initialize();

    // This will likely fail with an invalid channel
    await service.readMessageHistory('invalid-channel-id');

  } catch (error) {
    if (error instanceof SlackMessageReaderError) {
      switch (error.code) {
        case SlackMessageReaderErrorCode.AUTHENTICATION_FAILED:
          console.error('Authentication failed - check bot token');
          break;
        case SlackMessageReaderErrorCode.NOT_FOUND:
          console.error('Channel not found or not accessible');
          break;
        case SlackMessageReaderErrorCode.PERMISSION_DENIED:
          console.error('Insufficient permissions to read channel');
          break;
        case SlackMessageReaderErrorCode.RATE_LIMIT_EXCEEDED:
          console.error('Rate limit exceeded - wait before retrying');
          break;
        default:
          console.error(`Slack error: ${error.message}`);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await service.destroy();
  }
}

/**
 * Example 8: Monitoring and health checks
 */
export async function monitorService() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'your-bot-token';
  const service = new (class MockSlackMessageReaderService {
    constructor(token: string) {
      this.name = 'SlackMessageReaderService';
    }
    name: string;
    async readRecentMessages() { return []; }
    async readThreadMessages() { return []; }
    async searchMessages() { return []; }
  })(botToken);

  try {
    await service.initialize();

    // Check service health
    const health = service.getHealth();
    console.log('Service Health:', JSON.stringify(health, null, 2));

    // Monitor rate limits
    if (health.details?.rateLimits) {
      const { minute, hour, config } = health.details.rateLimits;
      console.log(`Rate Limits - Minute: ${minute.count}/${config.maxRequestsPerMinute}`);
      console.log(`Rate Limits - Hour: ${hour.count}/${config.maxRequestsPerHour}`);
    }

    // Check dependencies
    if (health.details?.dependencies) {
      console.log('Dependencies:');
      console.log(`Cache Service: ${health.details.dependencies.cacheService ? 'Available' : 'Not Available'}`);
      console.log(`Database Service: ${health.details.dependencies.databaseService ? 'Available' : 'Not Available'}`);
    }

  } catch (error) {
    console.error('Error monitoring service:', error);
  } finally {
    await service.destroy();
  }
}

// Export all examples for use in other files
export const examples = {
  readBasicMessageHistory,
  readFilteredMessages,
  readThreadMessages,
  searchMessages,
  getChannelInfo,
  useWithServiceManager,
  handleErrors,
  monitorService
};

// Run a specific example if this file is executed directly
if (require.main === module) {
  const exampleName = process.argv[2] || 'readBasicMessageHistory';
  
  if (exampleName in examples) {
    console.log(`Running example: ${exampleName}`);
    examples[exampleName as keyof typeof examples]().catch(console.error);
  } else {
    console.log('Available examples:');
    Object.keys(examples).forEach(name => {
      console.log(`  - ${name}`);
    });
  }
}
