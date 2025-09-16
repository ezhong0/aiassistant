import { MasterAgent } from '../../src/agents/master.agent';
import { AIServiceCircuitBreaker, AIServiceUnavailableError } from '../../src/services/ai-circuit-breaker.service';
import { OpenAIService } from '../../src/services/openai.service';
// import { SlackMessageReaderService } from '../../src/services/slack-message-reader.service';
import { serviceManager } from '../../src/services/service-manager';
import { SlackContext } from '../../src/types/slack.types';

// Mock services
jest.mock('../../src/services/service-manager');
jest.mock('../../src/config/agent-factory-init');

const mockCircuitBreaker = {
  execute: jest.fn(),
  setOpenAIService: jest.fn(),
  getMetrics: jest.fn(),
  reset: jest.fn()
} as unknown as AIServiceCircuitBreaker;

const mockOpenAIService = {
  isReady: jest.fn().mockReturnValue(true),
  generateText: jest.fn(),
  generateToolCalls: jest.fn()
} as unknown as OpenAIService;

const mockSlackMessageReader = {
  readRecentMessages: jest.fn(),
  readThreadMessages: jest.fn()
} as unknown as any; // SlackMessageReaderService;

const mockGetService = serviceManager.getService as jest.Mock;

describe('AI-First MasterAgent Integration Tests', () => {
  let masterAgent: MasterAgent;

  beforeEach(() => {
    // Setup service mocks
    mockGetService.mockImplementation((serviceName: string) => {
      switch (serviceName) {
        case 'aiCircuitBreakerService':
          return mockCircuitBreaker;
        case 'slackMessageReaderService':
          return mockSlackMessageReader;
        default:
          return null;
      }
    });

    // Reset all mocks
    jest.clearAllMocks();
    
    // Initialize MasterAgent
    masterAgent = new MasterAgent();
  });

  describe('AI Service Requirements', () => {
    it('should require AI circuit breaker service on initialization', () => {
      expect(mockGetService).toHaveBeenCalledWith('aiCircuitBreakerService');
      expect(mockGetService).toHaveBeenCalledWith('slackMessageReaderService');
    });

    it('should throw error if AI circuit breaker not available', () => {
      mockGetService.mockReturnValue(null);
      
      expect(() => new MasterAgent()).toThrow(
        'MasterAgent initialization failed: AIServiceCircuitBreaker is required for AI-first operation'
      );
    });

    it('should handle missing Slack message reader gracefully', () => {
      mockGetService.mockImplementation((serviceName: string) => {
        if (serviceName === 'aiCircuitBreakerService') return mockCircuitBreaker;
        return null; // SlackMessageReader not available
      });

      expect(() => new MasterAgent()).not.toThrow();
    });
  });

  describe('AI-First Processing', () => {
    beforeEach(() => {
      // Mock circuit breaker execute to call the function directly
      (mockCircuitBreaker.execute as jest.Mock).mockImplementation(async (fn) => {
        return fn(mockOpenAIService);
      });
    });

    it('should process simple read request without confirmation', async () => {
      // Mock AI responses
      (mockOpenAIService.generateText as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({ // Context detection
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Simple calendar query'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Proposal determination
          needsConfirmation: false,
          reasoning: 'Read operation'
        }));

      (mockOpenAIService.generateToolCalls as jest.Mock).mockResolvedValue({
        toolCalls: [{ name: 'manage_calendar', parameters: { action: 'list' } }],
        message: 'I\'ll check your calendar for you.'
      });

      const result = await masterAgent.processUserInput(
        'What do I have on my calendar today?',
        'test-session-123'
      );

      expect(result).toEqual(
        expect.objectContaining({
          message: 'I\'ll check your calendar for you.',
          toolCalls: expect.arrayContaining([
            expect.objectContaining({
              name: 'manage_calendar',
              parameters: expect.objectContaining({
                action: 'list'
              })
            })
          ]),
          proposal: undefined // No proposal for read operations
        })
      );

      // Verify no string matching was used
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should process write request with confirmation proposal', async () => {
      // Mock AI responses
      (mockOpenAIService.generateText as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({ // Context detection
          needsContext: false,
          contextType: 'none',
          confidence: 0.8,
          reasoning: 'Direct email request'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Proposal determination
          needsConfirmation: true,
          reasoning: 'Write operation - sending email'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Proposal generation
          text: 'I\'ll send an email to John about the meeting. Should I proceed?',
          actionType: 'send email',
          confidence: 0.9
        }));

      (mockOpenAIService.generateToolCalls as jest.Mock).mockResolvedValue({
        toolCalls: [{ 
          name: 'send_email', 
          parameters: { 
            to: 'john@example.com', 
            subject: 'Meeting Follow-up' 
          } 
        }],
        message: 'I\'ll help you send that email.'
      });

      const result = await masterAgent.processUserInput(
        'Send an email to John about our meeting tomorrow',
        'test-session-456'
      );

      expect(result).toEqual(
        expect.objectContaining({
          message: 'I\'ll help you send that email.',
          toolCalls: expect.arrayContaining([
            expect.objectContaining({
              name: 'send_email'
            })
          ]),
          proposal: expect.objectContaining({
            text: 'I\'ll send an email to John about the meeting. Should I proceed?',
            actionType: 'send email',
            requiresConfirmation: true
          })
        })
      );
    });

    it('should gather context when AI determines it\'s needed', async () => {
      const slackContext: SlackContext = {
        channel: 'C123456',
        user: 'U123456',
        team: 'T123456'
      };

      // Mock context needed
      (mockOpenAIService.generateText as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({
          needsContext: true,
          contextType: 'recent_messages',
          confidence: 0.9,
          reasoning: 'User referenced "that email" without context'
        }))
        .mockResolvedValueOnce('Recent conversation about project deadline email') // Context summary
        .mockResolvedValueOnce(JSON.stringify({ // Proposal determination
          needsConfirmation: false,
          reasoning: 'Search operation'
        }));

      (mockOpenAIService.generateToolCalls as jest.Mock).mockResolvedValue({
        toolCalls: [{ name: 'search_email', parameters: { query: 'project deadline' } }],
        message: 'I\'ll search for that email in the context of your recent conversation.'
      });

      // Mock Slack message reader
      (mockSlackMessageReader.readRecentMessages as jest.Mock).mockResolvedValue([
        { userId: 'U123456', text: 'Can you find that email about the project deadline?' },
        { userId: 'U789012', text: 'The one from Sarah yesterday?' }
      ]);

      const result = await masterAgent.processUserInput(
        'Find that email we discussed',
        'test-session-789',
        slackContext
      );

      expect(result.contextGathered).toEqual(
        expect.objectContaining({
          contextType: 'recent_messages',
          relevantContext: 'Recent conversation about project deadline email',
          confidence: 0.9
        })
      );

      expect(mockSlackMessageReader.readRecentMessages).toHaveBeenCalledWith(
        'C123456',
        10
      );
    });
  });

  describe('Error Handling - No String Matching Fallback', () => {
    it('should handle AI service unavailable with user-friendly message', async () => {
      (mockCircuitBreaker.execute as jest.Mock).mockRejectedValue(
        new AIServiceUnavailableError(
          'AI service is temporarily unavailable. Please try again in a few moments.',
          'CIRCUIT_OPEN'
        )
      );

      const result = await masterAgent.processUserInput(
        'Send an email to John',
        'test-session-error'
      );

      expect(result).toEqual({
        message: 'AI service is temporarily unavailable. Please try again in a few moments.',
        toolCalls: []
      });

      // Verify no string matching fallback was used
      expect(mockOpenAIService.generateText).not.toHaveBeenCalled();
    });

    it('should handle circuit breaker not available', async () => {
      // Create agent without circuit breaker
      mockGetService.mockReturnValue(null);
      
      expect(() => new MasterAgent()).toThrow(
        'AIServiceCircuitBreaker is required for AI-first operation'
      );
    });

    it('should handle generic errors gracefully', async () => {
      (mockCircuitBreaker.execute as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await masterAgent.processUserInput(
        'Schedule a meeting',
        'test-session-generic-error'
      );

      expect(result).toEqual({
        message: 'I encountered an issue processing your request. Please try again or rephrase your message.',
        toolCalls: []
      });
    });
  });

  describe('AI-Based Enhancement', () => {
    beforeEach(() => {
      (mockCircuitBreaker.execute as jest.Mock).mockImplementation(async (fn) => {
        return fn(mockOpenAIService);
      });
    });

    it('should enhance tool calls with AI-based entity extraction', async () => {
      // Mock AI responses for enhancement
      (mockOpenAIService.generateText as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({ // Context detection
          needsContext: false,
          contextType: 'none',
          confidence: 0.8
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Tool enhancement
          needsContactLookup: true,
          contactNames: ['John'],
          suggestedEnhancements: {
            priority: 'normal'
          },
          reasoning: 'User mentioned person name without email'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Proposal determination
          needsConfirmation: true,
          reasoning: 'Email sending operation'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Proposal generation
          text: 'I\'ll send an email to John with the suggested enhancements.',
          actionType: 'send email',
          confidence: 0.9
        }));

      (mockOpenAIService.generateToolCalls as jest.Mock).mockResolvedValue({
        toolCalls: [{ 
          name: 'send_email', 
          parameters: { 
            query: 'Send email to John about project update'
          } 
        }],
        message: 'I\'ll help you send that email.'
      });

      const result = await masterAgent.processUserInput(
        'Send email to John about project update',
        'test-session-enhancement'
      );

      expect(result.toolCalls?.[0].parameters).toEqual(
        expect.objectContaining({
          requiresContactLookup: true,
          contactNames: ['John'],
          priority: 'normal'
        })
      );
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent requests', async () => {
      (mockCircuitBreaker.execute as jest.Mock).mockImplementation(async (fn) => {
        // Add small delay to simulate real AI calls
        await new Promise(resolve => setTimeout(resolve, 10));
        return fn(mockOpenAIService);
      });

      (mockOpenAIService.generateText as jest.Mock).mockResolvedValue(
        JSON.stringify({ needsContext: false, contextType: 'none', confidence: 0.8 })
      );
      (mockOpenAIService.generateToolCalls as jest.Mock).mockResolvedValue({
        toolCalls: [{ name: 'search_contacts', parameters: { query: 'test' } }],
        message: 'I\'ll search for contacts.'
      });

      // Process multiple requests concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        masterAgent.processUserInput(
          `Search for contact ${i}`,
          `test-session-concurrent-${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.message).toBe('I\'ll search for contacts.');
        expect(result.toolCalls).toHaveLength(1);
      });
    });
  });
});