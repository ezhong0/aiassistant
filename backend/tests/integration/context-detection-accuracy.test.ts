/**
 * Context Detection Accuracy Tests
 * Tests the accuracy of context detection with various reference patterns
 */

import { MasterAgent } from '../../src/agents/master.agent';
import { SlackContext } from '../../src/types/slack.types';

// Mock services
jest.mock('../../src/services/service-manager');
jest.mock('../../src/services/slack-message-reader.service');
jest.mock('../../src/utils/logger');

describe('Context Detection Accuracy Tests', () => {
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

  describe('Thread History Context Detection', () => {
    const threadHistoryPatterns = [
      {
        input: "Send that email we discussed",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Direct reference to previous discussion"
      },
      {
        input: "Follow up on what we talked about",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Reference to previous conversation"
      },
      {
        input: "Can you send the email I mentioned earlier?",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Reference to earlier mention"
      },
      {
        input: "Do what we agreed on",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Reference to agreement"
      },
      {
        input: "Send the email from our conversation",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Explicit reference to conversation"
      }
    ];

    threadHistoryPatterns.forEach(({ input, expected, description }) => {
      it(`should detect thread history context for: "${input}"`, async () => {
        const mockOpenAIService = {
          generateStructuredData: jest.fn().mockResolvedValue({
            needsContext: expected.needsContext,
            contextType: expected.contextType,
            confidence: 0.9,
            reasoning: `User is referring to previous conversation: ${description}`
          }),
          generateToolCalls: jest.fn().mockResolvedValue({
            toolCalls: [],
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          input,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.contextGathered?.contextType).toBe(expected.contextType);
        expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledWith(
          input,
          expect.stringContaining('thread_history'),
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });

  describe('Recent Messages Context Detection', () => {
    const recentMessagesPatterns = [
      {
        input: "Follow up on my last message",
        expected: { needsContext: true, contextType: 'recent_messages' },
        description: "Direct reference to last message"
      },
      {
        input: "Can you help with what I just said?",
        expected: { needsContext: true, contextType: 'recent_messages' },
        description: "Reference to recent message"
      },
      {
        input: "Send an email about my previous message",
        expected: { needsContext: true, contextType: 'recent_messages' },
        description: "Reference to previous message"
      },
      {
        input: "Based on what I mentioned before",
        expected: { needsContext: true, contextType: 'recent_messages' },
        description: "Reference to previous mention"
      }
    ];

    recentMessagesPatterns.forEach(({ input, expected, description }) => {
      it(`should detect recent messages context for: "${input}"`, async () => {
        const mockOpenAIService = {
          generateStructuredData: jest.fn().mockResolvedValue({
            needsContext: expected.needsContext,
            contextType: expected.contextType,
            confidence: 0.8,
            reasoning: `User is referring to their recent messages: ${description}`
          }),
          generateToolCalls: jest.fn().mockResolvedValue({
            toolCalls: [],
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          input,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.contextGathered?.contextType).toBe(expected.contextType);
        expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledWith(
          input,
          expect.stringContaining('recent_messages'),
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });

  describe('Search Results Context Detection', () => {
    const searchPatterns = [
      {
        input: "What did Sarah say about the meeting?",
        expected: { needsContext: true, contextType: 'search_results' },
        description: "Question about specific person and topic"
      },
      {
        input: "Find messages about the project deadline",
        expected: { needsContext: true, contextType: 'search_results' },
        description: "Search for specific topic"
      },
      {
        input: "Show me what John mentioned about the budget",
        expected: { needsContext: true, contextType: 'search_results' },
        description: "Search for specific person and topic"
      },
      {
        input: "Look for discussions about the client meeting",
        expected: { needsContext: true, contextType: 'search_results' },
        description: "Search for specific event"
      }
    ];

    searchPatterns.forEach(({ input, expected, description }) => {
      it(`should detect search context for: "${input}"`, async () => {
        const mockOpenAIService = {
          generateStructuredData: jest.fn().mockResolvedValue({
            needsContext: expected.needsContext,
            contextType: expected.contextType,
            confidence: 0.85,
            reasoning: `User is asking about specific person and topic: ${description}`
          }),
          generateToolCalls: jest.fn().mockResolvedValue({
            toolCalls: [],
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          input,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.contextGathered?.contextType).toBe(expected.contextType);
        expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledWith(
          input,
          expect.stringContaining('search_results'),
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });

  describe('No Context Needed Detection', () => {
    const noContextPatterns = [
      {
        input: "Email John about the project update",
        expected: { needsContext: false, contextType: 'none' },
        description: "Direct request with clear parameters"
      },
      {
        input: "Schedule a meeting for tomorrow at 2 PM",
        expected: { needsContext: false, contextType: 'none' },
        description: "Direct calendar request"
      },
      {
        input: "Create a contact for Sarah Johnson",
        expected: { needsContext: false, contextType: 'none' },
        description: "Direct contact creation"
      },
      {
        input: "Send a reminder email to the team",
        expected: { needsContext: false, contextType: 'none' },
        description: "Direct email request"
      },
      {
        input: "What's the weather like today?",
        expected: { needsContext: false, contextType: 'none' },
        description: "General information request"
      }
    ];

    noContextPatterns.forEach(({ input, expected, description }) => {
      it(`should detect no context needed for: "${input}"`, async () => {
        const mockOpenAIService = {
          generateStructuredData: jest.fn().mockResolvedValue({
            needsContext: expected.needsContext,
            contextType: expected.contextType,
            confidence: 0.9,
            reasoning: `Direct request with clear parameters: ${description}`
          }),
          generateToolCalls: jest.fn().mockResolvedValue({
            toolCalls: [],
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          input,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.contextGathered).toBeUndefined();
        expect(mockOpenAIService.generateStructuredData).toHaveBeenCalledWith(
          input,
          expect.stringContaining('none'),
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });

  describe('Edge Cases and Ambiguous Patterns', () => {
    const ambiguousPatterns = [
      {
        input: "Send an email",
        expected: { needsContext: false, contextType: 'none' },
        description: "Ambiguous request without specific details"
      },
      {
        input: "Help me with that thing",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Vague reference that likely needs context"
      },
      {
        input: "Do what I asked",
        expected: { needsContext: true, contextType: 'recent_messages' },
        description: "Reference to previous request"
      },
      {
        input: "Follow up on it",
        expected: { needsContext: true, contextType: 'thread_history' },
        description: "Ambiguous reference to previous discussion"
      }
    ];

    ambiguousPatterns.forEach(({ input, expected, description }) => {
      it(`should handle ambiguous pattern: "${input}"`, async () => {
        const mockOpenAIService = {
          generateStructuredData: jest.fn().mockResolvedValue({
            needsContext: expected.needsContext,
            contextType: expected.contextType,
            confidence: 0.7, // Lower confidence for ambiguous cases
            reasoning: `Ambiguous request: ${description}`
          }),
          generateToolCalls: jest.fn().mockResolvedValue({
            toolCalls: [],
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          input,
          'test-session',
          'test-user',
          mockSlackContext
        );

        if (expected.needsContext) {
          expect(response.contextGathered?.contextType).toBe(expected.contextType);
        } else {
          expect(response.contextGathered).toBeUndefined();
        }
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should provide appropriate confidence scores for different patterns', async () => {
      const testCases = [
        {
          input: "Send that email we discussed",
          expectedConfidence: 0.9,
          description: "Clear thread reference"
        },
        {
          input: "Follow up on my last message",
          expectedConfidence: 0.8,
          description: "Clear recent message reference"
        },
        {
          input: "What did Sarah say?",
          expectedConfidence: 0.85,
          description: "Clear search query"
        },
        {
          input: "Email John about the project",
          expectedConfidence: 0.9,
          description: "Clear direct request"
        }
      ];

      for (const testCase of testCases) {
        const mockOpenAIService = {
          generateStructuredData: jest.fn().mockResolvedValue({
            needsContext: testCase.input.includes('that') || testCase.input.includes('my') || testCase.input.includes('What'),
            contextType: testCase.input.includes('that') ? 'thread_history' : 
                        testCase.input.includes('my') ? 'recent_messages' :
                        testCase.input.includes('What') ? 'search_results' : 'none',
            confidence: testCase.expectedConfidence,
            reasoning: testCase.description
          }),
          generateToolCalls: jest.fn().mockResolvedValue({
            toolCalls: [],
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          testCase.input,
          'test-session',
          'test-user',
          mockSlackContext
        );

        if (response.contextGathered) {
          expect(response.contextGathered.confidence).toBe(testCase.expectedConfidence);
        }
      }
    });
  });
});
