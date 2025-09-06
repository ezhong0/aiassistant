import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmailAgent } from '../../../src/agents/email.agent';
import { CalendarAgent } from '../../../src/agents/calendar.agent';
import { ThinkAgent } from '../../../src/agents/think.agent';
import { ToolExecutorService } from '../../../src/services/tool-executor.service';
import { AgentFactory } from '../../../src/framework/agent-factory';
import { ToolExecutionContext } from '../../../src/types/tools';
import { ActionPreview } from '../../../src/types/api.types';

// Mock services
jest.mock('../../../src/services/service-manager', () => ({
  getService: jest.fn(() => null)
}));

jest.mock('../../../src/config/ai-config', () => ({
  aiConfigService: {
    getAgentConfig: jest.fn(() => ({
      timeout: 30000,
      retries: 3,
      enabled: true,
      fallback_strategy: 'retry'
    }))
  }
}));

describe('Enhanced Preview/Confirmation Flow', () => {
  let emailAgent: EmailAgent;
  let calendarAgent: CalendarAgent;
  let thinkAgent: ThinkAgent;
  let toolExecutorService: ToolExecutorService;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    emailAgent = new EmailAgent();
    calendarAgent = new CalendarAgent();
    thinkAgent = new ThinkAgent();
    toolExecutorService = new ToolExecutorService();
    
    mockContext = {
      sessionId: 'test-session-123',
      userId: 'test-user-456',
      timestamp: new Date()
    };

    // Reset AgentFactory
    AgentFactory.reset();
  });

  describe('EmailAgent Preview Generation', () => {
    it('should generate detailed email preview with risk assessment', async () => {
      const params = {
        query: 'Send email to john@example.com about the quarterly report',
        accessToken: 'mock-token',
        to: 'john@example.com',
        subject: 'Quarterly Report Update',
        body: 'Hi John, Please find attached the quarterly report for Q1 2024.'
      };

      const result = await emailAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
      expect(result.result).toHaveProperty('preview');
      
      const preview = result.result.preview as ActionPreview;
      expect(preview.actionType).toBe('email');
      expect(preview.requiresConfirmation).toBe(true);
      expect(preview.riskAssessment.level).toMatch(/^(low|medium|high)$/);
      expect(preview.previewData).toHaveProperty('subject');
      expect(preview.previewData).toHaveProperty('recipients');
    });

    it('should assess high risk for emails with many recipients', async () => {
      const params = {
        query: 'Send email to entire company',
        accessToken: 'mock-token',
        to: Array(60).fill('employee@company.com'), // 60 recipients
        subject: 'Important Company Update',
        body: 'Important announcement for all employees.'
      };

      const result = await emailAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      const preview = result.result.preview as ActionPreview;
      expect(preview.riskAssessment.level).toBe('high');
      expect(preview.riskAssessment.warnings).toBeDefined();
    });

    it('should detect external domains in email recipients', async () => {
      const params = {
        query: 'Send email to external partner',
        accessToken: 'mock-token',
        to: 'partner@external-company.com',
        subject: 'Partnership Discussion',
        body: 'Let\'s discuss our partnership opportunities.'
      };

      const result = await emailAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      const preview = result.result.preview as ActionPreview;
      expect(preview.riskAssessment.level).toMatch(/^(medium|high)$/);
      expect(preview.riskAssessment.factors).toContain('External recipients');
    });
  });

  describe('CalendarAgent Preview Generation', () => {
    it('should generate detailed calendar preview with conflict detection', async () => {
      const params = {
        action: 'create' as const,
        query: 'Schedule team meeting for tomorrow at 2 PM',
        accessToken: 'mock-token',
        summary: 'Team Weekly Sync',
        start: '2024-01-15T14:00:00Z',
        end: '2024-01-15T15:00:00Z',
        attendees: ['alice@company.com', 'bob@company.com']
      };

      const result = await calendarAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
      expect(result.result).toHaveProperty('preview');
      
      const preview = result.result.preview as ActionPreview;
      expect(preview.actionType).toBe('calendar');
      expect(preview.requiresConfirmation).toBe(true);
      expect(preview.previewData).toHaveProperty('title');
      expect(preview.previewData).toHaveProperty('startTime');
      expect(preview.previewData).toHaveProperty('duration');
    });

    it('should detect scheduling conflicts for weekend events', async () => {
      const weekendDate = new Date();
      weekendDate.setDate(weekendDate.getDate() + (6 - weekendDate.getDay())); // Next Saturday
      
      const params = {
        action: 'create' as const,
        query: 'Schedule weekend meeting',
        accessToken: 'mock-token',
        summary: 'Weekend Work Session',
        start: weekendDate.toISOString(),
        end: new Date(weekendDate.getTime() + 3600000).toISOString(),
        attendees: ['team@company.com']
      };

      const result = await calendarAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      const preview = result.result.preview as ActionPreview;
      expect(preview.previewData.conflicts).toBeDefined();
      expect(preview.previewData.conflicts?.some(c => 
        c.details.includes('weekend')
      )).toBe(true);
    });

    it('should assess high risk for event deletion', async () => {
      const params = {
        action: 'delete' as const,
        query: 'Delete the team meeting',
        accessToken: 'mock-token',
        eventId: 'meeting-123'
      };

      const result = await calendarAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      const preview = result.result.preview as ActionPreview;
      expect(preview.riskAssessment.level).toBe('high');
      expect(preview.riskAssessment.factors).toContain('Irreversible deletion');
      expect(preview.reversible).toBe(false);
    });
  });

  describe('Non-Confirmation Agents', () => {
    it('should not require confirmation for ThinkAgent operations', async () => {
      const params = {
        query: 'Analyze the previous email sending operation',
        previousActions: []
      };

      const result = await thinkAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('fallbackMessage');
      expect(result.result.fallbackMessage).toContain('read-only');
    });
  });

  describe('ToolExecutorService Preview Mode', () => {
    beforeEach(() => {
      // Initialize AgentFactory with mock agents
      AgentFactory.registerAgent('emailAgent', emailAgent);
      AgentFactory.registerAgent('calendarAgent', calendarAgent);
      AgentFactory.registerAgent('Think', thinkAgent);
      
      // Mock the toolNeedsConfirmation method
      jest.spyOn(AgentFactory, 'toolNeedsConfirmation').mockImplementation((toolName: string) => {
        return toolName === 'emailAgent' || toolName === 'calendarAgent';
      });
    });

    it('should execute tools in preview mode and return awaitingConfirmation', async () => {
      const toolCall = {
        name: 'emailAgent',
        parameters: {
          query: 'Send test email',
          accessToken: 'mock-token',
          to: 'test@example.com',
          subject: 'Test Email',
          body: 'This is a test.'
        }
      };

      const result = await toolExecutorService.executeTool(
        toolCall,
        mockContext,
        'mock-token',
        { preview: true }
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
      expect(result.result).toHaveProperty('preview');
    });

    it('should not require confirmation for read-only tools', async () => {
      const toolCall = {
        name: 'Think',
        parameters: {
          query: 'Analyze previous actions'
        }
      };

      const result = await toolExecutorService.executeTool(
        toolCall,
        mockContext,
        undefined,
        { preview: true }
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('fallbackMessage');
    });

    it('should handle missing preview method gracefully', async () => {
      // Create a mock agent without executePreview method
      const mockAgent = {
        getConfig: () => ({ name: 'mockAgent' }),
        isEnabled: () => true
      };
      
      AgentFactory.registerAgent('mockAgent', mockAgent as any);
      jest.spyOn(AgentFactory, 'toolNeedsConfirmation').mockReturnValue(true);

      const toolCall = {
        name: 'mockAgent',
        parameters: { query: 'test' }
      };

      const result = await toolExecutorService.executeTool(
        toolCall,
        mockContext,
        undefined,
        { preview: true }
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('awaitingConfirmation', true);
      expect(result.result).toHaveProperty('message');
    });
  });

  describe('Preview Data Validation', () => {
    it('should generate valid email preview data structure', async () => {
      const params = {
        query: 'Send quarterly report',
        accessToken: 'mock-token',
        to: ['alice@company.com', 'bob@company.com'],
        cc: ['manager@company.com'],
        subject: 'Q1 2024 Report',
        body: 'Please review the attached quarterly report for Q1 2024. The report shows significant growth in all key metrics.'
      };

      const result = await emailAgent.executePreview(params, mockContext);
      const preview = result.result.preview as ActionPreview;
      
      expect(preview.previewData).toHaveProperty('recipients');
      expect(preview.previewData).toHaveProperty('subject');
      expect(preview.previewData).toHaveProperty('contentSummary');
      expect(preview.previewData).toHaveProperty('recipientCount');
      expect(preview.previewData.recipientCount).toBe(3); // 2 to + 1 cc
    });

    it('should generate valid calendar preview data structure', async () => {
      const params = {
        action: 'create' as const,
        query: 'Schedule quarterly review',
        accessToken: 'mock-token',
        summary: 'Q1 2024 Review Meeting',
        start: '2024-01-20T10:00:00Z',
        end: '2024-01-20T12:00:00Z',
        attendees: ['alice@company.com', 'bob@company.com', 'charlie@company.com'],
        location: 'Conference Room A'
      };

      const result = await calendarAgent.executePreview(params, mockContext);
      const preview = result.result.preview as ActionPreview;
      
      expect(preview.previewData).toHaveProperty('title');
      expect(preview.previewData).toHaveProperty('startTime');
      expect(preview.previewData).toHaveProperty('endTime');
      expect(preview.previewData).toHaveProperty('duration');
      expect(preview.previewData).toHaveProperty('attendeeCount');
      expect(preview.previewData).toHaveProperty('location');
      expect(preview.previewData.attendeeCount).toBe(3);
      expect(preview.previewData.duration).toBe('2 hours');
    });
  });

  describe('Error Handling', () => {
    it('should handle preview generation errors gracefully', async () => {
      const params = {
        query: 'Invalid email request',
        accessToken: 'mock-token',
        // Missing required fields
      };

      const result = await emailAgent.executePreview(params, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.result).toHaveProperty('error');
      expect(result.result.error).toContain('error');
    });

    it('should provide fallback messages when preview fails', async () => {
      const params = {
        action: 'create' as const,
        query: 'Invalid calendar request',
        accessToken: 'mock-token',
        // Missing required fields
      };

      const result = await calendarAgent.executePreview(params, mockContext);
      
      if (!result.success) {
        expect(result.result).toHaveProperty('error');
      }
    });
  });
});
