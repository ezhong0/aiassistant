import { EmailAgent } from '../../../src/agents/email.agent';
import { CalendarAgent } from '../../../src/agents/calendar.agent';
import { ToolExecutionContext } from '../../../src/types/tools';

describe('Agent Behavior Tests - Read/Write Operation Detection', () => {
  let emailAgent: EmailAgent;
  let calendarAgent: CalendarAgent;
  let mockContext: ToolExecutionContext;

  beforeEach(() => {
    emailAgent = new EmailAgent();
    calendarAgent = new CalendarAgent();
    mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      timestamp: new Date(),
      slackContext: undefined
    };
  });

  describe('EmailAgent Operation Detection', () => {
    it('should detect read operations correctly', () => {
      expect(emailAgent.detectOperation({ query: 'search my emails', accessToken: 'token' })).toBe('search');
      expect(emailAgent.detectOperation({ query: 'find emails from boss', accessToken: 'token' })).toBe('search');
      expect(emailAgent.detectOperation({ query: 'get email with id 123', accessToken: 'token' })).toBe('get');
      expect(emailAgent.detectOperation({ query: 'show email thread', accessToken: 'token' })).toBe('get');
    });

    it('should detect write operations correctly', () => {
      expect(emailAgent.detectOperation({ query: 'send email to john', accessToken: 'token' })).toBe('send');
      expect(emailAgent.detectOperation({ query: 'reply to the message', accessToken: 'token' })).toBe('reply');
      expect(emailAgent.detectOperation({ query: 'create draft email', accessToken: 'token' })).toBe('draft');
    });

    it('should not require confirmation for read operations', () => {
      expect(emailAgent.operationRequiresConfirmation('search')).toBe(false);
      expect(emailAgent.operationRequiresConfirmation('get')).toBe(false);
      expect(emailAgent.operationRequiresConfirmation('find')).toBe(false);
      expect(emailAgent.operationRequiresConfirmation('show')).toBe(false);
    });

    it('should require confirmation for write operations', () => {
      expect(emailAgent.operationRequiresConfirmation('send')).toBe(true);
      expect(emailAgent.operationRequiresConfirmation('reply')).toBe(true);
      expect(emailAgent.operationRequiresConfirmation('draft')).toBe(true);
      expect(emailAgent.operationRequiresConfirmation('create')).toBe(true);
    });

    it('should identify read operations as read-only', () => {
      expect(emailAgent.isReadOnlyOperation('search')).toBe(true);
      expect(emailAgent.isReadOnlyOperation('get')).toBe(true);
      expect(emailAgent.isReadOnlyOperation('find')).toBe(true);
      expect(emailAgent.isReadOnlyOperation('show')).toBe(true);
    });

    it('should identify write operations as not read-only', () => {
      expect(emailAgent.isReadOnlyOperation('send')).toBe(false);
      expect(emailAgent.isReadOnlyOperation('reply')).toBe(false);
      expect(emailAgent.isReadOnlyOperation('draft')).toBe(false);
      expect(emailAgent.isReadOnlyOperation('create')).toBe(false);
    });
  });

  describe('CalendarAgent Operation Detection', () => {
    it('should detect read operations correctly', () => {
      expect(calendarAgent.detectOperation({ query: 'show my calendar', accessToken: 'token' })).toBe('list');
      expect(calendarAgent.detectOperation({ query: 'list events', accessToken: 'token' })).toBe('list');
      expect(calendarAgent.detectOperation({ query: 'check availability', accessToken: 'token' })).toBe('check');
      expect(calendarAgent.detectOperation({ query: 'find available slots', accessToken: 'token' })).toBe('find');
    });

    it('should detect write operations correctly', () => {
      expect(calendarAgent.detectOperation({ query: 'create meeting tomorrow', accessToken: 'token' })).toBe('create');
      expect(calendarAgent.detectOperation({ query: 'schedule appointment', accessToken: 'token' })).toBe('create');
      expect(calendarAgent.detectOperation({ query: 'update meeting time', accessToken: 'token' })).toBe('update');
      expect(calendarAgent.detectOperation({ query: 'delete the meeting', accessToken: 'token' })).toBe('delete');
    });

    it('should use explicit action parameter when provided', () => {
      expect(calendarAgent.detectOperation({ 
        query: 'some query', 
        action: 'create', 
        accessToken: 'token' 
      })).toBe('create');
    });

    it('should not require confirmation for read operations', () => {
      expect(calendarAgent.operationRequiresConfirmation('list')).toBe(false);
      expect(calendarAgent.operationRequiresConfirmation('get')).toBe(false);
      expect(calendarAgent.operationRequiresConfirmation('show')).toBe(false);
      expect(calendarAgent.operationRequiresConfirmation('check')).toBe(false);
      expect(calendarAgent.operationRequiresConfirmation('find')).toBe(false);
    });

    it('should require confirmation for write operations', () => {
      expect(calendarAgent.operationRequiresConfirmation('create')).toBe(true);
      expect(calendarAgent.operationRequiresConfirmation('schedule')).toBe(true);
      expect(calendarAgent.operationRequiresConfirmation('book')).toBe(true);
      expect(calendarAgent.operationRequiresConfirmation('update')).toBe(true);
      expect(calendarAgent.operationRequiresConfirmation('delete')).toBe(true);
    });

    it('should identify read operations as read-only', () => {
      expect(calendarAgent.isReadOnlyOperation('list')).toBe(true);
      expect(calendarAgent.isReadOnlyOperation('get')).toBe(true);
      expect(calendarAgent.isReadOnlyOperation('show')).toBe(true);
      expect(calendarAgent.isReadOnlyOperation('check')).toBe(true);
      expect(calendarAgent.isReadOnlyOperation('find')).toBe(true);
    });

    it('should identify write operations as not read-only', () => {
      expect(calendarAgent.isReadOnlyOperation('create')).toBe(false);
      expect(calendarAgent.isReadOnlyOperation('schedule')).toBe(false);
      expect(calendarAgent.isReadOnlyOperation('book')).toBe(false);
      expect(calendarAgent.isReadOnlyOperation('update')).toBe(false);
      expect(calendarAgent.isReadOnlyOperation('delete')).toBe(false);
    });
  });

  describe('Expected Behavior Examples', () => {
    describe('Email Operations', () => {
      it('should execute "search my emails" directly without confirmation', async () => {
        const params = { query: 'search my emails', accessToken: 'token' };
        
        // Mock the processQuery method to avoid actual Gmail API calls
        const originalProcessQuery = emailAgent.processQuery;
        emailAgent.processQuery = jest.fn().mockResolvedValue({
          action: 'search',
          emails: [],
          count: 0
        });

        const result = await emailAgent.executePreview(params, mockContext);

        expect(result.success).toBe(true);
        expect(result.result).toHaveProperty('action', 'search');
        expect(result.result).not.toHaveProperty('awaitingConfirmation');

        // Restore original method
        emailAgent.processQuery = originalProcessQuery;
      });

      it('should require confirmation for "send email to john"', async () => {
        const params = { query: 'send email to john about project', accessToken: 'token' };
        
        // Mock the generatePreview method
        const originalGeneratePreview = emailAgent.generatePreview;
        emailAgent.generatePreview = jest.fn().mockResolvedValue({
          success: true,
          preview: {
            actionId: 'email-preview-123',
            actionType: 'email',
            title: 'Send Email: Project Update',
            description: 'Send email to john about project',
            riskAssessment: { level: 'low', factors: ['Standard email operation'] },
            estimatedExecutionTime: '2-5 seconds',
            reversible: false,
            requiresConfirmation: true,
            awaitingConfirmation: true,
            originalQuery: 'send email to john about project',
            parameters: params
          }
        });

        const result = await emailAgent.executePreview(params, mockContext);

        expect(result.success).toBe(true);
        expect(result.result).toHaveProperty('awaitingConfirmation', true);
        expect(result.result).toHaveProperty('preview');

        // Restore original method
        emailAgent.generatePreview = originalGeneratePreview;
      });
    });

    describe('Calendar Operations', () => {
      it('should execute "show my calendar" directly without confirmation', async () => {
        const params = { query: 'show my calendar', accessToken: 'token' };
        
        // Mock the processQuery method
        const originalProcessQuery = calendarAgent.processQuery;
        calendarAgent.processQuery = jest.fn().mockResolvedValue({
          success: true,
          message: 'Found 5 events',
          data: { events: [] }
        });

        const result = await calendarAgent.executePreview(params, mockContext);

        expect(result.success).toBe(true);
        expect(result.result).toHaveProperty('success', true);
        expect(result.result).not.toHaveProperty('awaitingConfirmation');

        // Restore original method
        calendarAgent.processQuery = originalProcessQuery;
      });

      it('should require confirmation for "schedule meeting"', async () => {
        const params = { query: 'schedule meeting tomorrow at 2pm', accessToken: 'token' };
        
        // Mock the generatePreview method
        const originalGeneratePreview = calendarAgent.generatePreview;
        calendarAgent.generatePreview = jest.fn().mockResolvedValue({
          success: true,
          preview: {
            actionId: 'calendar-preview-123',
            actionType: 'calendar',
            title: 'Create Event: Meeting',
            description: 'Create calendar event "Meeting" on tomorrow',
            riskAssessment: { level: 'low', factors: ['Standard calendar operation'] },
            estimatedExecutionTime: '3-7 seconds',
            reversible: true,
            requiresConfirmation: true,
            awaitingConfirmation: true,
            originalQuery: 'schedule meeting tomorrow at 2pm',
            parameters: params
          }
        });

        const result = await calendarAgent.executePreview(params, mockContext);

        expect(result.success).toBe(true);
        expect(result.result).toHaveProperty('awaitingConfirmation', true);
        expect(result.result).toHaveProperty('preview');

        // Restore original method
        calendarAgent.generatePreview = originalGeneratePreview;
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should complete read operations within 2 seconds', async () => {
      const params = { query: 'search my emails', accessToken: 'token' };
      
      // Mock the processQuery method
      const originalProcessQuery = emailAgent.processQuery;
      emailAgent.processQuery = jest.fn().mockResolvedValue({
        action: 'search',
        emails: [],
        count: 0
      });

      const startTime = Date.now();
      const result = await emailAgent.executePreview(params, mockContext);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // 2 seconds

      // Restore original method
      emailAgent.processQuery = originalProcessQuery;
    });

    it('should generate previews for write operations within 2 seconds', async () => {
      const params = { query: 'send email to john', accessToken: 'token' };
      
      // Mock the generatePreview method
      const originalGeneratePreview = emailAgent.generatePreview;
      emailAgent.generatePreview = jest.fn().mockResolvedValue({
        success: true,
        preview: {
          actionId: 'email-preview-123',
          actionType: 'email',
          title: 'Send Email',
          description: 'Send email to john',
          riskAssessment: { level: 'low', factors: ['Standard operation'] },
          estimatedExecutionTime: '2-5 seconds',
          reversible: false,
          requiresConfirmation: true,
          awaitingConfirmation: true,
          originalQuery: 'send email to john',
          parameters: params
        }
      });

      const startTime = Date.now();
      const result = await emailAgent.executePreview(params, mockContext);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // 2 seconds

      // Restore original method
      emailAgent.generatePreview = originalGeneratePreview;
    });
  });
});
