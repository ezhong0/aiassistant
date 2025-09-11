import { AIServiceCircuitBreaker, CircuitState, AIServiceUnavailableError } from '../../../src/services/ai-circuit-breaker.service';
import { OpenAIService } from '../../../src/services/openai.service';
import { ServiceState } from '../../../src/services/service-manager';

// Mock OpenAI service
const mockOpenAIService = {
  isReady: jest.fn(),
  generateText: jest.fn(),
  generateToolCalls: jest.fn()
} as unknown as OpenAIService;

describe('AIServiceCircuitBreaker', () => {
  let circuitBreaker: AIServiceCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new AIServiceCircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      successThreshold: 2,
      timeout: 5000
    });
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (circuitBreaker.state !== ServiceState.DESTROYED) {
      await circuitBreaker.destroy();
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      await circuitBreaker.initialize();
      expect(circuitBreaker.isReady()).toBe(true);
      expect(circuitBreaker.state).toBe(ServiceState.READY);
    });

    it('should destroy properly', async () => {
      await circuitBreaker.initialize();
      await circuitBreaker.destroy();
      expect(circuitBreaker.state).toBe(ServiceState.DESTROYED);
    });

    it('should report healthy state when circuit is closed', async () => {
      await circuitBreaker.initialize();
      const health = circuitBreaker.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.details.circuitState).toBe(CircuitState.CLOSED);
    });
  });

  describe('Circuit Breaker States', () => {
    beforeEach(async () => {
      await circuitBreaker.initialize();
      circuitBreaker.setOpenAIService(mockOpenAIService);
      (mockOpenAIService.isReady as jest.Mock).mockReturnValue(true);
    });

    it('should start in CLOSED state', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
    });

    it('should move to OPEN state after failure threshold', async () => {
      const mockError = new Error('API Error');
      (mockOpenAIService.generateText as jest.Mock).mockRejectedValue(mockError);

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'))
        ).rejects.toThrow(AIServiceUnavailableError);
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.failureCount).toBe(3);
    });

    it('should reject requests immediately when OPEN', async () => {
      // Force circuit to OPEN state
      circuitBreaker.forceState(CircuitState.OPEN);

      await expect(
        circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'))
      ).rejects.toThrow(AIServiceUnavailableError);

      expect(mockOpenAIService.generateText).not.toHaveBeenCalled();
    });

    it('should move to HALF_OPEN after recovery timeout', async () => {
      // Force circuit to OPEN state and set last failure time
      circuitBreaker.forceState(CircuitState.OPEN);
      
      // Mock successful response
      (mockOpenAIService.generateText as jest.Mock).mockResolvedValue('success');
      
      // Wait for recovery timeout to pass (using setTimeout to simulate time passage)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next request should move to HALF_OPEN and execute
      const result = await circuitBreaker.execute(async (openai) => 
        openai.generateText('test', 'test')
      );

      expect(result).toBe('success');
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after success threshold in HALF_OPEN', async () => {
      circuitBreaker.forceState(CircuitState.HALF_OPEN);
      (mockOpenAIService.generateText as jest.Mock).mockResolvedValue('success');

      // Execute successful operations up to threshold
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(async (openai) => 
          openai.generateText('test', 'test')
        );
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.successCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await circuitBreaker.initialize();
      circuitBreaker.setOpenAIService(mockOpenAIService);
      (mockOpenAIService.isReady as jest.Mock).mockReturnValue(true);
    });

    it('should handle OpenAI service not ready', async () => {
      (mockOpenAIService.isReady as jest.Mock).mockReturnValue(false);

      await expect(
        circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'))
      ).rejects.toThrow(AIServiceUnavailableError);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
    });

    it('should handle timeout errors', async () => {
      // Mock a slow response that exceeds timeout
      (mockOpenAIService.generateText as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      );

      await expect(
        circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'))
      ).rejects.toThrow(AIServiceUnavailableError);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
    }, 7000);

    it('should convert generic errors to user-friendly messages', async () => {
      const mockError = new Error('Internal API Error');
      (mockOpenAIService.generateText as jest.Mock).mockRejectedValue(mockError);

      await expect(
        circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'))
      ).rejects.toThrow('I\'m having trouble processing your request right now. Please try again.');
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await circuitBreaker.initialize();
      circuitBreaker.setOpenAIService(mockOpenAIService);
      (mockOpenAIService.isReady as jest.Mock).mockReturnValue(true);
    });

    it('should track total requests and failures', async () => {
      (mockOpenAIService.generateText as jest.Mock)
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      // Execute mixed success/failure operations
      await circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'));
      
      try {
        await circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'));
      } catch (error) {
        // Expected failure
      }
      
      await circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'));

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalFailures).toBe(1);
    });

    it('should track last success and failure times', async () => {
      const beforeTime = Date.now();
      
      (mockOpenAIService.generateText as jest.Mock).mockResolvedValue('success');
      await circuitBreaker.execute(async (openai) => openai.generateText('test', 'test'));

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.lastSuccessTime).toBeGreaterThanOrEqual(beforeTime);
      expect(metrics.lastFailureTime).toBe(0);
    });
  });

  describe('Reset and Recovery', () => {
    beforeEach(async () => {
      await circuitBreaker.initialize();
      circuitBreaker.setOpenAIService(mockOpenAIService);
      (mockOpenAIService.isReady as jest.Mock).mockReturnValue(true);
    });

    it('should reset circuit breaker state', () => {
      // Force some failures
      circuitBreaker.forceState(CircuitState.OPEN);
      
      circuitBreaker.reset();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });
  });
});