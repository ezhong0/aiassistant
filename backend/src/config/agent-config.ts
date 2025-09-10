/**
 * AI-Driven Agent Configuration
 * Replaces hardcoded patterns with intelligent, dynamic configuration
 */

/** Agent capability descriptions for AI-driven routing */
export const AGENT_CAPABILITIES = {
  /** Think agent - analysis and verification */
  think: {
    description: 'Analyze and reason about user requests, verify correct actions were taken',
    capabilities: ['analysis', 'reasoning', 'verification', 'checking'],
    useCases: ['verify actions', 'analyze results', 'check correctness', 'reason about problems']
  },
  
  /** Email agent - email operations */
  email: {
    description: 'Send, reply to, search, and manage emails using Gmail API',
    capabilities: ['send_email', 'reply_email', 'search_email', 'draft_email', 'manage_gmail'],
    useCases: ['send messages', 'reply to emails', 'search inbox', 'create drafts', 'manage email']
  },
  
  /** Contact agent - contact management */
  contact: {
    description: 'Search and manage contacts from Google Contacts and email history',
    capabilities: ['search_contacts', 'find_people', 'lookup_email', 'contact_management'],
    useCases: ['find contact info', 'lookup email addresses', 'search people', 'get contact details']
  },
  
  /** Calendar agent - scheduling and events */
  calendar: {
    description: 'Create, update, and manage calendar events and scheduling',
    capabilities: ['create_events', 'schedule_meetings', 'manage_calendar', 'check_availability'],
    useCases: ['schedule meetings', 'create events', 'check availability', 'manage calendar']
  },
  
  /** Content creator - writing and content generation */
  content: {
    description: 'Create blog posts, articles, and other written content',
    capabilities: ['write_content', 'create_articles', 'generate_text', 'content_creation'],
    useCases: ['write blog posts', 'create articles', 'generate content', 'write text']
  },
  
  /** Tavily agent - web search */
  search: {
    description: 'Search the web for information using Tavily API',
    capabilities: ['web_search', 'find_information', 'lookup_facts', 'research'],
    useCases: ['search web', 'find information', 'lookup facts', 'research topics']
  },
  
  /** Slack agent - message reading and management */
  slack: {
    description: 'Read Slack message history, manage drafts, and handle confirmations',
    capabilities: ['read_messages', 'detect_drafts', 'manage_confirmations', 'thread_management'],
    useCases: ['read conversation history', 'check for drafts', 'manage confirmations', 'analyze threads']
  }
};

/** Confirmation words for user responses */
export const CONFIRMATION_WORDS = {
  /** Words that indicate user confirmation/approval */
  confirm: ['yes', 'y', 'confirm', 'ok', 'okay', 'proceed', 'go ahead', 'do it'],
  
  /** Words that indicate user rejection/cancellation */
  reject: ['no', 'n', 'cancel', 'abort', 'stop', 'nevermind', 'never mind']
};

/** AI-Driven Agent Configuration */
export const AGENT_CONFIG = {
  think: {
    description: AGENT_CAPABILITIES.think.description,
    capabilities: AGENT_CAPABILITIES.think.capabilities,
    useCases: AGENT_CAPABILITIES.think.useCases,
    requiresConfirmation: false,
    isCritical: false,
    isReadOnly: true,
    requiresAuth: false,
    hasExternalEffects: false
  },
  
  email: {
    description: AGENT_CAPABILITIES.email.description,
    capabilities: AGENT_CAPABILITIES.email.capabilities,
    useCases: AGENT_CAPABILITIES.email.useCases,
    requiresConfirmation: true,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: true,
    isReadOnly: false
  },
  
  contact: {
    description: AGENT_CAPABILITIES.contact.description,
    capabilities: AGENT_CAPABILITIES.contact.capabilities,
    useCases: AGENT_CAPABILITIES.contact.useCases,
    requiresConfirmation: false,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: false,
    isReadOnly: true
  },
  
  calendar: {
    description: AGENT_CAPABILITIES.calendar.description,
    capabilities: AGENT_CAPABILITIES.calendar.capabilities,
    useCases: AGENT_CAPABILITIES.calendar.useCases,
    requiresConfirmation: true,
    isCritical: true,
    requiresAuth: true,
    hasExternalEffects: true,
    isReadOnly: false
  },
  
  content: {
    description: AGENT_CAPABILITIES.content.description,
    capabilities: AGENT_CAPABILITIES.content.capabilities,
    useCases: AGENT_CAPABILITIES.content.useCases,
    requiresConfirmation: false,
    isCritical: false,
    requiresAuth: false,
    hasExternalEffects: false,
    isReadOnly: false
  },
  
  search: {
    description: AGENT_CAPABILITIES.search.description,
    capabilities: AGENT_CAPABILITIES.search.capabilities,
    useCases: AGENT_CAPABILITIES.search.useCases,
    requiresConfirmation: false,
    isCritical: false,
    requiresAuth: false,
    hasExternalEffects: false,
    isReadOnly: true
  },
  
  slack: {
    description: AGENT_CAPABILITIES.slack.description,
    capabilities: AGENT_CAPABILITIES.slack.capabilities,
    useCases: AGENT_CAPABILITIES.slack.useCases,
    requiresConfirmation: false,
    isCritical: false,
    requiresAuth: true,
    hasExternalEffects: false,
    isReadOnly: true
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
   * AI-driven operation detection based on agent capabilities and use cases
   */
  detectOperation: (agentName: keyof typeof AGENT_CONFIG, query: string): string => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return 'unknown';
    }
    
    const lowerQuery = query.toLowerCase();
    const capabilities = agent.capabilities || [];
    const useCases = agent.useCases || [];
    
    // Check capabilities first
    for (const capability of capabilities) {
      if (lowerQuery.includes(capability.replace('_', ' '))) {
        return capability;
      }
    }
    
    // Check use cases
    for (const useCase of useCases) {
      if (lowerQuery.includes(useCase)) {
        return useCase.replace(' ', '_');
      }
    }
    
    // Fallback to common operation patterns
    const operationPatterns: Record<string, string[]> = {
      search: ['search', 'find', 'look for', 'lookup', 'query'],
      send: ['send', 'email', 'message'],
      create: ['create', 'make', 'new', 'add', 'schedule'],
      update: ['update', 'modify', 'change', 'edit'],
      delete: ['delete', 'remove', 'cancel'],
      list: ['list', 'show all', 'display all'],
      check: ['check', 'verify', 'confirm']
    };
    
    for (const [operation, patterns] of Object.entries(operationPatterns)) {
      for (const pattern of patterns) {
        if (lowerQuery.includes(pattern)) {
          return operation;
        }
      }
    }
    
    return 'unknown';
  },

  /**
   * AI-driven confirmation requirement based on agent properties
   */
  operationRequiresConfirmation: (agentName: keyof typeof AGENT_CONFIG, operation: string): boolean => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return false;
    }
    
    // If agent is read-only, no confirmation needed
    if (agent.isReadOnly) {
      return false;
    }
    
    // If agent has external effects, confirmation required
    if (agent.hasExternalEffects) {
      return true;
    }
    
    // Check specific operations that require confirmation
    const confirmationOperations = ['send', 'create', 'update', 'delete', 'schedule'];
    return confirmationOperations.includes(operation);
  },

  /**
   * Get AI-driven confirmation reason
   */
  getOperationConfirmationReason: (agentName: keyof typeof AGENT_CONFIG, operation: string): string => {
    const agent = AGENT_CONFIG[agentName];
    if (!agent) {
      return 'Agent not found';
    }
    
    if (agent.isReadOnly) {
      return 'Read-only operation, no confirmation needed';
    }
    
    if (agent.hasExternalEffects) {
      return 'Operation modifies external state, confirmation required';
    }
    
    const confirmationOperations = ['send', 'create', 'update', 'delete', 'schedule'];
    if (confirmationOperations.includes(operation)) {
      return 'Operation requires confirmation for safety';
    }
    
    return 'Operation does not require confirmation';
  },

  /**
   * Check if an operation is read-only based on agent properties
   */
  isReadOnlyOperation: (agentName: keyof typeof AGENT_CONFIG, operation: string): boolean => {
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
  }
};