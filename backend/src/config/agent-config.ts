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
    isReadOnly: true
  },
  
  email: {
    keywords: AGENT_KEYWORDS.email,
    description: 'Send, reply to, search, and manage emails using Gmail API',
    requiresConfirmation: true,
    isCritical: true,
    /** Requires Google OAuth access token */
    requiresAuth: true,
    /** Can modify external state (send emails) */
    hasExternalEffects: true
  },
  
  contact: {
    keywords: AGENT_KEYWORDS.contact,
    description: 'Search and manage contacts from Google Contacts and email history',
    requiresConfirmation: false,
    isCritical: true,
    /** Requires Google OAuth access token */
    requiresAuth: true,
    /** Read-only access to contacts */
    isReadOnly: true
  },
  
  calendar: {
    keywords: AGENT_KEYWORDS.calendar,
    description: 'Create, update, and manage calendar events',
    requiresConfirmation: true,
    isCritical: true,
    /** Requires Google OAuth access token */
    requiresAuth: true,
    /** Can modify external state (create events) */
    hasExternalEffects: true
  },
  
  content: {
    keywords: AGENT_KEYWORDS.content,
    description: 'Create blog posts, articles, and other written content',
    requiresConfirmation: false,
    isCritical: false,
    /** No external authentication required */
    requiresAuth: false,
    /** Generates content but doesn't publish externally */
    hasExternalEffects: false
  },
  
  search: {
    keywords: AGENT_KEYWORDS.search,
    description: 'Search the web for information using Tavily API',
    requiresConfirmation: false,
    isCritical: false,
    /** Uses Tavily API key from environment */
    requiresAuth: false,
    /** Read-only web search */
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
  }
};