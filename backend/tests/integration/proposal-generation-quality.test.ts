/**
 * Proposal Generation Quality Validation Tests
 * Tests the quality and accuracy of conversational proposal generation
 */

import { MasterAgent, ProposalResponse } from '../../src/agents/master.agent';
import { ToolCall } from '../../src/types/tools';
import { SlackContext } from '../../src/types/slack.types';

// Mock services
jest.mock('../../src/services/service-manager');
jest.mock('../../src/services/slack-message-reader.service');
jest.mock('../../src/utils/logger');

describe('Proposal Generation Quality Validation Tests', () => {
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

  describe('Email Proposal Quality', () => {
    const emailTestCases = [
      {
        toolCalls: [
          {
            name: 'send_email',
            parameters: {
              recipient: 'john@example.com',
              subject: 'Project Update',
              body: 'Here is the latest project status.'
            }
          }
        ],
        userInput: 'Email John about the project update',
        expectedElements: ['john@example.com', 'Project Update', 'email'],
        description: 'Basic email with recipient and subject'
      },
      {
        toolCalls: [
          {
            name: 'send_email',
            parameters: {
              recipient: 'sarah@company.com',
              subject: 'Meeting Follow-up',
              body: 'Thank you for the productive meeting today.'
            }
          }
        ],
        userInput: 'Send a follow-up email to Sarah',
        expectedElements: ['sarah@company.com', 'follow-up', 'email'],
        description: 'Follow-up email with specific recipient'
      },
      {
        toolCalls: [
          {
            name: 'send_email',
            parameters: {
              recipient: 'team@company.com',
              subject: 'Weekly Report',
              body: 'Please find attached the weekly progress report.'
            }
          }
        ],
        userInput: 'Send the weekly report to the team',
        expectedElements: ['team@company.com', 'weekly report', 'email'],
        description: 'Team email with specific content'
      }
    ];

    emailTestCases.forEach(({ toolCalls, userInput, expectedElements, description }) => {
      it(`should generate quality email proposal: ${description}`, async () => {
        const mockProposal: ProposalResponse = {
          text: `I'll send an email to ${toolCalls[0].parameters.recipient} with the subject '${toolCalls[0].parameters.subject}' and the following content:\n\n${toolCalls[0].parameters.body}\n\nShould I go ahead?`,
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
          userInput,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.proposal).toBeDefined();
        expect(response.proposal?.actionType).toBe('email');
        expect(response.proposal?.requiresConfirmation).toBe(true);
        expect(response.proposal?.confidence).toBeGreaterThan(0.9);

        // Validate proposal text contains expected elements
        expectedElements.forEach(element => {
          expect(response.proposal?.text.toLowerCase()).toContain(element.toLowerCase());
        });

        // Validate proposal includes the full email body
        expect(response.proposal?.text).toContain(toolCalls[0].parameters.body);

        // Validate proposal uses conversational language
        expect(response.proposal?.text).toMatch(/I'll|I will/);
        expect(response.proposal?.text).toMatch(/Should I|Does this|go ahead/);
      });
    });
  });

  describe('Calendar Proposal Quality', () => {
    const calendarTestCases = [
      {
        toolCalls: [
          {
            name: 'manage_calendar',
            parameters: {
              title: 'Team Meeting',
              attendees: ['john@example.com'],
              startTime: '2024-01-02T14:00:00Z',
              endTime: '2024-01-02T15:00:00Z'
            }
          }
        ],
        userInput: 'Schedule a team meeting with John tomorrow at 2 PM',
        expectedElements: ['Team Meeting', 'john@example.com', 'calendar'],
        description: 'Basic calendar event with attendee'
      },
      {
        toolCalls: [
          {
            name: 'manage_calendar',
            parameters: {
              title: 'Project Review',
              attendees: ['sarah@company.com', 'mike@company.com'],
              startTime: '2024-01-03T10:00:00Z',
              endTime: '2024-01-03T11:00:00Z',
              description: 'Weekly project review meeting'
            }
          }
        ],
        userInput: 'Create a project review meeting for next week',
        expectedElements: ['Project Review', 'calendar', 'meeting'],
        description: 'Calendar event with multiple attendees'
      }
    ];

    calendarTestCases.forEach(({ toolCalls, userInput, expectedElements, description }) => {
      it(`should generate quality calendar proposal: ${description}`, async () => {
        const mockProposal: ProposalResponse = {
          text: `I'll create a calendar event called '${toolCalls[0].parameters.title}' and invite ${toolCalls[0].parameters.attendees.join(', ')}. Does this look right?`,
          actionType: 'calendar',
          confidence: 0.9,
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
            message: 'I understand you want to create a calendar event.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          userInput,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.proposal).toBeDefined();
        expect(response.proposal?.actionType).toBe('calendar');
        expect(response.proposal?.requiresConfirmation).toBe(true);

        // Validate proposal text contains expected elements
        expectedElements.forEach(element => {
          expect(response.proposal?.text.toLowerCase()).toContain(element.toLowerCase());
        });

        // Validate proposal uses conversational language
        expect(response.proposal?.text).toMatch(/I'll|I will/);
        expect(response.proposal?.text).toMatch(/calendar event|meeting/);
      });
    });
  });

  describe('Contact Proposal Quality', () => {
    const contactTestCases = [
      {
        toolCalls: [
          {
            name: 'search_contacts',
            parameters: {
              query: 'John Smith',
              name: 'John Smith',
              email: 'john.smith@example.com'
            }
          }
        ],
        userInput: 'Find John Smith in my contacts',
        expectedElements: ['John Smith', 'contact'],
        description: 'Contact search request'
      },
      {
        toolCalls: [
          {
            name: 'create_contact',
            parameters: {
              name: 'Sarah Johnson',
              email: 'sarah.johnson@company.com',
              phone: '+1-555-0123'
            }
          }
        ],
        userInput: 'Add Sarah Johnson to my contacts',
        expectedElements: ['Sarah Johnson', 'contact'],
        description: 'Contact creation request'
      }
    ];

    contactTestCases.forEach(({ toolCalls, userInput, expectedElements, description }) => {
      it(`should generate quality contact proposal: ${description}`, async () => {
        const mockProposal: ProposalResponse = {
          text: `I'll ${toolCalls[0].name.includes('search') ? 'search for' : 'add'} ${toolCalls[0].parameters.name} in your contacts. Should I proceed?`,
          actionType: 'contact',
          confidence: 0.9,
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
            message: 'I understand you want to work with contacts.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          userInput,
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.proposal).toBeDefined();
        expect(response.proposal?.actionType).toBe('contact');
        expect(response.proposal?.requiresConfirmation).toBe(true);

        // Validate proposal text contains expected elements
        expectedElements.forEach(element => {
          expect(response.proposal?.text.toLowerCase()).toContain(element.toLowerCase());
        });
      });
    });
  });

  describe('Proposal Language Quality', () => {
    it('should use conversational and friendly language', async () => {
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

      const mockProposal: ProposalResponse = {
        text: "I'll send an email to john@example.com with the subject 'Project Update' and the following content:\n\nHere is the latest project status.\n\nShould I go ahead?",
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
        'Email John about the project update',
        'test-session',
        'test-user',
        mockSlackContext
      );

      const proposalText = response.proposal?.text || '';

      // Check for conversational language patterns
      expect(proposalText).toMatch(/I'll|I will/);
      expect(proposalText).toMatch(/Should I|Does this|go ahead|look right/);
      expect(proposalText).not.toMatch(/actionId|actionType|riskAssessment/);
      expect(proposalText).not.toMatch(/previewData|steps/);
    });

    it('should include relevant details from tool calls', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'send_email',
          parameters: {
            recipient: 'sarah@company.com',
            subject: 'Meeting Follow-up',
            body: 'Thank you for the productive meeting today.'
          }
        }
      ];

      const mockProposal: ProposalResponse = {
        text: "I'll send an email to sarah@company.com with the subject 'Meeting Follow-up' and the following content:\n\nThank you for the productive meeting today.\n\nShould I go ahead?",
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
        'Send a follow-up email to Sarah',
        'test-session',
        'test-user',
        mockSlackContext
      );

      const proposalText = response.proposal?.text || '';

      // Check that relevant details are included
      expect(proposalText).toContain('sarah@company.com');
      expect(proposalText).toContain('Meeting Follow-up');
      expect(proposalText).toContain('Thank you for the productive meeting today.');
      expect(proposalText).toContain('email');
    });

    it('should ask for confirmation appropriately', async () => {
      const testCases = [
        {
          toolCalls: [
            {
              name: 'send_email',
              parameters: { recipient: 'john@example.com', subject: 'Test' }
            }
          ],
          shouldConfirm: true,
          description: 'Email actions should require confirmation'
        },
        {
          toolCalls: [
            {
              name: 'manage_calendar',
              parameters: { title: 'Meeting', attendees: ['john@example.com'] }
            }
          ],
          shouldConfirm: true,
          description: 'Calendar actions should require confirmation'
        },
        {
          toolCalls: [
            {
              name: 'search_contacts',
              parameters: { query: 'John' }
            }
          ],
          shouldConfirm: false,
          description: 'Search actions may not require confirmation'
        }
      ];

      for (const testCase of testCases) {
        const mockProposal: ProposalResponse = {
          text: `I'll perform the requested action. ${testCase.shouldConfirm ? 'Should I proceed?' : ''}`,
          actionType: testCase.toolCalls[0].name.includes('email') ? 'email' : 
                     testCase.toolCalls[0].name.includes('calendar') ? 'calendar' : 'contact',
          confidence: 0.9,
          requiresConfirmation: testCase.shouldConfirm,
          originalToolCalls: testCase.toolCalls
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
            toolCalls: testCase.toolCalls,
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          'Test request',
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.proposal?.requiresConfirmation).toBe(testCase.shouldConfirm);
      }
    });
  });

  describe('Proposal Confidence Scoring', () => {
    it('should provide appropriate confidence scores', async () => {
      const testCases = [
        {
          toolCalls: [
            {
              name: 'send_email',
              parameters: {
                recipient: 'john@example.com',
                subject: 'Project Update',
                body: 'Clear and specific email content'
              }
            }
          ],
          expectedConfidence: 0.95,
          description: 'Clear email with all parameters'
        },
        {
          toolCalls: [
            {
              name: 'send_email',
              parameters: {
                recipient: 'john@example.com'
                // Missing subject and body
              }
            }
          ],
          expectedConfidence: 0.7,
          description: 'Incomplete email parameters'
        },
        {
          toolCalls: [
            {
              name: 'manage_calendar',
              parameters: {
                title: 'Team Meeting',
                attendees: ['john@example.com'],
                startTime: '2024-01-02T14:00:00Z',
                endTime: '2024-01-02T15:00:00Z'
              }
            }
          ],
          expectedConfidence: 0.9,
          description: 'Complete calendar event'
        }
      ];

      for (const testCase of testCases) {
        const mockProposal: ProposalResponse = {
          text: 'Test proposal text',
          actionType: testCase.toolCalls[0].name.includes('email') ? 'email' : 'calendar',
          confidence: testCase.expectedConfidence,
          requiresConfirmation: true,
          originalToolCalls: testCase.toolCalls
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
            toolCalls: testCase.toolCalls,
            message: 'I understand your request.'
          })
        };

        jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

        const response = await masterAgent.processUserInput(
          'Test request',
          'test-session',
          'test-user',
          mockSlackContext
        );

        expect(response.proposal?.confidence).toBe(testCase.expectedConfidence);
      }
    });
  });

  describe('Error Handling in Proposal Generation', () => {
    it('should handle proposal generation failures gracefully', async () => {
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
        'Email John about the project update',
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeUndefined();
      expect(response.message).toBeDefined();
    });

    it('should handle empty tool calls gracefully', async () => {
      const mockOpenAIService = {
        generateStructuredData: jest.fn().mockResolvedValue({
          needsContext: false,
          contextType: 'none',
          confidence: 0.9,
          reasoning: 'Direct request with clear parameters'
        }),
        generateToolCalls: jest.fn().mockResolvedValue({
          toolCalls: [],
          message: 'I understand your request.'
        })
      };

      jest.spyOn(masterAgent as any, 'getOpenAIService').mockReturnValue(mockOpenAIService);

      const response = await masterAgent.processUserInput(
        'Help me with something',
        'test-session',
        'test-user',
        mockSlackContext
      );

      expect(response.proposal).toBeUndefined();
      expect(response.message).toBeDefined();
    });
  });
});
