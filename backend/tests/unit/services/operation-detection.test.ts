import { AGENT_HELPERS } from '../../src/config/agent-config';

describe('Operation Detection and Confirmation Logic', () => {
  describe('AGENT_HELPERS.operationRequiresConfirmation', () => {
    it('should return false for read operations on email agent', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'search')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'get')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'list')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'find')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'show')).toBe(false);
    });

    it('should return true for write operations on email agent', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'send')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'reply')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'draft')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'create')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'update')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'delete')).toBe(true);
    });

    it('should return false for all operations on contact agent (read-only)', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'search')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'find')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'lookup')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'get')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'list')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'show')).toBe(false);
    });

    it('should return false for read operations on calendar agent', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'list')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'get')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'show')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'check')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'find')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'search')).toBe(false);
    });

    it('should return true for write operations on calendar agent', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'create')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'schedule')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'book')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'update')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'modify')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'delete')).toBe(true);
      expect(AGENT_HELPERS.operationRequiresConfirmation('calendar', 'cancel')).toBe(true);
    });

    it('should return false for all operations on search agent (read-only)', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('search', 'search')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('search', 'find')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('search', 'lookup')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('search', 'query')).toBe(false);
    });

    it('should return false for all operations on content agent (local operations)', () => {
      expect(AGENT_HELPERS.operationRequiresConfirmation('content', 'create')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('content', 'write')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('content', 'generate')).toBe(false);
      expect(AGENT_HELPERS.operationRequiresConfirmation('content', 'draft')).toBe(false);
    });

    it('should fall back to agent-level confirmation for unknown operations', () => {
      // Email agent requires confirmation at agent level, so unknown operations should require confirmation
      expect(AGENT_HELPERS.operationRequiresConfirmation('email', 'unknown')).toBe(true);
      
      // Contact agent doesn't require confirmation at agent level, so unknown operations should not require confirmation
      expect(AGENT_HELPERS.operationRequiresConfirmation('contact', 'unknown')).toBe(false);
    });
  });

  describe('AGENT_HELPERS.detectOperation', () => {
    it('should detect email operations correctly', () => {
      expect(AGENT_HELPERS.detectOperation('email', 'send email to john')).toBe('send');
      expect(AGENT_HELPERS.detectOperation('email', 'reply to the message')).toBe('reply');
      expect(AGENT_HELPERS.detectOperation('email', 'search for emails from boss')).toBe('search');
      expect(AGENT_HELPERS.detectOperation('email', 'find emails about project')).toBe('search');
      expect(AGENT_HELPERS.detectOperation('email', 'create a draft email')).toBe('draft');
      expect(AGENT_HELPERS.detectOperation('email', 'get email with id 123')).toBe('get');
      expect(AGENT_HELPERS.detectOperation('email', 'show email thread')).toBe('get');
    });

    it('should detect calendar operations correctly', () => {
      expect(AGENT_HELPERS.detectOperation('calendar', 'create meeting tomorrow')).toBe('create');
      expect(AGENT_HELPERS.detectOperation('calendar', 'schedule appointment')).toBe('create');
      expect(AGENT_HELPERS.detectOperation('calendar', 'book a room')).toBe('create');
      expect(AGENT_HELPERS.detectOperation('calendar', 'update meeting time')).toBe('update');
      expect(AGENT_HELPERS.detectOperation('calendar', 'modify event details')).toBe('update');
      expect(AGENT_HELPERS.detectOperation('calendar', 'delete the meeting')).toBe('delete');
      expect(AGENT_HELPERS.detectOperation('calendar', 'cancel appointment')).toBe('delete');
      expect(AGENT_HELPERS.detectOperation('calendar', 'list my events')).toBe('list');
      expect(AGENT_HELPERS.detectOperation('calendar', 'show calendar')).toBe('list');
      expect(AGENT_HELPERS.detectOperation('calendar', 'check availability')).toBe('check');
      expect(AGENT_HELPERS.detectOperation('calendar', 'find available slots')).toBe('find');
    });

    it('should detect contact operations correctly', () => {
      expect(AGENT_HELPERS.detectOperation('contact', 'search for john smith')).toBe('search');
      expect(AGENT_HELPERS.detectOperation('contact', 'find contact by email')).toBe('find');
      expect(AGENT_HELPERS.detectOperation('contact', 'lookup person details')).toBe('lookup');
      expect(AGENT_HELPERS.detectOperation('contact', 'get contact info')).toBe('get');
      expect(AGENT_HELPERS.detectOperation('contact', 'list all contacts')).toBe('list');
      expect(AGENT_HELPERS.detectOperation('contact', 'show contact details')).toBe('show');
    });

    it('should detect search operations correctly', () => {
      expect(AGENT_HELPERS.detectOperation('search', 'search for information')).toBe('search');
      expect(AGENT_HELPERS.detectOperation('search', 'find web results')).toBe('find');
      expect(AGENT_HELPERS.detectOperation('search', 'lookup company details')).toBe('lookup');
      expect(AGENT_HELPERS.detectOperation('search', 'query the web')).toBe('query');
    });

    it('should detect content operations correctly', () => {
      expect(AGENT_HELPERS.detectOperation('content', 'create blog post')).toBe('create');
      expect(AGENT_HELPERS.detectOperation('content', 'write article')).toBe('write');
      expect(AGENT_HELPERS.detectOperation('content', 'generate content')).toBe('generate');
      expect(AGENT_HELPERS.detectOperation('content', 'draft email')).toBe('draft');
    });

    it('should return unknown for unrecognized operations', () => {
      expect(AGENT_HELPERS.detectOperation('email', 'random text')).toBe('unknown');
      expect(AGENT_HELPERS.detectOperation('calendar', 'xyz operation')).toBe('unknown');
    });
  });

  describe('AGENT_HELPERS.getOperationConfirmationReason', () => {
    it('should provide appropriate reasons for email operations', () => {
      expect(AGENT_HELPERS.getOperationConfirmationReason('email', 'search'))
        .toBe('Read-only email search operation');
      expect(AGENT_HELPERS.getOperationConfirmationReason('email', 'send'))
        .toBe('Email sending modifies external state');
    });

    it('should provide appropriate reasons for calendar operations', () => {
      expect(AGENT_HELPERS.getOperationConfirmationReason('calendar', 'list'))
        .toBe('Read-only calendar listing operation');
      expect(AGENT_HELPERS.getOperationConfirmationReason('calendar', 'create'))
        .toBe('Calendar event creation modifies external state');
    });

    it('should provide fallback reasons for unknown operations', () => {
      expect(AGENT_HELPERS.getOperationConfirmationReason('email', 'unknown'))
        .toBe('Agent-level confirmation required');
      expect(AGENT_HELPERS.getOperationConfirmationReason('contact', 'unknown'))
        .toBe('Agent-level confirmation not required');
    });
  });

  describe('AGENT_HELPERS.isReadOnlyOperation', () => {
    it('should correctly identify read-only operations', () => {
      expect(AGENT_HELPERS.isReadOnlyOperation('email', 'search')).toBe(true);
      expect(AGENT_HELPERS.isReadOnlyOperation('email', 'get')).toBe(true);
      expect(AGENT_HELPERS.isReadOnlyOperation('calendar', 'list')).toBe(true);
      expect(AGENT_HELPERS.isReadOnlyOperation('calendar', 'check')).toBe(true);
      expect(AGENT_HELPERS.isReadOnlyOperation('contact', 'search')).toBe(true);
      expect(AGENT_HELPERS.isReadOnlyOperation('search', 'search')).toBe(true);
    });

    it('should correctly identify write operations', () => {
      expect(AGENT_HELPERS.isReadOnlyOperation('email', 'send')).toBe(false);
      expect(AGENT_HELPERS.isReadOnlyOperation('email', 'reply')).toBe(false);
      expect(AGENT_HELPERS.isReadOnlyOperation('calendar', 'create')).toBe(false);
      expect(AGENT_HELPERS.isReadOnlyOperation('calendar', 'update')).toBe(false);
      expect(AGENT_HELPERS.isReadOnlyOperation('calendar', 'delete')).toBe(false);
    });

    it('should treat all operations as read-only for read-only agents', () => {
      expect(AGENT_HELPERS.isReadOnlyOperation('contact', 'unknown')).toBe(true);
      expect(AGENT_HELPERS.isReadOnlyOperation('search', 'unknown')).toBe(true);
    });
  });
});
