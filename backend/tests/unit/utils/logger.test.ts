import logger from '../../../src/utils/logger';

describe('Logger', () => {
  describe('Logger Instance', () => {
    it('should create logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create child logger', () => {
      const childLogger = logger.child({ component: 'test' });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });
  });

  describe('Log Levels', () => {
    it('should handle different log levels', () => {
      // Test that methods exist and don't throw
      expect(() => logger.error('Test error')).not.toThrow();
      expect(() => logger.warn('Test warning')).not.toThrow();
      expect(() => logger.info('Test info')).not.toThrow();
      expect(() => logger.debug('Test debug')).not.toThrow();
    });

    it('should handle log messages with metadata', () => {
      expect(() => logger.info('Test message', { key: 'value' })).not.toThrow();
      expect(() => logger.error('Test error', { error: new Error('test') })).not.toThrow();
    });
  });

  describe('Log Formatting', () => {
    it('should handle different data types', () => {
      expect(() => logger.info('String message')).not.toThrow();
      expect(() => logger.info('Number:', 42)).not.toThrow();
      expect(() => logger.info('Object:', { test: true })).not.toThrow();
      expect(() => logger.info('Array:', [1, 2, 3])).not.toThrow();
    });

    it('should handle error objects', () => {
      const error = new Error('Test error');
      expect(() => logger.error('Error occurred:', error)).not.toThrow();
    });
  });

  describe('Production Behavior', () => {
    it('should respect environment-based configuration', () => {
      // Logger should be configured properly for test environment
      expect(logger.level).toBeDefined();
    });

    it('should handle structured logging', () => {
      const structuredData = {
        userId: 'test-123',
        operation: 'test-operation',
        duration: 100,
        success: true
      };
      
      expect(() => logger.info('Operation completed', structuredData)).not.toThrow();
    });
  });
});