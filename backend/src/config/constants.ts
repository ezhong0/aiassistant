/**
 * Centralized constants file for magic numbers and configuration values
 * Extracted from throughout the codebase for better maintainability
 */

/**
 * Application configuration constants
 */
export const APP_CONSTANTS = {
  /** Default timezone for calendar operations */
  DEFAULT_TIMEZONE: 'America/Los_Angeles',

  /** Memory usage warning threshold in MB */
  MEMORY_WARNING_THRESHOLD_MB: 400,

  /** Event processing cleanup threshold */
  EVENT_CLEANUP_THRESHOLD: 1000,

  /** Event TTL in milliseconds (1 hour) */
  EVENT_TTL_MS: 3600000,

  /** Cache cleanup interval in milliseconds (5 minutes) */
  CACHE_CLEANUP_INTERVAL_MS: 300000,
} as const;

/**
 * Session and timeout constants
 */
export const SESSION_CONSTANTS = {
  /** Session timeout in minutes */
  TIMEOUT_MINUTES: 30,
  
  /** Maximum retry attempts for operations */
  MAX_RETRY_ATTEMPTS: 3,
  
  /** Rate limit window in milliseconds (15 minutes) */
  RATE_LIMIT_WINDOW_MS: 900000,
  
  /** JWT token expiration */
  JWT_EXPIRY: '24h',
  
  /** Refresh token expiration */
  REFRESH_TOKEN_EXPIRY: '30d',
} as const;

/**
 * Email and communication constants
 */
export const EMAIL_CONSTANTS = {
  /** Maximum email results per search */
  MAX_SEARCH_RESULTS: 100,
  
  /** Default email search results */
  DEFAULT_SEARCH_RESULTS: 20,
  
  /** Maximum email body length for logging */
  MAX_LOG_BODY_LENGTH: 1000,
  
  /** Email thread context limit */
  THREAD_CONTEXT_LIMIT: 10,
} as const;

/**
 * Contact search and management constants
 */
export const CONTACT_CONSTANTS = {
  /** Maximum contacts returned per search */
  MAX_SEARCH_RESULTS: 50,
  
  /** Default number of contacts to return */
  DEFAULT_SEARCH_RESULTS: 10,
  
  /** Minimum confidence score for fuzzy matching */
  MIN_CONFIDENCE_SCORE: 0.6,
  
  /** High confidence threshold for disambiguation */
  HIGH_CONFIDENCE_THRESHOLD: 0.8,
  
  /** Maximum contact name length */
  MAX_NAME_LENGTH: 100,
} as const;

/**
 * API request and response constants
 */
export const API_CONSTANTS = {
  /** Maximum request body size */
  MAX_BODY_SIZE: '10mb',
  
  /** Maximum command length */
  MAX_COMMAND_LENGTH: 5000,
  
  /** Maximum session ID length */
  MAX_SESSION_ID_LENGTH: 100,
  
  /** Maximum access token length */
  MAX_ACCESS_TOKEN_LENGTH: 2000,
  
  /** Maximum conversation history entries */
  MAX_CONVERSATION_HISTORY: 10,
  
  /** Maximum content length per conversation entry */
  MAX_CONVERSATION_CONTENT_LENGTH: 10000,
  
  /** API version */
  API_VERSION: '1.0.0',
} as const;

/**
 * Tool execution constants
 */
export const TOOL_CONSTANTS = {
  /** Default tool execution timeout in milliseconds */
  EXECUTION_TIMEOUT_MS: 30000,
  
  /** Maximum concurrent tool executions */
  MAX_CONCURRENT_EXECUTIONS: 10,
  
  /** Maximum tool calls per request */
  MAX_TOOL_CALLS_PER_REQUEST: 5,
  
  /** Tool result cache duration in milliseconds */
  RESULT_CACHE_DURATION_MS: 300000, // 5 minutes
  
  /** Maximum tool response length for logging */
  MAX_LOG_RESPONSE_LENGTH: 2000,
} as const;

/**
 * OpenAI and AI service constants
 */
export const AI_CONSTANTS = {
  /** Default OpenAI model */
  DEFAULT_MODEL: 'gpt-4o-mini',
  
  /** Maximum tokens for completion */
  MAX_COMPLETION_TOKENS: 1000,
  
  /** Default temperature for responses */
  DEFAULT_TEMPERATURE: 0.7,
  
  /** Maximum conversation context length */
  MAX_CONTEXT_LENGTH: 4000,
  
  /** Response generation timeout */
  RESPONSE_TIMEOUT_MS: 60000,
} as const;

/**
 * Performance and monitoring constants
 */
export const PERFORMANCE_CONSTANTS = {
  /** Slow request threshold in milliseconds */
  SLOW_REQUEST_THRESHOLD_MS: 5000,
  
  /** Large response threshold in bytes */
  LARGE_RESPONSE_THRESHOLD_BYTES: 1048576, // 1MB
  
  /** Memory warning threshold in MB */
  MEMORY_WARNING_THRESHOLD_MB: 100,
  
  /** Maximum active sessions */
  MAX_ACTIVE_SESSIONS: 10000,
  
  /** Cleanup interval in milliseconds */
  CLEANUP_INTERVAL_MS: 300000, // 5 minutes
  
  /** Rate limit warning threshold (90% of max) */
  RATE_LIMIT_WARNING_THRESHOLD: 0.9,
} as const;

/**
 * Security constants
 */
export const SECURITY_CONSTANTS = {
  /** Maximum login attempts per hour */
  MAX_LOGIN_ATTEMPTS: 10,
  
  /** Account lockout duration in minutes */
  LOCKOUT_DURATION_MINUTES: 60,
  
  /** Password minimum length */
  MIN_PASSWORD_LENGTH: 8,
  
  /** Maximum failed auth attempts before rate limiting */
  MAX_FAILED_AUTH_ATTEMPTS: 5,
  
  /** CORS allowed origins for development */
  DEV_ALLOWED_ORIGINS: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  
  /** Maximum sanitized string length */
  MAX_SANITIZED_LENGTH: 5000,
} as const;

/**
 * Agent-specific constants
 */
export const AGENT_CONSTANTS = {
  /** Maximum agent response length */
  MAX_RESPONSE_LENGTH: 5000,
  
  /** Agent execution timeout in milliseconds */
  EXECUTION_TIMEOUT_MS: 30000,
  
  /** Maximum number of agent retries */
  MAX_AGENT_RETRIES: 2,
  
 } as const;

/**
 * Calendar and scheduling constants
 */
export const CALENDAR_CONSTANTS = {
  /** Default meeting duration in minutes */
  DEFAULT_MEETING_DURATION_MINUTES: 60,
  
  /** Maximum attendees per meeting */
  MAX_ATTENDEES: 100,
  
  /** Meeting buffer time in minutes */
  MEETING_BUFFER_MINUTES: 15,
  
  /** Maximum event title length */
  MAX_EVENT_TITLE_LENGTH: 200,
  
  /** Maximum event description length */
  MAX_EVENT_DESCRIPTION_LENGTH: 2000,
} as const;

/**
 * Content creation constants
 */
export const CONTENT_CONSTANTS = {
  /** Maximum blog post length */
  MAX_BLOG_POST_LENGTH: 10000,
  
  /** Default blog post length */
  DEFAULT_BLOG_POST_LENGTH: 1500,
  
  /** Maximum title length */
  MAX_TITLE_LENGTH: 100,
  
  /** Maximum tags per post */
  MAX_TAGS: 10,
  
  /** Content generation timeout in milliseconds */
  GENERATION_TIMEOUT_MS: 120000, // 2 minutes
} as const;

/**
 * Web search constants
 */
export const SEARCH_CONSTANTS = {
  /** Maximum search results */
  MAX_SEARCH_RESULTS: 20,
  
  /** Default search results */
  DEFAULT_SEARCH_RESULTS: 5,
  
  /** Search timeout in milliseconds */
  SEARCH_TIMEOUT_MS: 30000,
  
  /** Maximum search query length */
  MAX_QUERY_LENGTH: 500,
  
  /** Result summary max length */
  MAX_SUMMARY_LENGTH: 1000,
} as const;

/**
 * Slack integration constants
 */
export const SLACK_CONSTANTS = {
  /** Maximum message results per request */
  MAX_MESSAGE_LIMIT: 100,
  
  /** Default message limit */
  DEFAULT_MESSAGE_LIMIT: 20,
  
  /** Maximum query length for Slack operations */
  MAX_QUERY_LENGTH: 200,
  
  /** Slack API timeout in milliseconds */
  API_TIMEOUT_MS: 15000,
  
  /** Maximum thread participants */
  MAX_THREAD_PARTICIPANTS: 50,
  
  /** Draft detection timeout in milliseconds */
  DRAFT_DETECTION_TIMEOUT_MS: 5000,
  
  /** Confirmation workflow timeout in milliseconds */
  CONFIRMATION_TIMEOUT_MS: 300000, // 5 minutes
} as const;

/**
 * Logging constants
 */
export const LOGGING_CONSTANTS = {
  /** Maximum log entry length */
  MAX_LOG_ENTRY_LENGTH: 10000,
  
  /** Log rotation size in MB */
  LOG_ROTATION_SIZE_MB: 10,
  
  /** Maximum log files to keep */
  MAX_LOG_FILES: 5,
  
  /** Fields to exclude from logging */
  EXCLUDED_LOG_FIELDS: ['password', 'accessToken', 'refreshToken', 'authorization'],
  
  /** Maximum error message length */
  MAX_ERROR_MESSAGE_LENGTH: 2000,
} as const;

/**
 * HTTP and network constants
 */
export const NETWORK_CONSTANTS = {
  /** Default HTTP timeout in milliseconds */
  HTTP_TIMEOUT_MS: 30000,
  
  /** Maximum redirects to follow */
  MAX_REDIRECTS: 5,
  
  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT_MS: 10000,
  
  /** Keep-alive timeout in milliseconds */
  KEEP_ALIVE_TIMEOUT_MS: 5000,
  
  /** Maximum concurrent connections */
  MAX_CONCURRENT_CONNECTIONS: 100,
} as const;

/**
 * File and storage constants
 */
export const STORAGE_CONSTANTS = {
  /** Maximum file upload size in MB */
  MAX_FILE_SIZE_MB: 10,
  
  /** Allowed file types */
  ALLOWED_FILE_TYPES: ['txt', 'pdf', 'doc', 'docx', 'json'],
  
  /** Temporary file retention in hours */
  TEMP_FILE_RETENTION_HOURS: 24,
  
  /** Maximum filename length */
  MAX_FILENAME_LENGTH: 255,
} as const;

/**
 * Helper functions for working with constants
 */
export const CONSTANTS_HELPERS = {
  /**
   * Convert minutes to milliseconds
   */
  minutesToMs: (minutes: number): number => minutes * 60 * 1000,
  
  /**
   * Convert hours to milliseconds
   */
  hoursToMs: (hours: number): number => hours * 60 * 60 * 1000,
  
  /**
   * Convert MB to bytes
   */
  mbToBytes: (mb: number): number => mb * 1024 * 1024,
  
  /**
   * Check if a value is within a constant limit
   */
  isWithinLimit: (value: number, limit: number): boolean => value <= limit,
  
  /**
   * Get percentage of limit used
   */
  getUsagePercentage: (current: number, max: number): number => (current / max) * 100,
  
  /**
   * Check if threshold is exceeded
   */
  isThresholdExceeded: (current: number, max: number, threshold: number): boolean => {
    return (current / max) >= threshold;
  },
} as const;

/**
 * Environment-specific constants
 */
export const ENVIRONMENT_CONSTANTS = {
  /** Development environment identifier */
  DEVELOPMENT: 'development',
  
  /** Production environment identifier */
  PRODUCTION: 'production',
  
  /** Staging environment identifier */
  STAGING: 'staging',
  
  /** Test environment identifier */
  TEST: 'test',
} as const;

/**
 * Regular expression constants
 */
export const REGEX_CONSTANTS = {
  /** Email address validation */
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  /** Email address extraction from text */
  EMAIL_EXTRACT: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  
  /** Name pattern (capitalized words) */
  NAME_PATTERN: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
  
  /** UUID pattern */
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  
  /** Session ID pattern */
  SESSION_ID: /^session-[a-zA-Z0-9-]+$/,
  
  /** Safe string pattern (alphanumeric, spaces, basic punctuation) */
  SAFE_STRING: /^[a-zA-Z0-9\s.,!?;:()\-_@#$%&*+=[\]{}'"<>/\\|~`]+$/,
} as const;
