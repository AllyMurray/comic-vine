import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';
import { CircuitBreakerState, CircuitBreakerOpenError, OperationTimeoutError } from './types.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        recoveryTimeoutMs: 1000,
        timeoutMs: 100,
      },
    };
    circuitBreaker = new CircuitBreaker(mockConfig);
  });

  describe('basic functionality', () => {
    it('should start in closed state', () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failureCount).toBe(0);
    });

    it('should execute successful operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation, 'test-operation');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failureCount).toBe(0);
    });

    it('should reset to closed state', () => {
      circuitBreaker.reset();
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failureCount).toBe(0);
    });
  });

  describe('failure handling', () => {
    it('should count severe errors towards failure threshold', async () => {
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const mockOperation = vi.fn().mockRejectedValue(severeError);
      
      // First failure
      await expect(circuitBreaker.execute(mockOperation, 'test-op')).rejects.toThrow();
      expect(circuitBreaker.getStatus().failureCount).toBe(1);
      
      // Second failure
      await expect(circuitBreaker.execute(mockOperation, 'test-op')).rejects.toThrow();
      expect(circuitBreaker.getStatus().failureCount).toBe(2);
      
      // Third failure should open circuit
      await expect(circuitBreaker.execute(mockOperation, 'test-op')).rejects.toThrow();
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
    });

    it('should count throttling errors towards failure threshold', async () => {
      const throttlingError = new Error('ThrottlingException');
      (throttlingError as any).name = 'ThrottlingException';
      const mockOperation = vi.fn().mockRejectedValue(throttlingError);
      
      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation, 'test-op')).rejects.toThrow();
      }
      
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
    });

    it('should not count non-severe errors towards failure threshold', async () => {
      const nonSevereError = new Error('ValidationError');
      const mockOperation = vi.fn().mockRejectedValue(nonSevereError);
      
      // Multiple non-severe failures
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(mockOperation, 'test-op')).rejects.toThrow();
      }
      
      // Should still be closed since errors are not severe
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getStatus().failureCount).toBe(0);
    });

    it('should reset failure count on successful operations', async () => {
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const failingOperation = vi.fn().mockRejectedValue(severeError);
      const successOperation = vi.fn().mockResolvedValue('success');
      
      // Cause a failure
      await expect(circuitBreaker.execute(failingOperation, 'fail-op')).rejects.toThrow();
      expect(circuitBreaker.getStatus().failureCount).toBe(1);
      
      // Success should reset count
      await circuitBreaker.execute(successOperation, 'success-op');
      expect(circuitBreaker.getStatus().failureCount).toBe(0);
    });
  });

  describe('open state behavior', () => {
    beforeEach(async () => {
      // Trip circuit breaker
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const mockOperation = vi.fn().mockRejectedValue(severeError);
      
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation, 'trip-op')).rejects.toThrow();
      }
    });

    it('should reject operations when open', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(mockOperation, 'blocked-op'))
        .rejects.toThrow(CircuitBreakerOpenError);
      
      // Operation should not have been called
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should include next attempt time in open error', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      try {
        await circuitBreaker.execute(mockOperation, 'blocked-op');
        fail('Should have thrown CircuitBreakerOpenError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        expect(error.message).toContain('Next attempt allowed at');
      }
    });

    it('should transition to half-open after recovery timeout', async () => {
      // Fast-forward time
      const futureTime = Date.now() + 1500; // Beyond recovery timeout
      vi.spyOn(Date, 'now').mockReturnValue(futureTime);
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.HALF_OPEN);
      
      vi.restoreAllMocks();
    });
  });

  describe('half-open state behavior', () => {
    beforeEach(async () => {
      // Trip circuit breaker and move to half-open
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const mockOperation = vi.fn().mockRejectedValue(severeError);
      
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation, 'trip-op')).rejects.toThrow();
      }
      
      // Fast-forward time to transition to half-open
      const futureTime = Date.now() + 1500;
      vi.spyOn(Date, 'now').mockReturnValue(futureTime);
      circuitBreaker.getStatus(); // Trigger state update
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should allow operations in half-open state', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(successOperation, 'test-op');
      
      expect(result).toBe('success');
      expect(successOperation).toHaveBeenCalledOnce();
    });

    it('should close circuit on successful operation', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(successOperation, 'success-op');
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failureCount).toBe(0);
    });

    it('should reopen circuit on failed operation', async () => {
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const failingOperation = vi.fn().mockRejectedValue(severeError);
      
      await expect(circuitBreaker.execute(failingOperation, 'fail-op')).rejects.toThrow();
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running operations', async () => {
      const slowOperation = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200)); // Longer than timeout
      });
      
      await expect(circuitBreaker.execute(slowOperation, 'slow-op'))
        .rejects.toThrow(OperationTimeoutError);
    });

    it('should include timeout duration in error message', async () => {
      const slowOperation = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });
      
      try {
        await circuitBreaker.execute(slowOperation, 'timeout-op');
        fail('Should have thrown OperationTimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(OperationTimeoutError);
        expect(error.message).toContain('timed out after 100ms');
      }
    });

    it('should not timeout fast operations', async () => {
      const fastOperation = vi.fn().mockResolvedValue('fast-result');
      
      const result = await circuitBreaker.execute(fastOperation, 'fast-op');
      
      expect(result).toBe('fast-result');
      expect(fastOperation).toHaveBeenCalledOnce();
    });
  });

  describe('disabled circuit breaker', () => {
    beforeEach(() => {
      mockConfig.circuitBreaker.enabled = false;
      circuitBreaker = new CircuitBreaker(mockConfig);
    });

    it('should bypass circuit breaker when disabled', async () => {
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const mockOperation = vi.fn().mockRejectedValue(severeError);
      
      // Multiple failures should not trip circuit breaker
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(mockOperation, 'bypass-op')).rejects.toThrow();
      }
      
      // Should still allow operations (but will still timeout)
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should still enforce timeouts when disabled', async () => {
      const slowOperation = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });
      
      await expect(circuitBreaker.execute(slowOperation, 'timeout-bypass'))
        .rejects.toThrow(OperationTimeoutError);
    });
  });

  describe('configuration options', () => {
    it('should use custom failure threshold', async () => {
      const customConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 1, // Trip after single failure
          recoveryTimeoutMs: 1000,
          timeoutMs: 100,
        },
      };
      const customBreaker = new CircuitBreaker(customConfig);
      
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const mockOperation = vi.fn().mockRejectedValue(severeError);
      
      // Single failure should open circuit
      await expect(customBreaker.execute(mockOperation, 'single-fail')).rejects.toThrow();
      
      expect(customBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
    });

    it('should use custom recovery timeout', async () => {
      const customConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 1,
          recoveryTimeoutMs: 500, // Shorter recovery
          timeoutMs: 100,
        },
      };
      const customBreaker = new CircuitBreaker(customConfig);
      
      // Trip circuit breaker
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const mockOperation = vi.fn().mockRejectedValue(severeError);
      await expect(customBreaker.execute(mockOperation, 'trip')).rejects.toThrow();
      
      // Fast-forward past custom recovery time
      const futureTime = Date.now() + 600;
      vi.spyOn(Date, 'now').mockReturnValue(futureTime);
      
      const status = customBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.HALF_OPEN);
      
      vi.restoreAllMocks();
    });

    it('should use custom operation timeout', async () => {
      const customConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          recoveryTimeoutMs: 1000,
          timeoutMs: 50, // Very short timeout
        },
      };
      const customBreaker = new CircuitBreaker(customConfig);
      
      const slowOperation = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100)); // Longer than custom timeout
      });
      
      await expect(customBreaker.execute(slowOperation, 'custom-timeout'))
        .rejects.toThrow(OperationTimeoutError);
    });
  });

  describe('edge cases', () => {
    it('should handle operations that throw non-Error objects', async () => {
      const mockOperation = vi.fn().mockRejectedValue('string error');
      
      await expect(circuitBreaker.execute(mockOperation, 'string-error')).rejects.toBe('string error');
      
      // Should not affect circuit breaker state since it's not a severe error
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should handle operations that throw null/undefined', async () => {
      const mockOperation = vi.fn().mockRejectedValue(null);
      
      await expect(circuitBreaker.execute(mockOperation, 'null-error')).rejects.toBeNull();
      
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should handle operations with very long names', async () => {
      const longOperationName = 'x'.repeat(1000);
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation, longOperationName);
      
      expect(result).toBe('success');
    });

    it('should handle rapid state transitions', async () => {
      const severeError = new Error('ServiceUnavailable');
      (severeError as any).name = 'ServiceUnavailable';
      const failOperation = vi.fn().mockRejectedValue(severeError);
      const successOperation = vi.fn().mockResolvedValue('success');
      
      // Trip circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failOperation, 'rapid-fail')).rejects.toThrow();
      }
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.OPEN);
      
      // Move to half-open
      const futureTime = Date.now() + 1500;
      vi.spyOn(Date, 'now').mockReturnValue(futureTime);
      circuitBreaker.getStatus();
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Succeed to close
      await circuitBreaker.execute(successOperation, 'rapid-success');
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
      
      vi.restoreAllMocks();
    });
  });
});