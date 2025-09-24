/**
 * Unit Tests for Agent Utilities
 *
 * Tests critical patterns from production fixes:
 * - Loop prevention
 * - Null safety
 * - Schema validation
 */

import {
  detectRepeatedFailures,
  calculateStepSimilarity,
  createLoopDetectedError,
  validateServiceAvailable,
  createServiceUnavailableError,
  getServiceSafely,
  validateAISchema,
  assertValidAISchema,
  createArraySchema,
  validateOpenAIParams,
  isCompletionResult,
  isErrorResult,
  extractErrorMessage,
  ensureErrorVisibility,
  toAgentError,
} from '../../src/utils/agent-utilities';
import { AgentErrorCode } from '../../src/types/agents/agent-result';

describe('Agent Utilities', () => {
  describe('Loop Prevention', () => {
    describe('detectRepeatedFailures()', () => {
      it('should detect repeated failures', () => {
        const steps = [
          'Get calendar events',
          'Get calendar events',
          'Get calendar events',
        ];
        const results = [
          "Wasn't able to access calendar",
          "Unfortunately couldn't access calendar",
          'Error accessing calendar',
        ];

        expect(detectRepeatedFailures(steps, results)).toBe(true);
      });

      it('should not detect when steps are different', () => {
        const steps = [
          'Get calendar events',
          'Send email',
          'Create contact',
        ];
        const results = [
          'Error accessing calendar',
          'Error sending email',
          'Error creating contact',
        ];

        expect(detectRepeatedFailures(steps, results)).toBe(false);
      });

      it('should not detect with too few steps', () => {
        const steps = ['Get calendar'];
        const results = ['Error'];

        expect(detectRepeatedFailures(steps, results)).toBe(false);
      });

      it('should not detect when results are successes', () => {
        const steps = [
          'Get calendar events',
          'Get calendar events',
        ];
        const results = [
          'Successfully retrieved 5 events',
          'Successfully retrieved 3 events',
        ];

        expect(detectRepeatedFailures(steps, results)).toBe(false);
      });

      it('should respect custom threshold', () => {
        const steps = ['Get data', 'Fetch data'];
        const results = ['Failed', 'Error'];

        expect(detectRepeatedFailures(steps, results, 0.3)).toBe(true);
        expect(detectRepeatedFailures(steps, results, 0.9)).toBe(false);
      });
    });

    describe('calculateStepSimilarity()', () => {
      it('should calculate high similarity for identical steps', () => {
        const steps = ['Get calendar', 'Get calendar', 'Get calendar'];
        const similarity = calculateStepSimilarity(steps);
        expect(similarity).toBeGreaterThan(0.9);
      });

      it('should calculate low similarity for different steps', () => {
        const steps = ['Get calendar', 'Send email', 'Create contact'];
        const similarity = calculateStepSimilarity(steps);
        expect(similarity).toBeLessThan(0.3);
      });

      it('should handle single step', () => {
        const steps = ['Get calendar'];
        expect(calculateStepSimilarity(steps)).toBe(0);
      });
    });

    describe('createLoopDetectedError()', () => {
      it('should create proper error structure', () => {
        const steps = ['Step 1', 'Step 2'];
        const results = ['Error 1', 'Error 2'];

        const error = createLoopDetectedError(steps, results);

        expect(error.code).toBe(AgentErrorCode.REPEATED_FAILURES_DETECTED);
        expect(error.message).toContain('repeated failures');
        expect(error.context?.recentSteps).toEqual(steps);
        expect(error.context?.recentResults).toEqual(results);
        expect(error.suggestions).toBeDefined();
        expect(error.suggestions?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Null Safety', () => {
    describe('validateServiceAvailable()', () => {
      it('should pass for valid service', () => {
        const service = { method: () => {} };
        expect(() =>
          validateServiceAvailable(service, 'testService')
        ).not.toThrow();
      });

      it('should throw for null service', () => {
        expect(() =>
          validateServiceAvailable(null, 'testService')
        ).toThrow('testService not available');
      });

      it('should throw for undefined service', () => {
        expect(() =>
          validateServiceAvailable(undefined, 'testService')
        ).toThrow('testService not available');
      });

      it('should include suggestions in error', () => {
        try {
          validateServiceAvailable(null, 'calendarService');
          fail('Should have thrown');
        } catch (error: any) {
          expect(error.suggestions).toBeDefined();
          expect(error.suggestions).toContain('Verify calendarService is configured');
        }
      });
    });

    describe('getServiceSafely()', () => {
      it('should return service if available', () => {
        const services = new Map<string, any>();
        services.set('test', { data: 'value' });

        const result = getServiceSafely(services, 'test');
        expect(result.data).toBe('value');
      });

      it('should throw if service not found', () => {
        const services = new Map<string, any>();

        expect(() => getServiceSafely(services, 'missing')).toThrow(
          'missing not available'
        );
      });
    });
  });

  describe('AI Schema Validation', () => {
    describe('validateAISchema()', () => {
      it('should validate correct schema', () => {
        const schema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        };

        const result = validateAISchema(schema);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing items in array', () => {
        const schema = {
          type: 'object',
          properties: {
            items: { type: 'array' }, // Missing items!
          },
        };

        const result = validateAISchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          "Array property 'items' is missing required 'items' definition"
        );
      });

      it('should validate array with items', () => {
        const schema = {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        };

        const result = validateAISchema(schema);
        expect(result.valid).toBe(true);
      });

      it('should detect non-object type', () => {
        const schema = {
          type: 'string',
          properties: {},
        };

        const result = validateAISchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          "Schema must be type 'object', got 'string'"
        );
      });

      it('should validate nested objects', () => {
        const schema = {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                items: { type: 'array' }, // Missing items in nested!
              },
            },
          },
        };

        const result = validateAISchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('nested'))).toBe(true);
      });
    });

    describe('assertValidAISchema()', () => {
      it('should not throw for valid schema', () => {
        const schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
        };

        expect(() => assertValidAISchema(schema)).not.toThrow();
      });

      it('should throw for invalid schema', () => {
        const schema = {
          type: 'object',
          properties: {
            items: { type: 'array' }, // Missing items
          },
        };

        expect(() => assertValidAISchema(schema)).toThrow('Invalid AI schema');
      });
    });

    describe('createArraySchema()', () => {
      it('should create properly formatted array schema', () => {
        const itemSchema = {
          type: 'object',
          properties: { name: { type: 'string' } },
        };

        const arraySchema = createArraySchema(itemSchema);

        expect(arraySchema.type).toBe('array');
        expect(arraySchema.items).toBe(itemSchema);
      });
    });

    describe('validateOpenAIParams()', () => {
      it('should validate correct parameters', () => {
        const params = {
          userInput: 'Test input',
          systemPrompt: 'Test prompt',
          schema: {
            type: 'object',
            properties: { result: { type: 'string' } },
          },
        };

        expect(() => validateOpenAIParams(params)).not.toThrow();
      });

      it('should reject missing userInput', () => {
        const params = {
          userInput: '',
          systemPrompt: 'Test',
          schema: { type: 'object', properties: {} },
        };

        expect(() => validateOpenAIParams(params)).toThrow('userInput');
      });

      it('should reject invalid schema', () => {
        const params = {
          userInput: 'Test',
          systemPrompt: 'Test',
          schema: {
            type: 'object',
            properties: {
              items: { type: 'array' }, // Missing items
            },
          },
        };

        expect(() => validateOpenAIParams(params)).toThrow('Invalid AI schema');
      });
    });
  });

  describe('Step Analysis', () => {
    describe('isCompletionResult()', () => {
      it('should detect completion indicators', () => {
        expect(isCompletionResult('Task completed successfully')).toBe(true);
        expect(isCompletionResult('Operation finished')).toBe(true);
        expect(isCompletionResult('Done creating event')).toBe(true);
        expect(isCompletionResult('Email sent successfully')).toBe(true);
      });

      it('should not detect completion in error messages', () => {
        expect(isCompletionResult('Failed to complete task')).toBe(false);
        expect(isCompletionResult('Error occurred')).toBe(false);
      });
    });

    describe('isErrorResult()', () => {
      it('should detect error indicators', () => {
        expect(isErrorResult('Error accessing calendar')).toBe(true);
        expect(isErrorResult('Failed to send email')).toBe(true);
        expect(isErrorResult("Wasn't able to complete")).toBe(true);
        expect(isErrorResult("Couldn't process request")).toBe(true);
        expect(isErrorResult('Unfortunately the operation failed')).toBe(true);
      });

      it('should not detect errors in success messages', () => {
        expect(isErrorResult('Successfully completed')).toBe(false);
        expect(isErrorResult('Operation finished')).toBe(false);
      });
    });

    describe('extractErrorMessage()', () => {
      it('should extract error after prefix', () => {
        const result = extractErrorMessage('Error: Service unavailable');
        expect(result).toBe('Service unavailable');
      });

      it('should handle different prefixes', () => {
        expect(extractErrorMessage('Failed: Connection timeout')).toBe(
          'Connection timeout'
        );
        expect(
          extractErrorMessage("Unfortunately, couldn't connect")
        ).toBe("couldn't connect");
      });

      it('should return null for non-error results', () => {
        expect(extractErrorMessage('Successfully completed')).toBeNull();
      });

      it('should return full message if error but no prefix', () => {
        expect(extractErrorMessage('Unable to proceed')).toBe(
          'Unable to proceed'
        );
      });
    });
  });

  describe('Error Transparency', () => {
    describe('ensureErrorVisibility()', () => {
      it('should convert Error to AgentError', () => {
        const error = new Error('Test error');
        const agentError = ensureErrorVisibility(error, 'testOperation');

        expect(agentError.message).toBe('Test error');
        expect(agentError.context?.operation).toBe('testOperation');
        expect(agentError.originalError).toBe(error);
      });

      it('should preserve error code if available', () => {
        const error: any = new Error('Test');
        error.code = AgentErrorCode.SERVICE_UNAVAILABLE;

        const agentError = ensureErrorVisibility(error, 'test');
        expect(agentError.code).toBe(AgentErrorCode.SERVICE_UNAVAILABLE);
      });

      it('should handle non-Error objects', () => {
        const error = { message: 'Custom error' };
        const agentError = ensureErrorVisibility(error, 'test');

        expect(agentError.message).toBe('Custom error');
      });
    });

    describe('toAgentError()', () => {
      it('should convert Error with custom code', () => {
        const error = new Error('Test error');
        const agentError = toAgentError(
          error,
          AgentErrorCode.INVALID_PARAMETERS,
          ['Check params']
        );

        expect(agentError.code).toBe(AgentErrorCode.INVALID_PARAMETERS);
        expect(agentError.message).toBe('Test error');
        expect(agentError.suggestions).toEqual(['Check params']);
        expect(agentError.originalError).toBe(error);
      });

      it('should include stack trace in context', () => {
        const error = new Error('Test');
        const agentError = toAgentError(error);

        expect(agentError.context?.stack).toBeDefined();
        expect(agentError.context?.name).toBe('Error');
      });
    });
  });
});