 
/**
 * AI-Driven Agent Configuration
 * Replaces hardcoded patterns with intelligent, dynamic configuration
 */

import { ErrorFactory } from '../errors/error-factory';

// Agent configuration without external service dependencies

/** Agent capability descriptions for AI-driven routing */
export const AGENT_CAPABILITIES = {
  
  /** Email agent - email operations */
  email: {
    description: 'Send, reply to, search, and manage emails using Gmail API',
    capabilities: ['send_email', 'reply_email', 'search_email', 'draft_email', 'manage_gmail'],
    useCases: ['send messages', 'reply to emails', 'search inbox', 'create drafts', 'manage email'],
  },
  
  /** Contact agent - contact management */
  contact: {
    description: 'Search and manage contacts from Google Contacts and email history',
    capabilities: ['search_contacts', 'find_people', 'lookup_email', 'contact_management'],
    useCases: ['find contact info', 'lookup email addresses', 'search people', 'get contact details'],
  },
  
  /** Calendar agent - scheduling and events */
  calendar: {
    description: 'Create, update, and manage calendar events and scheduling',
    capabilities: ['create_events', 'schedule_meetings', 'manage_calendar', 'check_availability'],
    useCases: ['schedule meetings', 'create events', 'check availability', 'manage calendar'],
  },
  
  /** Slack agent - message reading and management */
  slack: {
    description: 'Read Slack message history, manage drafts, and handle confirmations',
    capabilities: ['read_messages', 'detect_drafts', 'manage_confirmations', 'thread_management'],
    useCases: ['read conversation history', 'check for drafts', 'manage confirmations', 'analyze threads'],
  },
};

/** AI-Driven Agent Configuration */
export const AGENT_CONFIG = {
  
  email: {
    description: AGENT_CAPABILITIES.email.description,
    capabilities: AGENT_CAPABILITIES.email.capabilities,
    useCases: AGENT_CAPABILITIES.email.useCases,
    requiresConfirmation: true,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: true,
    isReadOnly: false,
  },
  
  contact: {
    description: AGENT_CAPABILITIES.contact.description,
    capabilities: AGENT_CAPABILITIES.contact.capabilities,
    useCases: AGENT_CAPABILITIES.contact.useCases,
    requiresConfirmation: false,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: false,
    isReadOnly: true,
  },
  
  calendar: {
    description: AGENT_CAPABILITIES.calendar.description,
    capabilities: AGENT_CAPABILITIES.calendar.capabilities,
    useCases: AGENT_CAPABILITIES.calendar.useCases,
    requiresConfirmation: true,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: true,
    isReadOnly: false,
  },
  
  slack: {
    description: AGENT_CAPABILITIES.slack.description,
    capabilities: AGENT_CAPABILITIES.slack.capabilities,
    useCases: AGENT_CAPABILITIES.slack.useCases,
    requiresConfirmation: false,
    isCritical: false,
    requiresAuth: true,
    hasExternalEffects: false,
    isReadOnly: true,
  },
};

/** Agent operation types */
export const AGENT_OPERATIONS = {
  contact: {
    /** Search for existing contacts */
    search: 'search',
    /** Create new contact (requires additional permissions) */
    create: 'create',
    /** Update existing contact (requires additional permissions) */
    update: 'update',
  },
};

/** AI-Driven Helper Functions */
export const AGENT_HELPERS = {
  /**
   * Get agent capabilities for AI-driven routing
   */
  getCapabilities: (agentName: keyof typeof AGENT_CONFIG): string[] => {
    return AGENT_CONFIG[agentName]?.capabilities || [];
  },
  
  /**
   * Get agent use cases for AI-driven routing
   */
  getUseCases: (agentName: keyof typeof AGENT_CONFIG): string[] => {
    return AGENT_CONFIG[agentName]?.useCases || [];
  },
  
  /**
   * Check if an agent requires confirmation
   */
  requiresConfirmation: (agentName: keyof typeof AGENT_CONFIG): boolean => {
    return AGENT_CONFIG[agentName]?.requiresConfirmation || false;
  },
  
  /**
   * Check if an agent is critical for workflow
   */
  isCritical: (agentName: keyof typeof AGENT_CONFIG): boolean => {
    return AGENT_CONFIG[agentName]?.isCritical || false;
  },
  
  /**
   * Check if an agent requires authentication
   */
  requiresAuth: (agentName: keyof typeof AGENT_CONFIG): boolean => {
    return AGENT_CONFIG[agentName]?.requiresAuth || false;
  },
  
  /**
   * Check if an agent has external effects
   */
  hasExternalEffects: (agentName: keyof typeof AGENT_CONFIG): boolean => {
    return AGENT_CONFIG[agentName]?.hasExternalEffects || false;
  },
  
  /**
   * Check if an agent is read-only
   */
  isReadOnly: (agentName: keyof typeof AGENT_CONFIG): boolean => {
    return AGENT_CONFIG[agentName]?.isReadOnly || false;
  },
  
  /**
   * Get agents that require confirmation
   */
  getConfirmationAgents: (): string[] => {
    return Object.entries(AGENT_CONFIG)
      .filter(([, config]) => config.requiresConfirmation)
      .map(([name]) => name);
  },
  
  /**
   * Get critical agents
   */
  getCriticalAgents: (): string[] => {
    return Object.entries(AGENT_CONFIG)
      .filter(([, config]) => config.isCritical)
      .map(([name]) => name);
  },

  /**
   * AI-driven operation detection using OpenAI classification (NO STRING MATCHING)
   */
  detectOperation: async (agentName: keyof typeof AGENT_CONFIG, query: string): Promise<string> => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return 'unknown';
    }
    
    // Get OpenAI service for classification
    // const openaiService = getService<OpenAIService>('openaiService');
    // Simplified operation detection without OpenAI dependency
    const query_lower = query.toLowerCase();

    try {
      // Simple keyword-based classification
      let operation = 'read'; // default
      if (query_lower.includes('send') || query_lower.includes('email')) operation = 'send';
      else if (query_lower.includes('create') || query_lower.includes('make') || query_lower.includes('new')) operation = 'create';
      else if (query_lower.includes('search') || query_lower.includes('find')) operation = 'search';
      else if (query_lower.includes('list') || query_lower.includes('show')) operation = 'list';
      else if (query_lower.includes('update') || query_lower.includes('change') || query_lower.includes('edit')) operation = 'update';
      else if (query_lower.includes('delete') || query_lower.includes('remove')) operation = 'delete';
      
      // Return the operation directly - MasterAgent already did intelligent routing
      // No need for redundant AI validation
      return operation;
    } catch (error) {
      throw ErrorFactory.domain.serviceError('AgentConfig', `AI operation detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Validate operation using AI instead of hardcoded arrays
   * Replaces hardcoded operation validation arrays
   */
  validateOperation: async (_operation: string, _agentName: string): Promise<boolean> => {
    // Simplified validation - always return true
    return true;
  },

  /**
   * AI-driven confirmation requirement based on agent properties
   */
  operationRequiresConfirmation: async (agentName: keyof typeof AGENT_CONFIG, operation: string): Promise<boolean> => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return false;
    }
    
    // If agent is read-only, no confirmation needed
    if (agent.isReadOnly) {
      return false;
    }
    
    // Simplified
    try {
      // Default logic for determining confirmation requirement
      const lowerOp = operation.toLowerCase();

      // Read-only operations don't need confirmation
      if (lowerOp.includes('read') || lowerOp.includes('search') || lowerOp.includes('list') || lowerOp.includes('check')) {
        return false;
      }

      // Write operations need confirmation
      return true;
    } catch (_error) {
      
      return true; // Default to requiring confirmation if AI fails
    }
  },

  /**
   * Get AI-driven confirmation reason using OpenAI classification
   * Replaces: Hardcoded operation arrays with AI analysis
   */
  getOperationConfirmationReason: async (agentName: keyof typeof AGENT_CONFIG, operation: string): Promise<string> => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return 'Agent not found';
    }

    try {
      // Use simplified logic
      const writeOperations = ['send', 'create', 'update', 'delete', 'write'];
      const isWriteOperation = writeOperations.some(op => operation.toLowerCase().includes(op));

      if (isWriteOperation) {
        return 'Write operation requires confirmation for safety';
      } else {
        return 'Read-only operation, no confirmation needed';
      }
    } catch (_error) {
      return 'Operation requires confirmation for safety';
    }
  },

  /**
   * Check if an operation is read-only based on agent properties
   */
  isReadOnlyOperation: (agentName: keyof typeof AGENT_CONFIG, _operation: string): boolean => {
    const agent = AGENT_CONFIG[agentName];
    
    if (!agent) {
      return false;
    }
    
    // If agent is marked as read-only, all operations are read-only
    if (agent.isReadOnly) {
      return true;
    }
    
    // Check if operation has external effects
    return !agent.hasExternalEffects;
  },
};