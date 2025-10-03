/**
 * Type guards for runtime validation
 * Provides safe type checking at runtime to prevent type errors
 */

import { z } from 'zod';
import { ErrorFactory } from '../errors/error-factory';
import { ToolCall, ToolResult, ToolCallSchema, ToolResultSchema } from '../framework/tool-execution';
// OpenAI function schema type
interface OpenAIFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * Check if value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if value is a valid array
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for ToolCall
 */
export function isToolCall(value: unknown): value is ToolCall {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.name) &&
    isObject(value.parameters)
  );
}

/**
 * Type guard for ToolResult
 */
export function isToolResult(value: unknown): value is ToolResult {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.toolName) &&
    typeof value.success === 'boolean' &&
    value.result !== undefined &&
    (value.error === undefined || typeof value.error === 'string') &&
    (value.executionTime === undefined || typeof value.executionTime === 'number')
  );
}

// ✅ Enhanced Zod-based type guards for better validation
/**
 * Zod-based type guard for ToolCall with comprehensive validation
 */
export function isValidToolCall(value: unknown): value is ToolCall {
  return ToolCallSchema.safeParse(value).success;
}

/**
 * Zod-based type guard for ToolResult with comprehensive validation
 */
export function isValidToolResult(value: unknown): value is ToolResult {
  return ToolResultSchema.safeParse(value).success;
}

/**
 * Zod-based validation for ToolCall with detailed error information
 */
export function validateToolCallWithZod(value: unknown): { success: true; data: ToolCall } | { success: false; error: z.ZodError } {
  const result = ToolCallSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data as ToolCall };
  }
  return { success: false, error: result.error };
}

/**
 * Zod-based validation for ToolResult with detailed error information
 */
export function validateToolResultWithZod(value: unknown): { success: true; data: ToolResult } | { success: false; error: z.ZodError } {
  const result = ToolResultSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data as ToolResult };
  }
  return { success: false, error: result.error };
}

/**
 * Type guard for OpenAIFunctionSchema
 */
export function isOpenAIFunctionSchema(value: unknown): value is OpenAIFunctionSchema {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.description) &&
    isObject(value.parameters) &&
    value.parameters.type === 'object' &&
    isObject(value.parameters.properties) &&
    (value.parameters.required === undefined ||
      (isArray(value.parameters.required) &&
       (value.parameters.required as unknown[]).every(item => typeof item === 'string')))
  );
}

/**
 * Validate and cast unknown value to ToolCall
 * Throws error if validation fails
 */
export function validateToolCall(value: unknown): ToolCall {
  if (!isToolCall(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolCall: missing name or parameters');
  }
  return value;
}

/**
 * Validate and cast unknown value to ToolResult
 * Throws error if validation fails
 */
export function validateToolResult(value: unknown): ToolResult {
  if (!isToolResult(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolResult: missing required fields');
  }
  return value;
}

/**
 * Validate array of ToolCall objects
 */
export function validateToolCalls(value: unknown): ToolCall[] {
  if (!isArray(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolCalls: must be an array');
  }

  return value.map((item, index) => {
    try {
      return validateToolCall(item);
    } catch (error) {
      throw ErrorFactory.api.badRequest(`Invalid ToolCall at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Validate array of ToolResult objects
 */
export function validateToolResults(value: unknown): ToolResult[] {
  if (!isArray(value)) {
    throw ErrorFactory.api.badRequest('Invalid ToolResults: must be an array');
  }

  return value.map((item, index) => {
    try {
      return validateToolResult(item);
    } catch (error) {
      throw ErrorFactory.api.badRequest(`Invalid ToolResult at index ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Safe type assertion with fallback
 */
export function safeTypeAssertion<T>(
  value: unknown,
  validator: (value: unknown) => value is T,
  fallback: T,
): T {
  return validator(value) ? value : fallback;
}

/**
 * Safe property access with type checking
 */
export function safeGetProperty<T>(
  obj: unknown,
  property: string,
  validator: (value: unknown) => value is T,
): T | undefined {
  if (!isObject(obj)) return undefined;
  const value = (obj as Record<string, unknown>)[property];
  return validator(value) ? value : undefined;
}

// ✅ Additional Zod-based validation utilities
/**
 * Validate multiple values against a Zod schema
 */
export function validateMultipleWithZod<T>(
  values: unknown[],
  schema: z.ZodSchema<T>,
): { success: true; data: T[] } | { success: false; errors: z.ZodError[] } {
  const results: T[] = [];
  const errors: z.ZodError[] = [];

  for (const value of values) {
    const result = schema.safeParse(value);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length === 0) {
    return { success: true, data: results };
  }
  return { success: false, errors };
}

/**
 * Validate object properties against Zod schemas
 */
export function validateObjectProperties<T extends Record<string, unknown>>(
  obj: unknown,
  schemas: { [K in keyof T]: z.ZodSchema<T[K]> },
): { success: true; data: T } | { success: false; errors: Record<string, z.ZodError> } {
  if (!isObject(obj)) {
    return { success: false, errors: { root: new z.ZodError([{ code: 'invalid_type', expected: 'object', received: typeof obj, path: [], message: `Expected object, received ${typeof obj}` }]) } };
  }

  const errors: Record<string, z.ZodError> = {};
  const result = {} as T;

  for (const [key, schema] of Object.entries(schemas)) {
    const value = (obj as Record<string, unknown>)[key];
    const validation = schema.safeParse(value);
    
    if (validation.success) {
      result[key as keyof T] = validation.data;
    } else {
      errors[key] = validation.error;
    }
  }

  if (Object.keys(errors).length === 0) {
    return { success: true, data: result };
  }
  return { success: false, errors };
}

/**
 * Create a type guard from a Zod schema
 */
export function createTypeGuard<T>(schema: z.ZodSchema<T>): (value: unknown) => value is T {
  return (value: unknown): value is T => schema.safeParse(value).success;
}

/**
 * Validate with fallback value
 */
export function validateWithFallback<T>(
  value: unknown,
  schema: z.ZodSchema<T>,
  fallback: T,
): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}