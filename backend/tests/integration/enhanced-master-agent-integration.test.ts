/**
 * Enhanced MasterAgent Integration Tests
 * Tests the new context detection, gathering, and proposal generation functionality
 */

import { MasterAgent, MasterAgentResponse, ProposalResponse, ContextGatheringResult } from '../../src/agents/master.agent';
// import { SlackMessageReaderService } from '../../src/services/slack-message-reader.service';
import { SlackContext } from '../../src/types/slack.types';
import { SlackMessage } from '../../src/types/slack-message-reader.types';
import { ToolCall } from '../../src/types/tools';
import { serviceManager } from '../../src/services/service-manager';
import logger from '../../src/utils/logger';

// Mock services
jest.mock('../../src/services/service-manager');
jest.mock('../../src/services/slack-message-reader.service');
jest.mock('../../src/utils/logger');

describe('Enhanced MasterAgent Integration Tests', () => {
  let masterAgent: MasterAgent;
  let mockSlackMessageReaderService: jest.Mocked<any>; // SlackMessageReaderService>;
  let mockSlackContext: SlackContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock SlackMessageReaderService
    mockSlackMessageReaderService = {
      readRecentMessages: jest.fn(),
      readThreadMessages: jest.fn(),
      searchMessages: jest.fn(),
      getChannelInfo: jest.fn(),
      readMessageHistory: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      getHealth: jest.fn().mockReturnValue({ healthy: true }),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock service manager to return our mock service
    (serviceManager.getService as jest.Mock).mockImplementation((serviceName: string) => {
      if (serviceName === 'slackMessageReaderService') {
        return mockSlackMessageReaderService;
      }
      return null;
    });

    // Mock Slack context
    mockSlackContext = {
      userId: 'U123456789',
      channelId: 'D123456789',
      teamId: 'T123456789',
      threadTs: '1234567890.123456',
      isDirectMessage: true,
      userName: 'testuser',
      userEmail: 'test@example.com'
    };

    // Create MasterAgent instance
    masterAgent = new MasterAgent({
      openaiApiKey: 'test-api-key'
    });
  });

  afterEach(() => {
    if (masterAgent) {
      masterAgent.cleanup();
    }
  });

  describe('Context Detection', () => {
    it('should detect thread history context needs', async () => {
      const userInput = "Send that email we discussed";
      
      // Mock OpenAI service to return context detection result
      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'thread_history',
          confidence: 0.9,
          reasoning: 'User is referring to previous conversation'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to send an email.'
        })
      };

      // Mock the getOpenAIService method
      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        userInput,
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.contextGathered).toBeDefined();
      expect(response.contextGathered?.contextType).toBe('thread_history');
    });

    it('should detect recent messages context needs', async () => {
      const userInput = "Follow up on my last message";
      
      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'recent_messages',
          confidence: 0.8,
          reasoning: 'User is referring to their recent messages'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to follow up.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        userInput,
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.contextGathered).toBeDefined();
      expect(response.contextGathered?.contextType).toBe('recent_messages');
    });

    it('should detect search context needs', async () => {
      const userInput = "What did Sarah say about the meeting?";
      
      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'search_results',
          confidence: 0.85,
          reasoning: 'User is asking about specific person and topic'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to find information.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        userInput,
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.contextGathered).toBeDefined();
      expect(response.contextGathered?.contextType).toBe('search_results');
    });

    it('should not detect context needs for direct requests', async () => {
      const userInput = "Email John about the project";
      
      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to send an email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        userInput,
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.contextGathered).toBeUndefined();
    });
  });

  describe('Context Gathering', () => {
    it('should gather thread history context', async () => {
      const mockMessages: SlackMessage[] = [
        {
          id: '1234567890.123456',
          channelId: 'D123456789',
          userId: 'U123456789',
          text: 'We discussed sending an email to john@example.com about the project update',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          threadTs: '1234567890.123456',
          isThreadReply: false,
          attachments: [],
          files: [],
          reactions: [],
          metadata: { type: 'message' }
        }
      ];

      mockSlackMessageReaderService.readThreadMessages.mockResolvedValue(mockMessages);

      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'thread_history',
          confidence: 0.9,
          reasoning: 'User is referring to previous conversation'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to send an email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Send that email we discussed",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(mockSlackMessageReaderService.readThreadMessages).toHaveBeenCalledWith(
        'D123456789',
        '1234567890.123456',
        { limit: 20 }
      );
      expect(response.contextGathered?.messages).toEqual(mockMessages);
      expect(response.contextGathered?.relevantContext).toContain('john@example.com');
    });

    it('should gather recent messages context', async () => {
      const mockMessages: SlackMessage[] = [
        {
          id: '1234567890.123457',
          channelId: 'D123456789',
          userId: 'U123456789',
          text: 'I need to follow up on the project status',
          timestamp: new Date('2024-01-01T09:00:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          attachments: [],
          files: [],
          reactions: [],
          metadata: { type: 'message' }
        }
      ];

      mockSlackMessageReaderService.readRecentMessages.mockResolvedValue(mockMessages);

      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'recent_messages',
          confidence: 0.8,
          reasoning: 'User is referring to their recent messages'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to follow up.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Follow up on my last message",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(mockSlackMessageReaderService.readRecentMessages).toHaveBeenCalledWith(
        'D123456789',
        10,
        { 
          filter: {
            userIds: ['U123456789'],
            excludeBotMessages: true
          }
        }
      );
      expect(response.contextGathered?.messages).toEqual(mockMessages);
    });

    it('should gather search results context', async () => {
      const mockMessages: SlackMessage[] = [
        {
          id: '1234567890.123458',
          channelId: 'D123456789',
          userId: 'U987654321',
          text: 'Sarah mentioned the meeting is scheduled for tomorrow at 2 PM',
          timestamp: new Date('2024-01-01T08:00:00Z'),
          threadTs: undefined,
          isThreadReply: false,
          attachments: [],
          files: [],
          reactions: [],
          metadata: { type: 'message' }
        }
      ];

      mockSlackMessageReaderService.searchMessages.mockResolvedValue(mockMessages);

      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'search_results',
          confidence: 0.85,
          reasoning: 'User is asking about specific person and topic'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to find information.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "What did Sarah say about the meeting?",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(mockSlackMessageReaderService.searchMessages).toHaveBeenCalledWith(
        'sarah meeting',
        { 
          channels: ['D123456789'],
          limit: 10 
        }
      );
      expect(response.contextGathered?.messages).toEqual(mockMessages);
    });
  });

  describe('Proposal Generation', () => {
    it('should generate conversational proposal for email action', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'send_email',
          parameters: {
            recipient: 'john@example.com',
            subject: 'Project Update',
            body: 'Here is the latest project status.'
          }
        }
      ];

      const mockOpenAIService = {
        generateStructuredData: jest.fn()
          .mockResolvedValueOnce({
            needsContext: false,
            contextType: 'none',
            confidence: 0.9,
            reasoning: 'Direct request with clear parameters'
          })
          .mockResolvedValueOnce({
            text: "I'll send an email to john@example.com with the subject 'Project Update' and the following content:\n\nHere is the latest project status.\n\nShould I go ahead?",
            actionType: 'email',
            confidence: 0.95,
            requiresConfirmation: true
          }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls,
          message: 'I understand you want to send an email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Email John about the project update",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeDefined();
      expect(response.proposal?.text).toContain("I'll send an email to john@example.com");
      expect(response.proposal?.text).toContain("Here is the latest project status.");
      expect(response.proposal?.actionType).toBe('email');
      expect(response.proposal?.requiresConfirmation).toBe(true);
      expect(response.proposal?.originalToolCalls).toEqual(toolCalls);
    });

    it('should generate conversational proposal for calendar action', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'manage_calendar',
          parameters: {
            title: 'Team Meeting',
            attendees: ['john@example.com'],
            startTime: '2024-01-02T14:00:00Z',
            endTime: '2024-01-02T15:00:00Z'
          }
        }
      ];

      const mockOpenAIService = {
        generateStructuredData: jest.fn()
          .mockResolvedValueOnce({
            needsContext: false,
            contextType: 'none',
            confidence: 0.9,
            reasoning: 'Direct request with clear parameters'
          })
          .mockResolvedValueOnce({
            text: "I'll create a calendar event called 'Team Meeting' and invite john@example.com. Does this look right?",
            actionType: 'calendar',
            confidence: 0.9,
            requiresConfirmation: true
          }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls,
          message: 'I understand you want to create a calendar event.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Schedule a team meeting with John tomorrow at 2 PM",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeDefined();
      expect(response.proposal?.text).toContain("I'll create a calendar event called 'Team Meeting'");
      expect(response.proposal?.actionType).toBe('calendar');
      expect(response.proposal?.requiresConfirmation).toBe(true);
    });

    it('should not generate proposal for Think tool calls', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'Think',
          parameters: {
            query: 'Analyzing the request'
          }
        }
      ];

      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls,
          message: 'I need to think about this request.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Help me understand this complex request",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeUndefined();
    });

    it('should generate proposal with context information', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'send_email',
          parameters: {
            recipient: 'john@example.com',
            subject: 'Follow up on our discussion',
            body: 'As we discussed, here are the next steps.'
          }
        }
      ];

      const mockMessages: SlackMessage[] = [
        {
          id: '1234567890.123456',
          channelId: 'D123456789',
          userId: 'U123456789',
          text: 'We discussed sending a follow-up email to John about the project',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          threadTs: '1234567890.123456',
          isThreadReply: false,
          attachments: [],
          files: [],
          reactions: [],
          metadata: { type: 'message' }
        }
      ];

      mockSlackMessageReaderService.readThreadMessages.mockResolvedValue(mockMessages);

      const mockOpenAIService = {
        generateStructuredData: jest.fn()
          .mockResolvedValueOnce({
            needsContext: true,
            contextType: 'thread_history',
            confidence: 0.9,
            reasoning: 'User is referring to previous conversation'
          })
          .mockResolvedValueOnce({
            text: "I'll send a follow-up email to john@example.com about our discussion. Should I go ahead?",
            actionType: 'email',
            confidence: 0.95,
            requiresConfirmation: true
          }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls,
          message: 'I understand you want to send a follow-up email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Send that follow-up email we discussed",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeDefined();
      expect(response.proposal?.text).toContain("follow-up email");
      expect(response.contextGathered).toBeDefined();
      expect(response.contextGathered?.contextType).toBe('thread_history');
    });
  });

  describe('Error Handling', () => {
    it('should handle context detection errors gracefully', async () => {
      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockRejectedValue(new Error('Context detection failed')),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand your request.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Send that email we discussed",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.contextGathered).toBeUndefined();
      expect(response.message).toBeDefined();
    });

    it('should handle context gathering errors gracefully', async () => {
      mockSlackMessageReaderService.readThreadMessages.mockRejectedValue(new Error('Failed to read messages'));

      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: true,
          contextType: 'thread_history',
          confidence: 0.9,
          reasoning: 'User is referring to previous conversation'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand you want to send an email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Send that email we discussed",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.contextGathered?.messages).toEqual([]);
      expect(response.contextGathered?.confidence).toBe(0.0);
    });

    it('should handle proposal generation errors gracefully', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'send_email',
          parameters: {
            recipient: 'john@example.com',
            subject: 'Project Update',
            body: 'Here is the latest project status.'
          }
        }
      ];

      const mockOpenAIService = {
        generateStructuredData: jest.fn()
          .mockResolvedValueOnce({
            needsContext: false,
            contextType: 'none',
            confidence: 0.9,
            reasoning: 'Direct request with clear parameters'
          })
          .mockRejectedValue(new Error('Proposal generation failed')),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls,
          message: 'I understand you want to send an email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Email John about the project update",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeUndefined();
      expect(response.message).toBeDefined();
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('should maintain backward compatibility with existing tool execution', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'send_email',
          parameters: {
            recipient: 'john@example.com',
            subject: 'Project Update',
            body: 'Here is the latest project status.'
          }
        },
        {
          name: 'Think',
          parameters: {
            query: 'Verify email was sent correctly'
          }
        }
      ];

      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls,
          message: 'I understand you want to send an email.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Email John about the project update",
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.toolCalls).toEqual(toolCalls);
      expect(response.needsThinking).toBe(true);
      expect(response.message).toBeDefined();
    });

    it('should work without Slack context', async () => {
      const mockOpenAIService = {
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand your request.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        "Help me with something",
        'test-session',
        'test-user'
      );

      expect(response.message).toBeDefined();
      expect(response.contextGathered).toBeUndefined();
    });
  });
});
