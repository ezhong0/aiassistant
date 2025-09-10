import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EmailAgent } from '../../src/agents/email.agent';
import { ContactAgent } from '../../src/agents/contact.agent';
import { CalendarAgent } from '../../src/agents/calendar.agent';
import { MasterAgent } from '../../src/agents/master.agent';
import { AgentFactory } from '../../src/framework/agent-factory';

describe('OpenAI Function Calling Integration', () => {
  beforeEach(() => {
    // Reset AgentFactory before each test
    AgentFactory.reset();
    AgentFactory.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Agent OpenAI Schema Generation', () => {
    it('should generate valid OpenAI function schema for EmailAgent', () => {
      const schema = EmailAgent.getOpenAIFunctionSchema();
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('send_email');
      expect(schema.description).toContain('Send, reply to, search, and manage emails');
      expect(schema.parameters).toBeDefined();
      expect(schema.parameters.type).toBe('object');
      expect(schema.parameters.properties).toBeDefined();
      expect(schema.parameters.properties.query).toBeDefined();
      expect(schema.parameters.required).toContain('query');
    });

    it('should generate valid OpenAI function schema for ContactAgent', () => {
      const schema = ContactAgent.getOpenAIFunctionSchema();
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('search_contacts');
      expect(schema.description).toContain('Search and retrieve contact information');
      expect(schema.parameters).toBeDefined();
      expect(schema.parameters.type).toBe('object');
      expect(schema.parameters.properties).toBeDefined();
      expect(schema.parameters.properties.query).toBeDefined();
      expect(schema.parameters.required).toContain('query');
    });

    it('should generate valid OpenAI function schema for CalendarAgent', () => {
      const schema = CalendarAgent.getOpenAIFunctionSchema();
      
      expect(schema).toBeDefined();
      expect(schema.name).toBe('manage_calendar');
      expect(schema.description).toContain('Create, update, delete, and manage calendar events');
      expect(schema.parameters).toBeDefined();
      expect(schema.parameters.type).toBe('object');
      expect(schema.parameters.properties).toBeDefined();
      expect(schema.parameters.properties.query).toBeDefined();
      expect(schema.parameters.required).toContain('query');
    });

    it('should provide agent capabilities', () => {
      const emailCapabilities = EmailAgent.getCapabilities();
      const contactCapabilities = ContactAgent.getCapabilities();
      const calendarCapabilities = CalendarAgent.getCapabilities();

      expect(emailCapabilities).toBeInstanceOf(Array);
      expect(emailCapabilities.length).toBeGreaterThan(0);
      expect(emailCapabilities[0]).toContain('Send new emails');

      expect(contactCapabilities).toBeInstanceOf(Array);
      expect(contactCapabilities.length).toBeGreaterThan(0);
      expect(contactCapabilities[0]).toContain('Search contacts');

      expect(calendarCapabilities).toBeInstanceOf(Array);
      expect(calendarCapabilities.length).toBeGreaterThan(0);
      expect(calendarCapabilities[0]).toContain('Create calendar events');
    });

    it('should provide agent limitations', () => {
      const emailLimitations = EmailAgent.getLimitations();
      const contactLimitations = ContactAgent.getLimitations();
      const calendarLimitations = CalendarAgent.getLimitations();

      expect(emailLimitations).toBeInstanceOf(Array);
      expect(emailLimitations.length).toBeGreaterThan(0);
      expect(emailLimitations[0]).toContain('Requires Gmail API');

      expect(contactLimitations).toBeInstanceOf(Array);
      expect(contactLimitations.length).toBeGreaterThan(0);
      expect(contactLimitations[0]).toContain('Requires Google Contacts');

      expect(calendarLimitations).toBeInstanceOf(Array);
      expect(calendarLimitations.length).toBeGreaterThan(0);
      expect(calendarLimitations[0]).toContain('Requires Google Calendar');
    });
  });

  describe('MasterAgent AI Planning', () => {
    let masterAgent: MasterAgent;

    beforeEach(() => {
      masterAgent = new MasterAgent({ openaiApiKey: 'test-key' });
    });

    it('should initialize agent schemas', () => {
      const schemas = masterAgent.getAgentSchemas();
      
      expect(schemas).toBeDefined();
      expect(schemas.length).toBeGreaterThan(0);
      
      const schemaNames = schemas.map(s => s.name);
      expect(schemaNames).toContain('send_email');
      expect(schemaNames).toContain('search_contacts');
      expect(schemaNames).toContain('manage_calendar');
    });

    it('should provide agent capabilities', () => {
      const capabilities = masterAgent.getAgentCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.emailAgent).toBeDefined();
      expect(capabilities.contactAgent).toBeDefined();
      expect(capabilities.calendarAgent).toBeDefined();
      
      expect(capabilities.emailAgent.capabilities).toBeInstanceOf(Array);
      expect(capabilities.contactAgent.capabilities).toBeInstanceOf(Array);
      expect(capabilities.calendarAgent.capabilities).toBeInstanceOf(Array);
    });

    it('should detect contact lookup requirements', () => {
      // Test with person name (should require contact lookup)
      const needsLookup1 = masterAgent['needsContactLookup']('Send email to John Smith');
      expect(needsLookup1).toBe(true);

      // Test with email address (should not require contact lookup)
      const needsLookup2 = masterAgent['needsContactLookup']('Send email to john@example.com');
      expect(needsLookup2).toBe(false);

      // Test with mixed content
      const needsLookup3 = masterAgent['needsContactLookup']('Email John Smith at john@example.com');
      expect(needsLookup3).toBe(false); // Has email address
    });
  });

  describe('AgentFactory Enhanced Functions', () => {
    it('should generate enhanced OpenAI functions', () => {
      const functions = AgentFactory.generateEnhancedOpenAIFunctions();
      
      expect(functions).toBeDefined();
      expect(functions.length).toBeGreaterThan(0);
      
      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('send_email');
      expect(functionNames).toContain('search_contacts');
      expect(functionNames).toContain('manage_calendar');
    });

    it('should provide agent discovery metadata', () => {
      const metadata = AgentFactory.getAgentDiscoveryMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.emailAgent).toBeDefined();
      expect(metadata.contactAgent).toBeDefined();
      expect(metadata.calendarAgent).toBeDefined();
      
      // Check schema structure
      expect(metadata.emailAgent.schema).toBeDefined();
      expect(metadata.emailAgent.schema.name).toBe('send_email');
      
      // Check capabilities
      expect(metadata.emailAgent.capabilities).toBeInstanceOf(Array);
      expect(metadata.emailAgent.limitations).toBeInstanceOf(Array);
      
      // Check enabled status
      expect(typeof metadata.emailAgent.enabled).toBe('boolean');
    });
  });

  describe('Agent Discovery and Routing', () => {
    it('should find matching tools for email requests', () => {
      const emailTools = AgentFactory.findMatchingTools('send email to john');
      
      expect(emailTools).toBeDefined();
      expect(emailTools.length).toBeGreaterThan(0);
      
      const toolNames = emailTools.map(t => t.name);
      expect(toolNames).toContain('emailAgent');
    });

    it('should find matching tools for contact requests', () => {
      const contactTools = AgentFactory.findMatchingTools('find contact for sarah');
      
      expect(contactTools).toBeDefined();
      expect(contactTools.length).toBeGreaterThan(0);
      
      const toolNames = contactTools.map(t => t.name);
      expect(toolNames).toContain('contactAgent');
    });

    it('should find matching tools for calendar requests', () => {
      const calendarTools = AgentFactory.findMatchingTools('schedule meeting tomorrow');
      
      expect(calendarTools).toBeDefined();
      expect(calendarTools.length).toBeGreaterThan(0);
      
      const toolNames = calendarTools.map(t => t.name);
      expect(toolNames).toContain('calendarAgent');
    });

    it('should validate agent availability', () => {
      expect(AgentFactory.hasAgent('emailAgent')).toBe(true);
      expect(AgentFactory.hasAgent('contactAgent')).toBe(true);
      expect(AgentFactory.hasAgent('calendarAgent')).toBe(true);
      expect(AgentFactory.hasAgent('nonexistentAgent')).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    it('should maintain 2-second response requirement for agent discovery', () => {
      const startTime = Date.now();
      
      // Test agent discovery operations
      AgentFactory.getAgentDiscoveryMetadata();
      AgentFactory.generateEnhancedOpenAIFunctions();
      AgentFactory.findMatchingTools('test query');
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(2000); // 2 seconds
    });

    it('should efficiently generate agent schemas', () => {
      const startTime = Date.now();
      
      // Generate schemas multiple times
      for (let i = 0; i < 10; i++) {
        EmailAgent.getOpenAIFunctionSchema();
        ContactAgent.getOpenAIFunctionSchema();
        CalendarAgent.getOpenAIFunctionSchema();
      }
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // 1 second for 30 operations
    });
  });

  describe('Error Handling', () => {
    it('should handle missing agent gracefully', () => {
      const agent = AgentFactory.getAgent('nonexistentAgent');
      expect(agent).toBeUndefined();
    });

    it('should handle invalid parameters gracefully', () => {
      const emailAgent = new EmailAgent();
      
      // Test with invalid parameters
      expect(() => {
        emailAgent['validateParams']({ query: null } as any);
      }).toThrow();
    });

    it('should provide fallback for OpenAI service unavailability', () => {
      const masterAgent = new MasterAgent(); // No OpenAI key
      const openaiService = masterAgent.getOpenAIService();
      expect(openaiService).toBeNull();
    });
  });
});
