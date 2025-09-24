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



// ========== Step Analysis ==========


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


// ========== Error Transparency ==========

