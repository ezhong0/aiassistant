/**
 * Enhanced SlackInterface Integration Tests
 * Tests the integration between SlackInterfaceService and the enhanced MasterAgent
 */

import { SlackInterfaceService } from '../../src/services/slack-interface.service';
import { MasterAgent, MasterAgentResponse, ProposalResponse } from '../../src/agents/master.agent';
import { SlackContext, SlackAgentRequest, SlackAgentResponse } from '../../src/types/slack.types';
import { ToolCall, ToolResult } from '../../src/types/tools';
import { serviceManager } from '../../src/services/service-manager';
import logger from '../../src/utils/logger';

// Mock services
jest.mock('../../src/services/service-manager');
jest.mock('../../src/agents/master.agent');
jest.mock('../../src/utils/logger');

describe('Enhanced SlackInterface Integration Tests', () => {
  let slackInterfaceService: SlackInterfaceService;
  let mockMasterAgent: jest.Mocked<MasterAgent>;
  let mockSlackContext: SlackContext;
  let mockSlackAgentRequest: SlackAgentRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock MasterAgent
    mockMasterAgent = {
      processUserInput: jest.fn(),
      cleanup: jest.fn(),
      getAgentCapabilities: jest.fn().mockReturnValue({}),
      getAgentSchemas: jest.fn().mockReturnValue([]),
      getOpenAIService: jest.fn().mockReturnValue(null),
      getSystemPrompt: jest.fn().mockReturnValue('Test system prompt')
    } as any;

    // Mock service manager
    (serviceManager.getService as jest.Mock).mockImplementation((serviceName: string) => {
      if (serviceName === 'toolExecutorService') {
        return {
          executeWithConfirmation: jest.fn().mockResolvedValue({
            toolName: 'test_tool',
            success: true,
            result: 'test result',
            executionTime: 100
          })
        };
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

    // Mock Slack agent request
    mockSlackAgentRequest = {
      message: 'Send that email we discussed',
      context: mockSlackContext,
      eventType: 'message',
      metadata: {
        timestamp: new Date().toISOString(),
        eventId: 'test-event-id'
      }
    };

    // Create SlackInterfaceService instance
    slackInterfaceService = new SlackInterfaceService({
      signingSecret: 'test-signing-secret',
      botToken: 'test-bot-token',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'test-redirect-uri',
      development: true
    });
  });

  afterEach(() => {
    if (slackInterfaceService) {
      slackInterfaceService.destroy();
    }
  });

  describe('Proposal Response Handling', () => {
    it('should handle proposal responses with confirmation buttons', async () => {
      const mockProposal: ProposalResponse = {
        text: "I'll send an email to john@example.com with the subject 'Project Update'. Should I go ahead?",
        actionType: 'email',
        confidence: 0.95,
        requiresConfirmation: true,
        originalToolCalls: [
          {
            name: 'send_email',
            parameters: {
              recipient: 'john@example.com',
              subject: 'Project Update',
              body: 'Here is the latest project status.'
            }
          }
        ]
      };

      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand you want to send an email.',
        toolCalls: [],
        needsThinking: false,
        proposal: mockProposal
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      // Mock the createMasterAgent function
      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toBe(mockProposal.text);
      expect(response.response.blocks).toBeDefined();
      expect(response.response.blocks?.length).toBeGreaterThan(0);
      
      // Check for confirmation buttons
      const actionsBlock = response.response.blocks?.find((block: any) => block.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock.elements).toHaveLength(2);
      expect(actionsBlock.elements[0].text.text).toBe('Yes, go ahead');
      expect(actionsBlock.elements[1].text.text).toBe('No, cancel');
    });

    it('should handle proposal responses without confirmation', async () => {
      const mockProposal: ProposalResponse = {
        text: "I'll send an email to john@example.com with the subject 'Project Update'.",
        actionType: 'email',
        confidence: 0.95,
        requiresConfirmation: false,
        originalToolCalls: [
          {
            name: 'send_email',
            parameters: {
              recipient: 'john@example.com',
              subject: 'Project Update',
              body: 'Here is the latest project status.'
            }
          }
        ]
      };

      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand you want to send an email.',
        toolCalls: [],
        needsThinking: false,
        proposal: mockProposal
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toBe(mockProposal.text);
      expect(response.response.blocks).toBeUndefined();
    });

    it('should handle calendar proposal responses', async () => {
      const mockProposal: ProposalResponse = {
        text: "I'll create a calendar event called 'Team Meeting' and invite john@example.com. Does this look right?",
        actionType: 'calendar',
        confidence: 0.9,
        requiresConfirmation: true,
        originalToolCalls: [
          {
            name: 'manage_calendar',
            parameters: {
              title: 'Team Meeting',
              attendees: ['john@example.com'],
              startTime: '2024-01-02T14:00:00Z',
              endTime: '2024-01-02T15:00:00Z'
            }
          }
        ]
      };

      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand you want to create a calendar event.',
        toolCalls: [],
        needsThinking: false,
        proposal: mockProposal
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toContain("Team Meeting");
      expect(response.response.text).toContain("john@example.com");
      expect(response.response.blocks).toBeDefined();
    });
  });

  describe('Context Integration', () => {
    it('should pass Slack context to MasterAgent', async () => {
      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand your request.',
        toolCalls: [],
        needsThinking: false,
        contextGathered: {
          messages: [],
          relevantContext: 'Previous conversation about project updates',
          contextType: 'thread_history',
          confidence: 0.8
        }
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(mockMasterAgent.processUserInput).toHaveBeenCalledWith(
        mockSlackAgentRequest.message,
        expect.any(String), // sessionId
        mockSlackContext.userId,
        mockSlackContext
      );
    });

    it('should include context information in response', async () => {
      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand your request.',
        toolCalls: [],
        needsThinking: false,
        contextGathered: {
          messages: [],
          relevantContext: 'Previous conversation about project updates',
          contextType: 'thread_history',
          confidence: 0.8
        }
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toContain('📝 I used context from our recent conversation');
    });
  });

  describe('Natural Text Response Format', () => {
    it('should prefer natural text over blocks for simple responses', async () => {
      const mockMasterResponse: MasterAgentResponse = {
        message: 'I processed your request successfully.',
        toolCalls: [],
        needsThinking: false
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toBeDefined();
      expect(response.response.blocks).toBeUndefined();
    });

    it('should include tool execution results in natural text', async () => {
      const mockToolResults: ToolResult[] = [
        {
          toolName: 'send_email',
          success: true,
          result: 'Email sent successfully',
          executionTime: 150
        }
      ];

      const mockMasterResponse: MasterAgentResponse = {
        message: 'I processed your request successfully.',
        toolCalls: [],
        needsThinking: false,
        toolResults: mockToolResults
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toContain('✅ Completed 1 action(s) successfully');
    });

    it('should handle OAuth failures in natural text', async () => {
      const mockToolResults: ToolResult[] = [
        {
          toolName: 'send_email',
          success: false,
          error: 'OAuth authentication required',
          executionTime: 0
        }
      ];

      const mockMasterResponse: MasterAgentResponse = {
        message: 'I processed your request successfully.',
        toolCalls: [],
        needsThinking: false,
        toolResults: mockToolResults
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toContain('🔐 Some features require Gmail authentication');
    });
  });

  describe('Error Handling', () => {
    it('should handle MasterAgent errors gracefully', async () => {
      mockMasterAgent.processUserInput.mockRejectedValue(new Error('MasterAgent processing failed'));

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toContain('I apologize, but I encountered an error');
      expect(response.error).toBeDefined();
    });

    it('should handle proposal generation errors gracefully', async () => {
      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand your request.',
        toolCalls: [],
        needsThinking: false,
        proposal: undefined // Proposal generation failed
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toBe('I understand your request.');
    });

    it('should handle context gathering errors gracefully', async () => {
      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand your request.',
        toolCalls: [],
        needsThinking: false,
        contextGathered: {
          messages: [],
          relevantContext: '',
          contextType: 'none',
          confidence: 0.0
        }
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.text).toBe('I understand your request.');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing confirmation flows', async () => {
      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand your request.',
        toolCalls: [],
        needsThinking: false,
        confirmationFlows: [
          {
            confirmationId: 'test-confirmation-id',
            actionPreview: {
              title: 'Send Email',
              description: 'Send email to john@example.com',
              actionType: 'email',
              riskAssessment: { level: 'MEDIUM' }
            }
          }
        ]
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequest);

      expect(response.success).toBe(true);
      expect(response.response.blocks).toBeDefined();
      expect(response.response.text).toContain('Action Preview');
    });

    it('should work without Slack context', async () => {
      const mockSlackAgentRequestWithoutContext: SlackAgentRequest = {
        message: 'Help me with something',
        context: {
          userId: 'U123456789',
          channelId: 'D123456789',
          teamId: 'T123456789',
          isDirectMessage: true
        },
        eventType: 'message',
        metadata: {
          timestamp: new Date().toISOString(),
          eventId: 'test-event-id'
        }
      };

      const mockMasterResponse: MasterAgentResponse = {
        message: 'I understand your request.',
        toolCalls: [],
        needsThinking: false
      };

      mockMasterAgent.processUserInput.mockResolvedValue(mockMasterResponse);

      jest.doMock('../../src/config/agent-factory-init', () => ({
        createMasterAgent: jest.fn().mockReturnValue(mockMasterAgent)
      }));

      const response = await (slackInterfaceService as any).routeToAgent(mockSlackAgentRequestWithoutContext);

      expect(response.success).toBe(true);
      expect(response.response.text).toBe('I understand your request.');
    });
  });
});
