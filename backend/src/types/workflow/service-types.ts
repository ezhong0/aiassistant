/**
 * Service and Agent Type Enums for Type-Safe References
 *
 * Eliminates magic strings throughout the codebase and provides
 * compile-time safety for service and agent references.
 */

/**
 * Available service types in the service manager
 */
export enum ServiceType {
  // Core services
  GENERIC_AI = 'genericAIService',
  CONTEXT_MANAGER = 'contextManager',
  TOKEN_MANAGER = 'tokenManager',
  WORKFLOW_TOKEN = 'workflowTokenService',

  // Storage and database services
  DATABASE = 'databaseService',
  TOKEN_STORAGE = 'tokenStorageService',
  CACHE = 'cacheService',

  // Authentication and security
  AUTH = 'authService',
  CRYPTO = 'cryptoService',

  // External service integrations
  GOOGLE_CALENDAR = 'googleCalendarService',
  GMAIL = 'gmailService',
  GOOGLE_CONTACTS = 'googleContactsService',
  SLACK = 'slackService',

  // Utility services
  EMAIL_VALIDATION = 'emailValidationService',
  RATE_LIMITER = 'rateLimiterService',
  AUDIT_LOGGER = 'auditLoggerService'
}

/**
 * Available agent types for execution
 */
export enum AgentType {
  // Domain-specific agents
  EMAIL = 'emailAgent',
  CALENDAR = 'calendarAgent',
  CONTACT = 'contactAgent',
  SLACK = 'slackAgent',

  // Meta agents
  MASTER = 'masterAgent',
  ORCHESTRATOR = 'orchestratorAgent'
}

/**
 * Agent capabilities mapping for validation
 */
export const AGENT_CAPABILITIES = {
  [AgentType.EMAIL]: ['send', 'search', 'reply', 'read', 'draft', 'delete'],
  [AgentType.CALENDAR]: ['create', 'update', 'delete', 'list', 'check', 'find'],
  [AgentType.CONTACT]: ['search', 'create', 'update', 'delete', 'list', 'validate'],
  [AgentType.SLACK]: ['read', 'analyze', 'summarize', 'search', 'thread']
} as const;

/**
 * Type for agent operations
 */
export type AgentOperation<T extends AgentType> = typeof AGENT_CAPABILITIES[T][number];

/**
 * Service dependency mapping for validation
 */
export const SERVICE_DEPENDENCIES = {
  [ServiceType.GENERIC_AI]: [],
  [ServiceType.CONTEXT_MANAGER]: [ServiceType.CACHE],
  [ServiceType.TOKEN_MANAGER]: [ServiceType.TOKEN_STORAGE, ServiceType.AUTH, ServiceType.CACHE],
  [ServiceType.WORKFLOW_TOKEN]: [ServiceType.TOKEN_MANAGER],
  [ServiceType.DATABASE]: [],
  [ServiceType.TOKEN_STORAGE]: [ServiceType.DATABASE, ServiceType.CRYPTO],
  [ServiceType.CACHE]: [],
  [ServiceType.AUTH]: [ServiceType.DATABASE],
  [ServiceType.CRYPTO]: [],
  [ServiceType.GOOGLE_CALENDAR]: [ServiceType.AUTH, ServiceType.TOKEN_MANAGER],
  [ServiceType.GMAIL]: [ServiceType.AUTH, ServiceType.TOKEN_MANAGER],
  [ServiceType.GOOGLE_CONTACTS]: [ServiceType.AUTH, ServiceType.TOKEN_MANAGER],
  [ServiceType.SLACK]: [ServiceType.AUTH, ServiceType.TOKEN_MANAGER],
  [ServiceType.EMAIL_VALIDATION]: [],
  [ServiceType.RATE_LIMITER]: [ServiceType.CACHE],
  [ServiceType.AUDIT_LOGGER]: [ServiceType.DATABASE]
} as const;

/**
 * Agent to service mapping for automatic service resolution
 */
export const AGENT_SERVICE_MAPPING = {
  [AgentType.EMAIL]: [ServiceType.GMAIL, ServiceType.TOKEN_MANAGER],
  [AgentType.CALENDAR]: [ServiceType.GOOGLE_CALENDAR, ServiceType.TOKEN_MANAGER],
  [AgentType.CONTACT]: [ServiceType.GOOGLE_CONTACTS, ServiceType.TOKEN_MANAGER],
  [AgentType.SLACK]: [ServiceType.SLACK, ServiceType.TOKEN_MANAGER],
  [AgentType.MASTER]: [ServiceType.GENERIC_AI, ServiceType.CONTEXT_MANAGER, ServiceType.WORKFLOW_TOKEN],
  [AgentType.ORCHESTRATOR]: [ServiceType.GENERIC_AI, ServiceType.CONTEXT_MANAGER]
} as const;

/**
 * Service initialization priority (lower numbers initialize first)
 */
export const SERVICE_INIT_PRIORITY = {
  [ServiceType.DATABASE]: 1,
  [ServiceType.CRYPTO]: 1,
  [ServiceType.CACHE]: 2,
  [ServiceType.AUTH]: 3,
  [ServiceType.TOKEN_STORAGE]: 4,
  [ServiceType.TOKEN_MANAGER]: 5,
  [ServiceType.WORKFLOW_TOKEN]: 6,
  [ServiceType.GENERIC_AI]: 3,
  [ServiceType.CONTEXT_MANAGER]: 4,
  [ServiceType.GOOGLE_CALENDAR]: 7,
  [ServiceType.GMAIL]: 7,
  [ServiceType.GOOGLE_CONTACTS]: 7,
  [ServiceType.SLACK]: 7,
  [ServiceType.EMAIL_VALIDATION]: 3,
  [ServiceType.RATE_LIMITER]: 4,
  [ServiceType.AUDIT_LOGGER]: 5
} as const;

/**
 * Type guards for runtime validation
 */
export function isValidServiceType(value: string): value is ServiceType {
  return Object.values(ServiceType).includes(value as ServiceType);
}

export function isValidAgentType(value: string): value is AgentType {
  return Object.values(AgentType).includes(value as AgentType);
}

export function isValidAgentOperation<T extends AgentType>(
  agentType: T,
  operation: string
): operation is AgentOperation<T> {
  return AGENT_CAPABILITIES[agentType].includes(operation as any);
}

/**
 * Validation error types
 */
export class ServiceValidationError extends Error {
  constructor(
    public readonly serviceType: string,
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ServiceValidationError';
  }
}

export class AgentValidationError extends Error {
  constructor(
    public readonly agentType: string,
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AgentValidationError';
  }
}