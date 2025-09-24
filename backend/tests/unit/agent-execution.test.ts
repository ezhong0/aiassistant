/**
 * Unit Tests for AgentExecution
 *
 * Tests the execution context wrapper that eliminates parameter threading
 * and provides automatic correlation tracking and metrics.
 */

import {
  AgentExecution,
  createExecution,
  EventBus,
} from '../../src/framework/agent-execution';
import { success, failure, AgentErrorCode } from '../../src/types/agents/agent-result';
import { AgentExecutionContext } from '../../src/types/agents/natural-language.types';

describe('AgentExecution', () => {
  describe('Context Accessors', () => {
    it('should provide clean access to context properties', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        userId: 'user-456',
        accessToken: 'token-789',
        correlationId: 'corr-abc',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      expect(execution.sessionId).toBe('session-123');
      expect(execution.userId).toBe('user-456');
      expect(execution.accessToken).toBe('token-789');
      expect(execution.correlationId).toBe('corr-abc');
    });

    it('should expose OAuth fields', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiry: 1234567890,
      };

      const execution = new AgentExecution(context);

      expect(execution.accessToken).toBe('access-token');
      expect(execution.refreshToken).toBe('refresh-token');
      expect(execution.tokenExpiry).toBe(1234567890);
    });

    it('should handle optional fields gracefully', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      expect(execution.userId).toBeUndefined();
      expect(execution.accessToken).toBeUndefined();
      expect(execution.slackContext).toBeUndefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit events with automatic correlation', () => {
      const events: any[] = [];
      const eventBus: EventBus = {
        emit: (event, data) => events.push({ event, data }),
      };

      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        userId: 'user-456',
        correlationId: 'corr-789',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context, eventBus);

      execution.emit('test.event', { customData: 'value' });

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('test.event');
      expect(events[0].data.customData).toBe('value');
      expect(events[0].data.correlationId).toBe('corr-789');
      expect(events[0].data.sessionId).toBe('session-123');
      expect(events[0].data.userId).toBe('user-456');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should handle missing event bus gracefully', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      expect(() => execution.emit('test.event', {})).not.toThrow();
    });
  });

  describe('Execution Wrapper', () => {
    it('should track successful operations', async () => {
      const events: any[] = [];
      const eventBus: EventBus = {
        emit: (event, data) => events.push({ event, data }),
      };

      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context, eventBus);

      const result = await execution.execute('test-operation', async () =>
        success('completed')
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('completed');
        expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
      }

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('agent.operation.started');
      expect(events[0].data.operation).toBe('test-operation');
      expect(events[1].event).toBe('agent.operation.completed');
      expect(events[1].data.success).toBe(true);
      expect(events[1].data.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track failed operations', async () => {
      const events: any[] = [];
      const eventBus: EventBus = {
        emit: (event, data) => events.push({ event, data }),
      };

      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context, eventBus);

      const result = await execution.execute('failing-operation', async () =>
        failure({
          code: AgentErrorCode.OPERATION_FAILED,
          message: 'Something went wrong',
        })
      );

      expect(result.ok).toBe(false);

      expect(events).toHaveLength(2);
      expect(events[1].event).toBe('agent.operation.completed');
      expect(events[1].data.success).toBe(false);
    });

    it('should handle thrown errors', async () => {
      const events: any[] = [];
      const eventBus: EventBus = {
        emit: (event, data) => events.push({ event, data }),
      };

      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context, eventBus);

      await expect(
        execution.execute('throwing-operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('agent.operation.started');
      expect(events[1].event).toBe('agent.operation.failed');
      expect(events[1].data.error).toBe('Test error');
      expect(events[1].data.errorType).toBe('Error');
    });

    it('should track operation duration', async () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      const result = await execution.execute('timed-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return success('done');
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.metadata) {
        expect(result.metadata.duration).toBeGreaterThanOrEqual(45);
      }
    });
  });

  describe('Child Execution', () => {
    it('should create child with inherited context', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        userId: 'user-456',
        correlationId: 'parent-corr',
        timestamp: new Date(),
        metadata: { parentData: 'value' },
      };

      const parent = new AgentExecution(context);
      const child = parent.createChild({ childData: 'childValue' });

      expect(child.sessionId).toBe('session-123');
      expect(child.userId).toBe('user-456');
      expect(child.correlationId).not.toBe('parent-corr'); // New correlation ID
      expect(child.correlationId).toContain('parent-corr'); // But references parent
      expect(child.metadata?.parentData).toBe('value');
      expect(child.metadata?.childData).toBe('childValue');
      expect(child.metadata?.parentCorrelationId).toBe('parent-corr');
    });

    it('should generate unique correlation IDs for children', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'parent-123',
        timestamp: new Date(),
      };

      const parent = new AgentExecution(context);
      const child1 = parent.createChild();
      const child2 = parent.createChild();

      expect(child1.correlationId).not.toBe(child2.correlationId);
      expect(child1.correlationId).toContain('parent-123');
      expect(child2.correlationId).toContain('parent-123');
    });
  });

  describe('Metrics & Debugging', () => {
    it('should track total execution duration', async () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(execution.getDuration()).toBeGreaterThanOrEqual(45);
    });

    it('should track operation history', async () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      await execution.execute('operation-1', async () => success('done'));
      await execution.execute('operation-2', async () => success('done'));
      await execution.execute('operation-3', async () => success('done'));

      const history = execution.getOperationHistory();
      expect(history).toEqual(['operation-1', 'operation-2', 'operation-3']);
    });

    it('should provide execution summary', async () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        userId: 'user-456',
        correlationId: 'corr-789',
        timestamp: new Date(),
      };

      const execution = new AgentExecution(context);

      await execution.execute('op1', async () => success('done'));
      await execution.execute('op2', async () => success('done'));

      const summary = execution.getSummary();

      expect(summary.sessionId).toBe('session-123');
      expect(summary.userId).toBe('user-456');
      expect(summary.correlationId).toBe('corr-789');
      expect(summary.operations).toEqual(['op1', 'op2']);
      expect(summary.operationCount).toBe(2);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Updates', () => {
    it('should allow metadata updates', () => {
      const context: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
        metadata: { original: 'value' },
      };

      const execution = new AgentExecution(context);

      execution.updateMetadata({ additional: 'data' });

      expect(execution.metadata?.original).toBe('value');
      expect(execution.metadata?.additional).toBe('data');
    });
  });

  describe('Helper Methods', () => {
    it('should check authentication status', () => {
      const withAuth: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
        accessToken: 'token',
      };

      const withoutAuth: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      expect(new AgentExecution(withAuth).isAuthenticated()).toBe(true);
      expect(new AgentExecution(withoutAuth).isAuthenticated()).toBe(false);
    });

    it('should check if from Slack', () => {
      const fromSlack: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
        slackContext: { teamId: 'T123' },
      };

      const notFromSlack: AgentExecutionContext = {
        sessionId: 'session-123',
        correlationId: 'corr-123',
        timestamp: new Date(),
      };

      expect(new AgentExecution(fromSlack).isFromSlack()).toBe(true);
      expect(new AgentExecution(notFromSlack).isFromSlack()).toBe(false);
    });
  });

  describe('createExecution() Helper', () => {
    it('should create execution with defaults', () => {
      const execution = createExecution({});

      expect(execution.sessionId).toMatch(/^session-/);
      expect(execution.correlationId).toMatch(/^corr-/);
      expect(execution.userId).toBeUndefined();
    });

    it('should create execution with provided values', () => {
      const execution = createExecution({
        sessionId: 'custom-session',
        userId: 'user-123',
        accessToken: 'token-456',
        correlationId: 'corr-789',
      });

      expect(execution.sessionId).toBe('custom-session');
      expect(execution.userId).toBe('user-123');
      expect(execution.accessToken).toBe('token-456');
      expect(execution.correlationId).toBe('corr-789');
    });

    it('should create execution with OAuth fields', () => {
      const execution = createExecution({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenExpiry: 1234567890,
      });

      expect(execution.accessToken).toBe('access');
      expect(execution.refreshToken).toBe('refresh');
      expect(execution.tokenExpiry).toBe(1234567890);
    });
  });
});