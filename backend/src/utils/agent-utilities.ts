/**
 * Agent Utilities
 *
 * Critical patterns from production fixes:
 * - Null safety (validates service availability)
 * - Schema validation (ensures correct AI schema format)
 *
 * These utilities prevent the exact issues we encountered in production.
 */

import { AgentErrorCode } from '../types/agents/agent-result';


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
 * Analyze if a step result indicates an error using AI intelligence
 */
export async function isErrorResult(result: string, openaiService?: any): Promise<boolean> {
  // If no OpenAI service provided, try to get it from service manager
  if (!openaiService) {
      try {
        const { serviceManager } = await import('../services/service-locator-compat');
        openaiService = serviceManager.getService('openaiService');
      } catch {
      // Service manager not available, throw error
      throw new Error('No AI service available for error detection');
    }
  }

  // Use AI-powered error detection
  try {
    return await detectErrorWithAI(result, openaiService);
  } catch (error) {
    throw new Error(`Error detection failed: ${error}`);
  }
}

/**
 * AI-powered error detection using OpenAI service
 */
async function detectErrorWithAI(result: string, openaiService: any): Promise<boolean> {
  const prompt = `Analyze if this text indicates an error or failure:

Text: "${result}"

Return only "true" if this indicates an error/failure, "false" otherwise.

Error indicators include:
- Explicit error messages ("error", "failed", "unable to")
- Negative outcomes ("couldn't find", "not found", "not available")
- Failure descriptions ("didn't work", "wasn't successful")
- Exception messages or stack traces

Non-error indicators include:
- Success messages ("successfully", "completed", "found")
- Informational responses ("here are the results", "I found 5 items")
- Questions or requests ("what would you like", "please provide")
- Neutral statements ("the data shows", "according to the records")

Be precise - only return "true" for actual errors or failures.`;

  try {
    const response = await openaiService.generateText(
      prompt,
      'You detect error messages. Return only "true" or "false".',
      { temperature: 0.1, maxTokens: 10 }
    );

    return response.trim().toLowerCase() === 'true';
  } catch (error) {
    throw new Error(`AI error detection failed: ${error}`);
  }
}


// ========== Error Transparency ==========

