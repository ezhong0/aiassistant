import { describe, it, expect } from '@jest/globals';

describe('Example Test Suite', () => {
  describe('Basic Jest functionality', () => {
    it('should verify Jest is working correctly', () => {
      expect(1 + 1).toBe(2);
      expect('hello').toBe('hello');
      expect([1, 2, 3]).toHaveLength(3);
    });

    it('should handle async operations', async () => {
      const asyncFunction = async () => {
        return new Promise<string>(resolve => {
          setTimeout(() => resolve('async result'), 10);
        });
      };

      const result = await asyncFunction();
      expect(result).toBe('async result');
    });

    it('should work with objects and arrays', () => {
      const user = { name: 'John', age: 30 };
      const numbers = [1, 2, 3, 4, 5];

      expect(user).toHaveProperty('name', 'John');
      expect(user.age).toBeGreaterThan(18);
      expect(numbers).toContain(3);
      expect(numbers.length).toBe(5);
    });
  });

  describe('Environment setup', () => {
    it('should have test environment variables', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.DISABLE_RATE_LIMITING).toBe('true');
    });

    it('should have access to Jest globals', () => {
      expect(describe).toBeDefined();
      expect(it).toBeDefined();
      expect(expect).toBeDefined();
      expect(beforeEach).toBeDefined();
      expect(afterEach).toBeDefined();
    });
  });
});