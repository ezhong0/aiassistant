/**
 * Centralized agent configuration
 * Contains keywords, descriptions, and behavioral settings for all agents
 */

/** Keywords used for routing user queries to specific agents */
export const AGENT_KEYWORDS = {
  /** Think agent - analysis and verification */
  think: ['think', 'analyze', 'reason', 'verify', 'check'],
  
  /** Email agent - email operations */
  email: ['email', 'send', 'reply', 'draft', 'message', 'mail', 'gmail'],
  
  /** Contact agent - contact management */
  contact: ['contact', 'find', 'lookup', 'search', 'person', 'email address'],
  
  /** Calendar agent - scheduling and events */
  calendar: ['calendar', 'meeting', 'schedule', 'event', 'appointment', 'book'],
  
  /** Content creator - writing and content generation */
  content: ['blog', 'write', 'create', 'content', 'article', 'post', 'draft'],
  
  /** Tavily agent - web search */
  search: ['search', 'web', 'find', 'lookup', 'internet', 'what is', 'who is']
};

/** Confirmation words for user responses */
export const CONFIRMATION_WORDS = {
  /** Words that indicate user confirmation/approval */
  confirm: ['yes', 'y', 'confirm', 'ok', 'okay', 'proceed', 'go ahead', 'do it'],
  
  /** Words that indicate user rejection/cancellation */
  reject: ['no', 'n', 'cancel', 'abort', 'stop', 'nevermind', 'never mind']
};

/** Agent behavioral configuration */
export const AGENT_CONFIG = {
  think: {
    keywords: AGENT_KEYWORDS.think,
    description: 'Analyze and reason about user requests, verify correct actions were taken',
    requiresConfirmation: false,
    isCritical: false,
    /** Used for analysis without executing actual actions */
    isReadOnly: true,
    /** Operation-specific confirmation rules */
    operationConfirmation: {
      analyze: { requiresConfirmation: false, reason: 'Read-only analysis operation' },
      verify: { requiresConfirmation: false, reason: 'Read-only verification operation' },
      check: { requiresConfirmation: false, reason: 'Read-only check operation' }
    }
  },
  
  email: {
    keywords: AGENT_KEYWORDS.email,
    description: 'Send, reply to, search, and manage emails using Gmail API',
    requiresConfirmation: true,
    isCritical: true,
    /** Requires Google OAuth access token */
    requiresAuth: true,
    /** Can modify external state (send emails) */
    hasExternalEffects: true,
    /** Operation-specific confirmation rules */
    operationConfirmation: {
      // Read operations - no confirmation needed
      search: { requiresConfirmation: false, reason: 'Read-only email search operation' },
      get: { requiresConfirmation: false, reason: 'Read-only email retrieval operation' },
      list: { requiresConfirmation: false, reason: 'Read-only email listing operation' },
      find: { requiresConfirmation: false, reason: 'Read-only email finding operation' },
      show: { requiresConfirmation: false, reason: 'Read-only email display operation' },
      
      // Write operations - confirmation required
      send: { requiresConfirmation: true, reason: 'Email sending modifies external state' },
      reply: { requiresConfirmation: true, reason: 'Email reply modifies external state' },
      draft: { requiresConfirmation: true, reason: 'Draft creation modifies external state' },
      create: { requiresConfirmation: true, reason: 'Email creation modifies external state' },
      update: { requiresConfirmation: true, reason: 'Email update modifies external state' },
      delete: { requiresConfirmation: true, reason: 'Email deletion modifies external state' }
    }
  },
  
  contact: {
    keywords: AGENT_KEYWORDS.contact,
    description: 'Search and manage contacts from Google Contacts and email history',
    requiresConfirmation: false,
    isCritical: true,
    /** Requires Google OAuth access token */
    requiresAuth: true,
    /** Read-only access to contacts */
    isReadOnly: true,
    /** Operation-specific confirmation rules */
    operationConfirmation: {
      search: { requiresConfirmation: false, reason: 'Read-only contact search operation' },
      find: { requiresConfirmation: false, reason: 'Read-only contact finding operation' },
      lookup: { requiresConfirmation: false, reason: 'Read-only contact lookup operation' },
      get: { requiresConfirmation: false, reason: 'Read-only contact retrieval operation' },
      list: { requiresConfirmation: false, reason: 'Read-only contact listing operation' },
      show: { requiresConfirmation: false, reason: 'Read-only contact display operation' }
    }
  },
  
  calendar: {
    keywords: AGENT_KEYWORDS.calendar,
    description: 'Create, update, and manage calendar events',
    requiresConfirmation: true,
    isCritical: true,
    /** Requires Google OAuth access token */
    requiresAuth: true,
    /** Can modify external state (create events) */
    hasExternalEffects: true,
    /** Operation-specific confirmation rules */
    operationConfirmation: {
      // Read operations - no confirmation needed
      list: { requiresConfirmation: false, reason: 'Read-only calendar listing operation' },
      get: { requiresConfirmation: false, reason: 'Read-only calendar retrieval operation' },
      show: { requiresConfirmation: false, reason: 'Read-only calendar display operation' },
      check: { requiresConfirmation: false, reason: 'Read-only availability check operation' },
      find: { requiresConfirmation: false, reason: 'Read-only slot finding operation' },
      search: { requiresConfirmation: false, reason: 'Read-only calendar search operation' },
      
      // Write operations - confirmation required
      create: { requiresConfirmation: true, reason: 'Calendar event creation modifies external state' },
      schedule: { requiresConfirmation: true, reason: 'Calendar scheduling modifies external state' },
      book: { requiresConfirmation: true, reason: 'Calendar booking modifies external state' },
      update: { requiresConfirmation: true, reason: 'Calendar event update modifies external state' },
      modify: { requiresConfirmation: true, reason: 'Calendar event modification modifies external state' },
      delete: { requiresConfirmation: true, reason: 'Calendar event deletion modifies external state' },
      cancel: { requiresConfirmation: true, reason: 'Calendar event cancellation modifies external state' }
    }
  },
  
  content: {
    keywords: AGENT_KEYWORDS.content,
    description: 'Create blog posts, articles, and other written content',
    requiresConfirmation: false,
    isCritical: false,
    /** No external authentication required */
    requiresAuth: false,
    /** Generates content but doesn't publish externally */
    hasExternalEffects: false,
    /** Operation-specific confirmation rules */
    operationConfirmation: {
      create: { requiresConfirmation: false, reason: 'Content creation is local operation' },
      write: { requiresConfirmation: false, reason: 'Content writing is local operation' },
      generate: { requiresConfirmation: false, reason: 'Content generation is local operation' },
      draft: { requiresConfirmation: false, reason: 'Content drafting is local operation' }
    }
  },
  
  search: {
    keywords: AGENT_KEYWORDS.search,
    description: 'Search the web for information using Tavily API',
    requiresConfirmation: false,
    isCritical: false,
    /** Uses Tavily API key from environment */
    requiresAuth: false,
    /** Read-only web search */
    isReadOnly: true,
    /** Operation-specific confirmation rules */
    operationConfirmation: {
      search: { requiresConfirmation: false, reason: 'Read-only web search operation' },
      find: { requiresConfirmation: false, reason: 'Read-only web finding operation' },
      lookup: { requiresConfirmation: false, reason: 'Read-only web lookup operation' },
      query: { requiresConfirmation: false, reason: 'Read-only web query operation' }
    }
  }
};

/** Natural language patterns for agent routing */
export const ROUTING_PATTERNS = {
  /** Patterns that require contact lookup before main action */
  needsContactLookup: {
    /** Patterns for email operations that mention person names */
    email: [
      /(?:email|send|message).*?(?:to|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
      /send.*?(?:to|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
    ],
    /** Patterns for calendar operations with attendees */
    calendar: [
      /(?:meeting|schedule|event).*?(?:with|invite)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
      /schedule.*?(?:with|invite)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
    ]
  },
  
  /** Patterns that indicate email addresses are already provided */
  hasEmailAddress: /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  
  /** Patterns for extracting contact names */
  contactName: [
    /(?:email|send|to|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
    /(?:meeting with|schedule with|invite)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
  ]
};

/** Agent operation types */
export const AGENT_OPERATIONS = {
  contact: {
    /** Search for existing contacts */
    search: 'search',
    /** Create new contact (requires additional permissions) */
    create: 'create',
    /** Update existing contact (requires additional permissions) */
    update: 'update'
  },
  
  content: {
    /** Content format options */
    formats: ['blog', 'article', 'social', 'email'] as const,
    /** Content length options */
    lengths: ['short', 'medium', 'long'] as const,
    /** Content tone options */
    tones: ['professional', 'casual', 'friendly', 'formal'] as const
  },
  
  search: {
    /** Search depth options for Tavily */
    depths: ['basic', 'advanced']
  }
};

/** Helper functions for agent configuration */
export const AGENT_HELPERS = {
  /**
   * Get all keywords for a specific agent
   */
  getKeywords: (agentName: keyof typeof AGENT_CONFIG): string[] => {
    return AGENT_CONFIG[agentName]?.keywords || [];
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
    const agent = AGENT_CONFIG[agentName];
    return (agent && 'requiresAuth' in agent && agent.requiresAuth) || false;
  },
  
  /**
   * Get agents that require confirmation
   */
  getConfirmationAgents: (): string[] => {
    return Object.entries(AGENT_CONFIG)
      .filter(([_, config]) => config.requiresConfirmation)
      .map(([name]) => name);
  },
  
  /**
   * Get critical agents
   */
  getCriticalAgents: (): string[] => {
    return Object.entries(AGENT_CONFIG)
      .filter(([_, config]) => config.isCritical)
      .map(([name]) => name);
  },

  /**
   * Check if a specific operation for an agent requires confirmation
   */
  operationRequiresConfirmation: (agentName: keyof typeof AGENT_CONFIG, operation: string): boolean => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return false;
    }
    
    // Check if agent has operation-specific confirmation rules
    if ('operationConfirmation' in agent && agent.operationConfirmation) {
      const operationConfig = (agent as any).operationConfirmation[operation];
      if (operationConfig) {
        return operationConfig.requiresConfirmation;
      }
    }
    
    // Fall back to agent-level confirmation requirement
    return 'requiresConfirmation' in agent ? agent.requiresConfirmation : false;
  },

  /**
   * Get the reason why an operation requires or doesn't require confirmation
   */
  getOperationConfirmationReason: (agentName: keyof typeof AGENT_CONFIG, operation: string): string => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return 'Agent not found';
    }
    
    // Check if agent has operation-specific confirmation rules
    if ('operationConfirmation' in agent && agent.operationConfirmation) {
      const operationConfig = (agent as any).operationConfirmation[operation];
      if (operationConfig) {
        return operationConfig.reason;
      }
    }
    
    // Fall back to agent-level requirement
    const agentRequiresConfirmation = 'requiresConfirmation' in agent ? agent.requiresConfirmation : false;
    return agentRequiresConfirmation ? 'Agent-level confirmation required' : 'Agent-level confirmation not required';
  },

  /**
   * Detect operation type from user query for an agent
   */
  detectOperation: (agentName: keyof typeof AGENT_CONFIG, query: string): string => {
    const lowerQuery = query.toLowerCase();
    const agent = AGENT_CONFIG[agentName];
    
    if (!agent || !('operationConfirmation' in agent) || !agent.operationConfirmation) {
      return 'unknown';
    }
    
    const operationConfirmation = (agent as any).operationConfirmation;
    const operations = Object.keys(operationConfirmation);
    
    // Check for exact operation matches first
    for (const operation of operations) {
      if (lowerQuery.includes(operation)) {
        return operation;
      }
    }
    
    // Check for common operation patterns
    const operationPatterns: Record<string, string[]> = {
      search: ['search', 'find', 'look for', 'lookup', 'query'],
      get: ['get', 'retrieve', 'fetch', 'show', 'display'],
      list: ['list', 'show all', 'display all'],
      send: ['send', 'email', 'message'],
      reply: ['reply', 'respond', 'answer'],
      create: ['create', 'make', 'new', 'add'],
      update: ['update', 'modify', 'change', 'edit'],
      delete: ['delete', 'remove', 'cancel'],
      schedule: ['schedule', 'book', 'plan', 'arrange'],
      check: ['check', 'verify', 'confirm availability']
    };
    
    for (const [operation, patterns] of Object.entries(operationPatterns)) {
      if (operations.includes(operation)) {
        for (const pattern of patterns) {
          if (lowerQuery.includes(pattern)) {
            return operation;
          }
        }
      }
    }
    
    return 'unknown';
  },

  /**
   * Check if an operation is read-only
   */
  isReadOnlyOperation: (agentName: keyof typeof AGENT_CONFIG, operation: string): boolean => {
    const agent = AGENT_CONFIG[agentName];
    
    if (!agent) {
      return false;
    }
    
    // If agent is marked as read-only, all operations are read-only
    if ('isReadOnly' in agent && agent.isReadOnly) {
      return true;
    }
    
    // Check operation-specific rules
    const requiresConfirmation = AGENT_HELPERS.operationRequiresConfirmation(agentName, operation);
    return !requiresConfirmation;
  }
};