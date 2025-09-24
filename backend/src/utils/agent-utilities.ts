/**
 * Agent Utilities
 *
 * Critical patterns from production fixes:
 * - Null safety (validates service availability)
 * - Schema validation (ensures correct AI schema format)
 *
 * These utilities prevent the exact issues we encountered in production.
 */

import { AgentError, AgentErrorCode, failure } from '../types/agents/agent-result';


// ========== Null Safety ==========

/**
 * Validate that a service is available before use
 *
 * Production issue: Calendar service was null, causing:
 * "Cannot read properties of null (reading 'getEvents')"
 *
 * This utility ensures services are checked before operations.
 */
export function validateServiceAvailable(
  service: any,
  serviceName: string
): asserts service is NonNullable<typeof service> {
  if (!service || service === null || service === undefined) {
    throw createServiceUnavailableError(serviceName);
  }
}

/**
 * Create a standardized service unavailable error
 */
export function createServiceUnavailableError(serviceName: string): Error {
  const error = new Error(
    `${serviceName} not available. Please check integration setup.`
  );
  (error as any).code = AgentErrorCode.SERVICE_UNAVAILABLE;
  (error as any).serviceName = serviceName;
  (error as any).suggestions = [
    `Verify ${serviceName} is configured`,
    'Check OAuth tokens if required',
    'Review service initialization logs',
    'Ensure service is properly registered in ServiceManager',
  ];
  return error;
}

/**
 * Safe service getter with validation
 */
export function getServiceSafely<T>(
  services: Map<string, any>,
  serviceName: string
): T {
  const service = services.get(serviceName);
  validateServiceAvailable(service, serviceName);
  return service as T;
}

// ========== AI Schema Validation ==========

/**
 * Validate that an AI schema is properly formatted
 *
 * Production issue: Array schemas missing 'items' property caused:
 * "400 Invalid schema for function 'extract_data': array schema missing items"
 *
 * This utility validates schemas before sending to OpenAI.
 */
export interface AISchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
}

/**
 * Validate AI schema and return validation result
 */
export function validateAISchema(schema: AISchema): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must be an object
  if (schema.type !== 'object') {
    errors.push(`Schema must be type 'object', got '${schema.type}'`);
  }

  // Must have properties
  if (!schema.properties) {
    errors.push('Schema must have properties defined');
  }

  // Validate array properties have items
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.type === 'array' && !propSchema.items) {
        errors.push(
          `Array property '${key}' is missing required 'items' definition`
        );
      }

      // Recursively validate nested objects
      if (propSchema.type === 'object' && propSchema.properties) {
        const nestedResult = validateAISchema(propSchema);
        errors.push(
          ...nestedResult.errors.map((e) => `${key}.${e}`)
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Assert that schema is valid (throws if invalid)
 */
export function assertValidAISchema(schema: AISchema): void {
  const result = validateAISchema(schema);
  if (!result.valid) {
    throw new Error(
      `Invalid AI schema:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Create a properly formatted array schema
 *
 * Helper to ensure arrays always have items defined
 */
export function createArraySchema(itemSchema: AISchema): AISchema {
  return {
    type: 'array',
    items: itemSchema,
  };
}

/**
 * Validate OpenAI API call parameters
 *
 * Production issue: Wrong parameter order caused empty responses
 *
 * Correct signature: generateStructuredData(userInput, systemPrompt, schema, options)
 */
export function validateOpenAIParams(params: {
  userInput: string;
  systemPrompt: string;
  schema: AISchema;
  options?: any;
}): void {
  if (!params.userInput || typeof params.userInput !== 'string') {
    throw new Error('userInput must be a non-empty string');
  }

  if (!params.systemPrompt || typeof params.systemPrompt !== 'string') {
    throw new Error('systemPrompt must be a non-empty string');
  }

  if (!params.schema || typeof params.schema !== 'object') {
    throw new Error('schema must be a valid object');
  }

  assertValidAISchema(params.schema);
}

// ========== Step Analysis ==========

/**
 * Analyze if a step result indicates completion
 */
export function isCompletionResult(result: string): boolean {
  const completionIndicators = [
    'completed',
    'done',
    'finished',
    'success',
    'created successfully',
    'sent successfully',
  ];

  return completionIndicators.some((indicator) =>
    result.toLowerCase().includes(indicator)
  );
}

/**
 * Analyze if a step result indicates an error
 */
export function isErrorResult(result: string): boolean {
  const errorIndicators = [
    'error',
    'failed',
    "wasn't able",
    "couldn't",
    'unable to',
    'unfortunately',
    'cannot',
  ];

  return errorIndicators.some((indicator) =>
    result.toLowerCase().includes(indicator)
  );
}

/**
 * Extract error message from result string
 */
export function extractErrorMessage(result: string): string | null {
  // Try to extract error message after common prefixes
  const errorPrefixes = [
    'error:',
    'failed:',
    'unfortunately,',
    "wasn't able to:",
  ];

  for (const prefix of errorPrefixes) {
    const index = result.toLowerCase().indexOf(prefix);
    if (index !== -1) {
      return result.substring(index + prefix.length).trim();
    }
  }

  return isErrorResult(result) ? result : null;
}

// ========== Error Transparency ==========

/**
 * Ensure errors are never silently swallowed
 *
 * Production requirement: "no silent fallbacks - I need to see errors"
 */
export function ensureErrorVisibility(
  error: any,
  operation: string
): AgentError {
  return {
    code: error.code || AgentErrorCode.OPERATION_FAILED,
    message: error.message || `${operation} failed`,
    originalError: error instanceof Error ? error : undefined,
    context: {
      operation,
      errorType: error.constructor?.name || 'unknown',
    },
    suggestions: error.suggestions || [
      'Check service logs for details',
      'Verify all required parameters are provided',
      'Ensure services are properly initialized',
    ],
  };
}

/**
 * Convert Error to AgentError (no information loss)
 */
export function toAgentError(
  error: Error,
  code?: string,
  suggestions?: string[]
): AgentError {
  return {
    code: code || AgentErrorCode.UNKNOWN_ERROR,
    message: error.message,
    originalError: error,
    context: {
      stack: error.stack,
      name: error.name,
    },
    suggestions,
  };
}