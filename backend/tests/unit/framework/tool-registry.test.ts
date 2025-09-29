/**
 * Tests for the unified Tool Registry
 */

import { ToolRegistry } from '../../../src/framework/tool-registry';

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Clear any existing tools before each test
    // Note: In a real implementation, you might want to reset the registry
  });

  describe('Tool Registration and Retrieval', () => {
    it('should register and retrieve tools by domain', () => {
      const emailTools = ToolRegistry.getToolsForDomain('email');
      expect(emailTools.length).toBeGreaterThan(0);
      
      const calendarTools = ToolRegistry.getToolsForDomain('calendar');
      expect(calendarTools.length).toBeGreaterThan(0);
      
      const contactTools = ToolRegistry.getToolsForDomain('contacts');
      expect(contactTools.length).toBeGreaterThan(0);
      
      const slackTools = ToolRegistry.getToolsForDomain('slack');
      expect(slackTools.length).toBeGreaterThan(0);
    });

    it('should get tool names for domain', () => {
      const emailToolNames = ToolRegistry.getToolNamesForDomain('email');
      expect(emailToolNames).toContain('send_email');
      expect(emailToolNames).toContain('search_emails');
      expect(emailToolNames).toContain('get_email');
    });

    it('should get individual tool by name', () => {
      const sendEmailTool = ToolRegistry.getTool('send_email');
      expect(sendEmailTool).toBeDefined();
      expect(sendEmailTool?.name).toBe('send_email');
      expect(sendEmailTool?.domain).toBe('email');
      expect(sendEmailTool?.serviceMethod).toBe('sendEmail');
    });
  });

  describe('Tool Definition Generation', () => {
    it('should generate tool definitions for prompts', () => {
      const emailDefinitions = ToolRegistry.generateToolDefinitionsForDomain('email');
      expect(emailDefinitions).toContain('send_email');
      expect(emailDefinitions).toContain('to: string');
      expect(emailDefinitions).toContain('subject: string');
      expect(emailDefinitions).toContain('body: string');
    });

    it('should generate tool metadata for agent capabilities', () => {
      const emailMetadata = ToolRegistry.generateToolMetadataForDomain('email');
      expect(emailMetadata.length).toBeGreaterThan(0);
      
      const sendEmailMetadata = emailMetadata.find(tool => tool.name === 'send_email');
      expect(sendEmailMetadata).toBeDefined();
      expect(sendEmailMetadata?.requiresConfirmation).toBe(true);
      expect(sendEmailMetadata?.isCritical).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate correct parameters', () => {
      const validation = ToolRegistry.validateToolParameters('send_email', {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject missing required parameters', () => {
      const validation = ToolRegistry.validateToolParameters('send_email', {
        to: 'test@example.com'
        // Missing subject and body
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required parameter: subject');
      expect(validation.errors).toContain('Missing required parameter: body');
    });

    it('should validate email format', () => {
      const validation = ToolRegistry.validateToolParameters('send_email', {
        to: 'invalid-email',
        subject: 'Test Subject',
        body: 'Test Body'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('to must be a valid email address');
    });

    it('should validate array parameters', () => {
      const validation = ToolRegistry.validateToolParameters('send_email', {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        cc: ['valid@example.com', 'invalid-email']
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('cc[1] must be a valid email address');
    });

    it('should reject unknown tools', () => {
      const validation = ToolRegistry.validateToolParameters('unknown_tool', {
        param: 'value'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unknown tool: unknown_tool');
    });

    it('should reject unknown parameters', () => {
      const validation = ToolRegistry.validateToolParameters('send_email', {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        unknownParam: 'value'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unknown parameter: unknownParam');
    });
  });

  describe('Tool Properties', () => {
    it('should have correct tool properties', () => {
      const sendEmailTool = ToolRegistry.getTool('send_email');
      expect(sendEmailTool?.requiresAuth).toBe(true);
      expect(sendEmailTool?.requiresConfirmation).toBe(true);
      expect(sendEmailTool?.isCritical).toBe(true);
      expect(sendEmailTool?.examples.length).toBeGreaterThan(0);
    });

    it('should have different confirmation requirements for different tools', () => {
      const sendEmailTool = ToolRegistry.getTool('send_email');
      const searchEmailsTool = ToolRegistry.getTool('search_emails');
      
      expect(sendEmailTool?.requiresConfirmation).toBe(true);
      expect(searchEmailsTool?.requiresConfirmation).toBe(false);
    });
  });

  describe('Domain Coverage', () => {
    it('should have tools for all expected domains', () => {
      const domains = ['email', 'calendar', 'contacts', 'slack'];
      
      for (const domain of domains) {
        const tools = ToolRegistry.getToolsForDomain(domain);
        expect(tools.length).toBeGreaterThan(0);
      }
    });

    it('should have consistent tool naming across domains', () => {
      const allTools = ToolRegistry.getAllTools();
      const toolNames = allTools.map(tool => tool.name);
      
      // Check for naming consistency (snake_case)
      for (const name of toolNames) {
        expect(name).toMatch(/^[a-z][a-z0-9_]*[a-z0-9]$/);
      }
    });
  });
});
