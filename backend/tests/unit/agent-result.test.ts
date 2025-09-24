/**
 * Unit Tests for AgentResult Type
 *
 * Tests the type-safe result pattern that enforces error checking
 * at compile time and prevents null reference errors.
 */

import {
  AgentResult,
  AgentErrorCode,
  success,
  failure,
  failureFromError,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  mapResult,
  chainResult,
} from '../../src/types/agents/agent-result';

describe('AgentResult Type', () => {
  describe('Type Safety', () => {
    it('should enforce type checking on success', () => {
      const result: AgentResult<string> = {
        ok: true,
        value: 'test value',
      };

      if (result.ok) {
        // TypeScript knows result.value exists
        expect(result.value).toBe('test value');
        expect(result.metadata).toBeUndefined();
      } else {
        fail('Should be success');
      }
    });

    it('should enforce type checking on error', () => {
      const result: AgentResult<string> = {
        ok: false,
        error: {
          code: AgentErrorCode.OPERATION_FAILED,
          message: 'Test error',
        },
        recoverable: false,
      };

      if (!result.ok) {
        // TypeScript knows result.error exists
        expect(result.error.code).toBe(AgentErrorCode.OPERATION_FAILED);
        expect(result.error.message).toBe('Test error');
        expect(result.recoverable).toBe(false);
      } else {
        fail('Should be error');
      }
    });

    it('should include metadata in success result', () => {
      const result: AgentResult<number> = {
        ok: true,
        value: 42,
        metadata: {
          operation: 'calculate',
          duration: 100,
        },
      };

      if (result.ok) {
        expect(result.metadata?.operation).toBe('calculate');
        expect(result.metadata?.duration).toBe(100);
      }
    });
  });

  describe('Helper Functions', () => {
    describe('success()', () => {
      it('should create success result', () => {
        const result = success('hello');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe('hello');
        }
      });

      it('should create success result with metadata', () => {
        const result = success(123, { operation: 'test' });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(123);
          expect(result.metadata?.operation).toBe('test');
        }
      });
    });

    describe('failure()', () => {
      it('should create error result', () => {
        const result = failure({
          code: AgentErrorCode.INVALID_PARAMETERS,
          message: 'Bad params',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe(AgentErrorCode.INVALID_PARAMETERS);
          expect(result.error.message).toBe('Bad params');
          expect(result.recoverable).toBe(true); // default
        }
      });

      it('should create non-recoverable error', () => {
        const result = failure(
          {
            code: AgentErrorCode.SERVICE_UNAVAILABLE,
            message: 'Service down',
          },
          false
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.recoverable).toBe(false);
        }
      });
    });

    describe('failureFromError()', () => {
      it('should convert Error to AgentResult', () => {
        const error = new Error('Something went wrong');
        const result = failureFromError(error, AgentErrorCode.OPERATION_FAILED);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe(AgentErrorCode.OPERATION_FAILED);
          expect(result.error.message).toBe('Something went wrong');
          expect(result.error.originalError).toBe(error);
        }
      });

      it('should include suggestions', () => {
        const error = new Error('Test error');
        const result = failureFromError(
          error,
          AgentErrorCode.UNKNOWN_ERROR,
          true,
          ['Try again', 'Check logs']
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.suggestions).toEqual(['Try again', 'Check logs']);
        }
      });
    });
  });

  describe('Type Guards', () => {
    it('isSuccess() should narrow type to success', () => {
      const result: AgentResult<string> = success('test');

      if (isSuccess(result)) {
        // Type is narrowed - can access value directly
        expect(result.value).toBe('test');
      } else {
        fail('Should be success');
      }
    });

    it('isFailure() should narrow type to error', () => {
      const result: AgentResult<string> = failure({
        code: AgentErrorCode.OPERATION_FAILED,
        message: 'Failed',
      });

      if (isFailure(result)) {
        // Type is narrowed - can access error directly
        expect(result.error.message).toBe('Failed');
      } else {
        fail('Should be failure');
      }
    });
  });

  describe('unwrap()', () => {
    it('should return value for success', () => {
      const result = success(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw for error', () => {
      const result = failure({
        code: AgentErrorCode.OPERATION_FAILED,
        message: 'Failed',
      });

      expect(() => unwrap(result)).toThrow('Failed');
    });

    it('should preserve error code when throwing', () => {
      const result = failure({
        code: AgentErrorCode.SERVICE_UNAVAILABLE,
        message: 'Service down',
      });

      try {
        unwrap(result);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe(AgentErrorCode.SERVICE_UNAVAILABLE);
      }
    });
  });

  describe('unwrapOr()', () => {
    it('should return value for success', () => {
      const result = success('actual');
      expect(unwrapOr(result, 'default')).toBe('actual');
    });

    it('should return default for error', () => {
      const result = failure({
        code: AgentErrorCode.OPERATION_FAILED,
        message: 'Failed',
      });
      expect(unwrapOr(result, 'default')).toBe('default');
    });
  });

  describe('mapResult()', () => {
    it('should map success value', () => {
      const result = success(5);
      const mapped = mapResult(result, (n) => n * 2);

      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should preserve error', () => {
      const result: AgentResult<number> = failure({
        code: AgentErrorCode.OPERATION_FAILED,
        message: 'Failed',
      });

      const mapped = mapResult(result, (n) => n * 2);

      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error.message).toBe('Failed');
      }
    });

    it('should preserve metadata when mapping', () => {
      const result = success(5, { operation: 'test' });
      const mapped = mapResult(result, (n) => String(n));

      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe('5');
        expect(mapped.metadata?.operation).toBe('test');
      }
    });
  });

  describe('chainResult()', () => {
    it('should chain successful results', async () => {
      const result = success(5);
      const chained = await chainResult(result, async (n) =>
        success(n * 2)
      );

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe(10);
      }
    });

    it('should short-circuit on error', async () => {
      const result: AgentResult<number> = failure({
        code: AgentErrorCode.OPERATION_FAILED,
        message: 'Initial error',
      });

      const chained = await chainResult(result, async (n) =>
        success(n * 2)
      );

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error.message).toBe('Initial error');
      }
    });

    it('should propagate error from chained operation', async () => {
      const result = success(5);
      const chained = await chainResult(result, async (n) =>
        failure({
          code: AgentErrorCode.OPERATION_FAILED,
          message: 'Chained error',
        })
      );

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error.message).toBe('Chained error');
      }
    });
  });

  describe('Error Codes', () => {
    it('should have standardized error codes', () => {
      expect(AgentErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
      expect(AgentErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
      expect(AgentErrorCode.INVALID_PARAMETERS).toBe('INVALID_PARAMETERS');
      expect(AgentErrorCode.AI_ANALYSIS_FAILED).toBe('AI_ANALYSIS_FAILED');
      expect(AgentErrorCode.REPEATED_FAILURES_DETECTED).toBe(
        'REPEATED_FAILURES_DETECTED'
      );
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle service unavailable scenario', () => {
      const result: AgentResult<any> = {
        ok: false,
        error: {
          code: AgentErrorCode.SERVICE_UNAVAILABLE,
          message: 'Calendar service not available',
          suggestions: [
            'Check calendar integration setup',
            'Verify OAuth tokens',
          ],
        },
        recoverable: false,
      };

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.suggestions).toHaveLength(2);
        expect(result.recoverable).toBe(false);
      }
    });

    it('should handle successful operation with confirmation', () => {
      const result = success(
        { eventId: '123', summary: 'Meeting' },
        {
          operation: 'createEvent',
          requiresConfirmation: true,
          nextSteps: ['Confirm event creation', 'Send invites'],
        }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.eventId).toBe('123');
        expect(result.metadata?.requiresConfirmation).toBe(true);
        expect(result.metadata?.nextSteps).toHaveLength(2);
      }
    });
  });
});