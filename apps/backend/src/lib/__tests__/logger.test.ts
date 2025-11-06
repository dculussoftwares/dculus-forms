import { describe, it, expect } from 'vitest';
import { logger } from '../logger.js';

describe('Logger', () => {
  describe('info', () => {
    it('should log single argument', () => {
      expect(() => logger.info('Test message')).not.toThrow();
    });

    it('should log multiple arguments', () => {
      expect(() => logger.info('Test', 'multiple', 'arguments')).not.toThrow();
    });

    it('should log with context object', () => {
      expect(() => logger.info('Test message', { userId: '123', action: 'create' })).not.toThrow();
    });

    it('should log with array as last argument', () => {
      expect(() => logger.info('Test message', ['item1', 'item2'])).not.toThrow();
    });
  });

  describe('error', () => {
    it('should log single argument', () => {
      expect(() => logger.error('Error message')).not.toThrow();
    });

    it('should log Error object', () => {
      const error = new Error('Test error');
      expect(() => logger.error('An error occurred', error)).not.toThrow();
    });

    it('should log with context object', () => {
      expect(() => logger.error('Error occurred', { code: 500, message: 'Internal error' })).not.toThrow();
    });

    it('should log multiple string arguments', () => {
      expect(() => logger.error('Error', 'with', 'multiple', 'parts')).not.toThrow();
    });

    it('should log with array as last argument', () => {
      expect(() => logger.error('Error with array', ['item1', 'item2'])).not.toThrow();
    });
  });

  describe('warn', () => {
    it('should log single argument', () => {
      expect(() => logger.warn('Warning message')).not.toThrow();
    });

    it('should log with context object', () => {
      expect(() => logger.warn('Warning', { type: 'deprecation', feature: 'oldAPI' })).not.toThrow();
    });

    it('should log multiple arguments', () => {
      expect(() => logger.warn('Warning', 'about', 'something')).not.toThrow();
    });

    it('should log with array as last argument', () => {
      expect(() => logger.warn('Warning with array', ['item1', 'item2'])).not.toThrow();
    });
  });

  describe('debug', () => {
    it('should log single argument', () => {
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should log with context object', () => {
      expect(() => logger.debug('Debug info', { requestId: 'abc123', duration: 150 })).not.toThrow();
    });

    it('should log multiple arguments', () => {
      expect(() => logger.debug('Debug', 'with', 'details')).not.toThrow();
    });

    it('should log with array as last argument', () => {
      expect(() => logger.debug('Debug with array', ['item1', 'item2'])).not.toThrow();
    });
  });

  describe('child', () => {
    it('should create child logger with context', () => {
      const childLogger = logger.child({ service: 'testService', module: 'auth' });
      expect(childLogger).toBeDefined();
      expect(childLogger.info).toBeInstanceOf(Function);
      expect(childLogger.error).toBeInstanceOf(Function);
      expect(childLogger.warn).toBeInstanceOf(Function);
      expect(childLogger.debug).toBeInstanceOf(Function);
    });

    it('should allow child logger to log info messages', () => {
      const childLogger = logger.child({ service: 'testService' });
      expect(() => childLogger.info('Child logger info')).not.toThrow();
    });

    it('should allow child logger to log error messages', () => {
      const childLogger = logger.child({ service: 'testService' });
      expect(() => childLogger.error('Child logger error')).not.toThrow();
    });

    it('should allow child logger to log warn messages', () => {
      const childLogger = logger.child({ service: 'testService' });
      expect(() => childLogger.warn('Child logger warning')).not.toThrow();
    });

    it('should allow child logger to log debug messages', () => {
      const childLogger = logger.child({ service: 'testService' });
      expect(() => childLogger.debug('Child logger debug')).not.toThrow();
    });

    it('should allow child logger with multiple arguments', () => {
      const childLogger = logger.child({ service: 'testService' });
      expect(() => childLogger.info('Message', 'with', 'multiple', 'parts')).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(() => logger.info('')).not.toThrow();
    });

    it('should handle null value', () => {
      expect(() => logger.info(null as any)).not.toThrow();
    });

    it('should handle undefined value', () => {
      expect(() => logger.info(undefined as any)).not.toThrow();
    });

    it('should handle number value', () => {
      expect(() => logger.info(123)).not.toThrow();
    });

    it('should handle boolean value', () => {
      expect(() => logger.info(true)).not.toThrow();
    });

    it('should handle nested objects', () => {
      expect(() => logger.info('Complex object', {
        user: { id: '123', name: 'Test' },
        metadata: { timestamp: Date.now() }
      })).not.toThrow();
    });
  });
});
