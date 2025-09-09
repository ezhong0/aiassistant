import { ResponseFormatterService } from '../../../src/services/response-formatter.service';
import { 
  ConfirmationFlow, 
  ConfirmationStatus,
  SlackMessageFormatOptions 
} from '../../../src/types/confirmation.types';
import { 
  ActionPreview, 
  EmailPreviewData, 
  CalendarPreviewData 
} from '../../../src/types/api.types';
import { ServiceState } from '../../../src/services/service-manager';

describe('ResponseFormatterService', () => {
  let responseFormatterService: ResponseFormatterService;

  beforeEach(async () => {
    responseFormatterService = new ResponseFormatterService();
    await responseFormatterService.initialize();
  });

  afterEach(async () => {
    if (responseFormatterService) {
      await responseFormatterService.destroy();
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      const service = new ResponseFormatterService();
      await service.initialize();

      expect(service.isReady()).toBe(true);
      expect(service.state).toBe(ServiceState.READY);
      
      await service.destroy();
    });
  });

  describe('formatConfirmationMessage', () => {
    const mockEmailPreview: ActionPreview = {
      actionId: 'test-action-id',
      actionType: 'email',
      title: 'Send Email to John about Meeting',
      description: 'Send an email to john@example.com about the quarterly review meeting',
      riskAssessment: {
        level: 'medium',
        factors: ['External recipient', 'Business communication'],
        warnings: ['Please verify the recipient is correct']
      },
      estimatedExecutionTime: '2-5 seconds',
      reversible: false,
      requiresConfirmation: true,
      awaitingConfirmation: true,
      previewData: {
        recipients: {
          to: ['john@example.com'],
          cc: ['manager@example.com']
        },
        subject: 'Quarterly Review Meeting',
        contentSummary: 'Invitation to quarterly review meeting scheduled for next week.',
        recipientCount: 2,
        externalDomains: ['example.com']
      } as EmailPreviewData,
      originalQuery: 'send email to john about quarterly review meeting',
      parameters: {
        query: 'send email to john about quarterly review meeting'
      }
    };

    const mockConfirmationFlow: ConfirmationFlow = {
      confirmationId: 'conf_test123',
      sessionId: 'session123',
      userId: 'user123',
      actionPreview: mockEmailPreview,
      originalToolCall: {
        name: 'emailAgent',
        parameters: { query: 'test' }
      },
      status: ConfirmationStatus.PENDING,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    };

    it('should format email confirmation message with full details', () => {
      const result = responseFormatterService.formatConfirmationMessage(mockConfirmationFlow);

      expect(result.text).toContain('Action Preview');
      expect(result.blocks).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(5); // Header, details, risk, metadata, divider, prompt, buttons

      // Check for email-specific formatting
      const detailsBlock = result.blocks.find((block: any) => 
        block.fields && block.fields.some((field: any) => field.text.includes('*To:*'))
      );
      expect(detailsBlock).toBeDefined();

      // Check for action buttons
      const actionsBlock = result.blocks.find((block: any) => block.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock.elements).toHaveLength(2); // Yes and No buttons
    });

    it('should format calendar confirmation message', () => {
      const calendarPreview: ActionPreview = {
        ...mockEmailPreview,
        actionType: 'calendar',
        title: 'Schedule Meeting with Team',
        description: 'Create a calendar event for team meeting',
        previewData: {
          title: 'Team Weekly Meeting',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
          duration: '1 hour',
          attendees: ['alice@company.com', 'bob@company.com'],
          location: 'Conference Room A',
          attendeeCount: 2
        } as CalendarPreviewData
      };

      const calendarConfirmation: ConfirmationFlow = {
        ...mockConfirmationFlow,
        actionPreview: calendarPreview
      };

      const result = responseFormatterService.formatConfirmationMessage(calendarConfirmation);

      expect(result.text).toContain('Action Preview');
      expect(result.blocks).toBeDefined();

      // Check for calendar-specific formatting
      const detailsBlock = result.blocks.find((block: any) => 
        block.fields && block.fields.some((field: any) => field.text.includes('*Time:*'))
      );
      expect(detailsBlock).toBeDefined();
    });

    it('should handle compact format option', () => {
      const options: SlackMessageFormatOptions = {
        useCompactFormat: true,
        showDetailedPreview: false
      };

      const result = responseFormatterService.formatConfirmationMessage(
        mockConfirmationFlow, 
        options
      );

      expect(result.blocks).toBeDefined();
      // Compact format should have fewer blocks
      expect(result.blocks.length).toBeLessThan(7);
    });

    it('should handle missing risk assessment gracefully', () => {
      const confirmationWithoutRisk: ConfirmationFlow = {
        ...mockConfirmationFlow,
        actionPreview: {
          ...mockEmailPreview,
          riskAssessment: {
            level: 'low',
            factors: []
          }
        }
      };

      const result = responseFormatterService.formatConfirmationMessage(confirmationWithoutRisk);

      expect(result.blocks).toBeDefined();
      expect(result.text).toBeDefined();
    });

    it('should include all format options when requested', () => {
      const options: SlackMessageFormatOptions = {
        includeRiskAssessment: true,
        includeExecutionTime: true,
        showDetailedPreview: true,
        useCompactFormat: false
      };

      const result = responseFormatterService.formatConfirmationMessage(
        mockConfirmationFlow,
        options
      );

      expect(result.blocks).toBeDefined();
      
      // Should have risk assessment block
      const riskBlock = result.blocks.find((block: any) => 
        block.text && block.text.text.includes('Risk Level')
      );
      expect(riskBlock).toBeDefined();

      // Should have metadata with execution time
      const metadataBlock = result.blocks.find((block: any) => 
        block.fields && block.fields.some((field: any) => 
          field.text.includes('*Estimated Execution Time:*')
        )
      );
      expect(metadataBlock).toBeDefined();
    });

    it('should handle generic action types with fallback formatting', () => {
      const genericPreview: ActionPreview = {
        ...mockEmailPreview,
        actionType: 'search',
        title: 'Web Search Operation',
        description: 'Perform a web search',
        previewData: {
          query: 'test search query',
          maxResults: 10,
          searchDepth: 'basic'
        }
      };

      const genericConfirmation: ConfirmationFlow = {
        ...mockConfirmationFlow,
        actionPreview: genericPreview
      };

      const result = responseFormatterService.formatConfirmationMessage(genericConfirmation);

      expect(result.text).toContain('Action Preview');
      expect(result.blocks).toBeDefined();
      
      // Should handle unknown action type gracefully
      const headerBlock = result.blocks.find((block: any) => 
        block.text && block.text.text.includes('🔍')
      );
      expect(headerBlock).toBeDefined();
    });
  });

  describe('formatCompletionMessage', () => {
    it('should format successful completion message', () => {
      const completedConfirmation: ConfirmationFlow = {
        confirmationId: 'conf_test123',
        sessionId: 'session123',
        actionPreview: {
          actionId: 'test-id',
          actionType: 'email',
          title: 'Send Email to John',
          description: 'Email sent successfully',
          riskAssessment: { level: 'low', factors: [] },
          estimatedExecutionTime: '2 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: false,
          previewData: {},
          originalQuery: 'test',
          parameters: {}
        },
        originalToolCall: { name: 'emailAgent', parameters: {} },
        status: ConfirmationStatus.EXECUTED,
        createdAt: new Date(),
        expiresAt: new Date(),
        executionResult: {
          toolName: 'emailAgent',
          result: { messageId: 'msg123' },
          success: true,
          executionTime: 1500
        }
      };

      const result = responseFormatterService.formatCompletionMessage(completedConfirmation);

      expect(result.text).toContain('✅');
      expect(result.text).toContain('Action Completed Successfully');
      expect(result.blocks).toBeDefined();
      expect(result.blocks[0].text.text).toContain('completed successfully');
    });

    it('should format failed completion message', () => {
      const failedConfirmation: ConfirmationFlow = {
        confirmationId: 'conf_test123',
        sessionId: 'session123',
        actionPreview: {
          actionId: 'test-id',
          actionType: 'email',
          title: 'Send Email to John',
          description: 'Email failed to send',
          riskAssessment: { level: 'low', factors: [] },
          estimatedExecutionTime: '2 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: false,
          previewData: {},
          originalQuery: 'test',
          parameters: {}
        },
        originalToolCall: { name: 'emailAgent', parameters: {} },
        status: ConfirmationStatus.FAILED,
        createdAt: new Date(),
        expiresAt: new Date(),
        executionResult: {
          toolName: 'emailAgent',
          result: null,
          success: false,
          error: 'Failed to send email',
          executionTime: 1000
        }
      };

      const result = responseFormatterService.formatCompletionMessage(failedConfirmation);

      expect(result.text).toContain('❌');
      expect(result.text).toContain('Action Failed');
      expect(result.blocks).toBeDefined();
      expect(result.blocks[0].text.text).toContain('failed to execute');
    });
  });

  describe('formatCancellationMessage', () => {
    it('should format cancellation message', () => {
      const cancelledConfirmation: ConfirmationFlow = {
        confirmationId: 'conf_test123',
        sessionId: 'session123',
        actionPreview: {
          actionId: 'test-id',
          actionType: 'email',
          title: 'Send Email to John',
          description: 'Cancelled email operation',
          riskAssessment: { level: 'low', factors: [] },
          estimatedExecutionTime: '2 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: false,
          previewData: {},
          originalQuery: 'test',
          parameters: {}
        },
        originalToolCall: { name: 'emailAgent', parameters: {} },
        status: ConfirmationStatus.REJECTED,
        createdAt: new Date(),
        expiresAt: new Date()
      };

      const result = responseFormatterService.formatCancellationMessage(cancelledConfirmation);

      expect(result.text).toContain('🚫');
      expect(result.text).toContain('Action Cancelled');
      expect(result.blocks).toBeDefined();
      expect(result.blocks[0].text.text).toContain('was not executed');
    });
  });

  describe('formatSimpleConfirmationMessage', () => {
    const mockConfirmationFlow: ConfirmationFlow = {
      confirmationId: 'conf_test123',
      sessionId: 'session123',
      actionPreview: {
        actionId: 'test-id',
        actionType: 'email',
        title: 'Send Email to John',
        description: 'Send email operation',
        riskAssessment: { 
          level: 'medium', 
          factors: ['External recipient'],
          warnings: ['Verify recipient']
        },
        estimatedExecutionTime: '2-5 seconds',
        reversible: false,
        requiresConfirmation: true,
        awaitingConfirmation: true,
        previewData: {
          recipients: { to: ['john@example.com'] },
          subject: 'Test Subject',
          contentSummary: 'Test content',
          recipientCount: 1
        } as EmailPreviewData,
        originalQuery: 'send email to john',
        parameters: {}
      },
      originalToolCall: { name: 'emailAgent', parameters: {} },
      status: ConfirmationStatus.PENDING,
      createdAt: new Date(),
      expiresAt: new Date()
    };

    it('should format simple text-only confirmation message', () => {
      const result = responseFormatterService.formatSimpleConfirmationMessage(mockConfirmationFlow);

      expect(result).toContain('📧 Action Preview');
      expect(result).toContain('Send Email to John');
      expect(result).toContain('To: john@example.com');
      expect(result).toContain('Subject: Test Subject');
      expect(result).toContain('Recipients: 1');
      expect(result).toContain('🟡 Risk Level: MEDIUM');
      expect(result).toContain('Risk Factors: External recipient');
      expect(result).toContain('Estimated Execution Time: 2-5 seconds');
      expect(result).toContain('Reversible: No');
      expect(result).toContain('Do you want to proceed');
    });

    it('should handle calendar action in simple format', () => {
      const calendarConfirmation: ConfirmationFlow = {
        ...mockConfirmationFlow,
        actionPreview: {
          ...mockConfirmationFlow.actionPreview,
          actionType: 'calendar',
          previewData: {
            title: 'Team Meeting',
            startTime: '2024-01-15T10:00:00Z',
            endTime: '2024-01-15T11:00:00Z',
            attendees: ['alice@company.com'],
            attendeeCount: 1
          } as CalendarPreviewData
        }
      };

      const result = responseFormatterService.formatSimpleConfirmationMessage(calendarConfirmation);

      expect(result).toContain('📅 Action Preview');
      expect(result).toContain('Title: Team Meeting');
      expect(result).toContain('Time: 2024-01-15T10:00:00Z - 2024-01-15T11:00:00Z');
      expect(result).toContain('Attendees: alice@company.com');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed confirmation flow gracefully', () => {
      const malformedConfirmation = {
        confirmationId: 'test',
        actionPreview: null // This should cause issues
      } as any;

      const result = responseFormatterService.formatConfirmationMessage(malformedConfirmation);

      // Should return fallback message
      expect(result.text).toBeDefined();
      expect(result.blocks).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should handle missing preview data gracefully', () => {
      const confirmationWithoutPreviewData: ConfirmationFlow = {
        confirmationId: 'conf_test123',
        sessionId: 'session123',
        actionPreview: {
          actionId: 'test-id',
          actionType: 'email',
          title: 'Test Action',
          description: 'Test description',
          riskAssessment: { level: 'low', factors: [] },
          estimatedExecutionTime: '2 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: true,
          previewData: {}, // Empty preview data
          originalQuery: 'test',
          parameters: {}
        },
        originalToolCall: { name: 'emailAgent', parameters: {} },
        status: ConfirmationStatus.PENDING,
        createdAt: new Date(),
        expiresAt: new Date()
      };

      const result = responseFormatterService.formatConfirmationMessage(confirmationWithoutPreviewData);

      expect(result.text).toBeDefined();
      expect(result.blocks).toBeDefined();
      // Should not include details block for empty preview data
    });
  });
});