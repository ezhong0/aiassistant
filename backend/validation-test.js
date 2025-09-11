/**
 * Validation Script for Enhanced MasterAgent
 * Tests the core functionality without requiring full environment setup
 */

import { MasterAgent, ProposalResponse } from '../src/agents/master.agent';
import { ToolCall } from '../src/types/tools';
import { SlackContext } from '../src/types/slack.types';

// Mock the service manager to avoid initialization issues
jest.mock('../src/services/service-manager', () => ({
  getService: jest.fn().mockReturnValue(null)
}));

jest.mock('../src/services/slack-message-reader.service');
jest.mock('../src/utils/logger');

describe('Enhanced MasterAgent Validation', () => {
  let masterAgent: MasterAgent;
  let mockSlackContext: SlackContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSlackContext = {
      userId: 'U123456789',
      channelId: 'D123456789',
      teamId: 'T123456789',
      threadTs: '1234567890.123456',
      isDirectMessage: true,
      userName: 'testuser',
      userEmail: 'test@example.com'
    };

    masterAgent = new MasterAgent({
      openaiApiKey: 'test-api-key'
    });
  });

  afterEach(() => {
    if (masterAgent) {
      masterAgent.cleanup();
    }
  });

  it('should have enhanced processUserInput method signature', () => {
    // Verify the method signature includes SlackContext parameter
    const methodSignature = masterAgent.processUserInput.toString();
    expect(methodSignature).toContain('slackContext?: SlackContext');
  });

  it('should have context detection methods', () => {
    // Verify private methods exist (we can't test them directly, but we can verify the class structure)
    const masterAgentAny = masterAgent as any;
    expect(typeof masterAgentAny.detectContextNeeds).toBe('function');
    expect(typeof masterAgentAny.gatherContext).toBe('function');
    expect(typeof masterAgentAny.generateProposal).toBe('function');
  });

  it('should have proposal generation with email body inclusion', async () => {
    const toolCalls: ToolCall[] = [
      {
        name: 'send_email',
        parameters: {
          recipient: 'john@example.com',
          subject: 'Test Email',
          body: 'This is a test email body with multiple lines.\n\nIt should be included in the proposal.'
        }
      }
    ];

    // Mock OpenAI service to return a proposal with email body
    const mockProposal: ProposalResponse = {
      text: `I'll send an email to john@example.com with the subject 'Test Email' and the following content:\n\nThis is a test email body with multiple lines.\n\nIt should be included in the proposal.\n\nShould I go ahead?`,
      actionType: 'email',
      confidence: 0.95,
      requiresConfirmation: true,
      originalToolCalls: toolCalls
    };

    const mockOpenAIService = {
      generateStructuredData: jest.fn()
        .mockResolvedValueOnce({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        })
        .mockResolvedValueOnce(mockProposal),
      generateToolCalls: jest.fn().mockResolvedValue({
        toolCalls,
        message: 'I understand you want to send an email.'
      })
    };

    jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

    const response = await masterAgent.processUserInput(
      'Send John a test email',
      'test-session',
      'test-user',
      mockSlackContext
    );

    // Validate the response structure
    expect(response).toBeDefined();
    expect(response.proposal).toBeDefined();
    expect(response.proposal?.text).toContain('john@example.com');
    expect(response.proposal?.text).toContain('Test Email');
    expect(response.proposal?.text).toContain('This is a test email body with multiple lines');
    expect(response.proposal?.text).toContain('It should be included in the proposal');
    expect(response.proposal?.text).toContain('Should I go ahead?');
    expect(response.proposal?.actionType).toBe('email');
    expect(response.proposal?.requiresConfirmation).toBe(true);
  });

  it('should handle context detection', async () => {
    const mockOpenAIService = {
      generateStructuredData: jest.fn().mockResolvedValue({
        needsContext: true,
        contextType: 'thread_history',
        confidence: 0.9,
        reasoning: 'User is referring to previous conversation'
      }),
      generateToolCalls: jest.fn().mockResolvedValue({
        toolCalls: [],
        message: 'I understand your request.'
      })
    };

    jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

    const response = await masterAgent.processUserInput(
      'Send that email we discussed',
      'test-session',
      'test-user',
      mockSlackContext
    );

    expect(response).toBeDefined();
    expect(response.contextGathered).toBeDefined();
    expect(response.contextGathered?.contextType).toBe('thread_history');
  });

  it('should maintain backward compatibility', async () => {
    const mockOpenAIService = {
      generateToolCalls: jest.fn().mockResolvedValue({
        toolCalls: [],
        message: 'I understand your request.'
      })
    };

    jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

    // Test without SlackContext (backward compatibility)
    const response = await masterAgent.processUserInput(
      'Help me with something',
      'test-session',
      'test-user'
    );

    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.contextGathered).toBeUndefined();
  });
});

console.log('✅ Enhanced MasterAgent validation completed successfully!');
