import {
  CircuitBreakerState,
  CircuitBreakerOpenError,
  OperationTimeoutError,
  type CircuitBreakerStatus,
  type DynamoDBStoreConfig,
} from './types.js';
import { isSevereError, isThrottlingError } from './utils.js';

/**
 * Circuit breaker implementation for DynamoDB operations
 * Prevents cascading failures by temporarily disabling operations
 * when a threshold of consecutive failures is reached
 */
export class CircuitBreaker {
  private status: CircuitBreakerStatus = {
    state: CircuitBreakerState.CLOSED,
    failureCount: 0,
  };

  constructor(private config: DynamoDBStoreConfig) {}

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (!this.config.circuitBreaker.enabled) {
      return this.executeWithTimeout(operation, operationName);
    }

    this.updateState();

    if (this.status.state === CircuitBreakerState.OPEN) {
      throw new CircuitBreakerOpenError(
        operationName,
        new Date(this.status.nextAttemptTime!),
      );
    }

    try {
      const result = await this.executeWithTimeout(operation, operationName);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): CircuitBreakerStatus {
    this.updateState();
    return { ...this.status };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.status = {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
    };
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const timeoutMs = this.config.circuitBreaker.timeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new OperationTimeoutError(operationName, timeoutMs));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private updateState(): void {
    const now = Date.now();

    switch (this.status.state) {
      case CircuitBreakerState.OPEN:
        if (
          this.status.nextAttemptTime &&
          now >= this.status.nextAttemptTime
        ) {
          this.status.state = CircuitBreakerState.HALF_OPEN;
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        // State will change based on the next operation result
        break;

      case CircuitBreakerState.CLOSED:
        // Check if we need to reset failure count after some time
        if (
          this.status.lastFailureTime &&
          now - this.status.lastFailureTime >
            this.config.circuitBreaker.recoveryTimeoutMs
        ) {
          this.status.failureCount = 0;
        }
        break;
    }
  }

  private onSuccess(): void {
    if (this.status.state === CircuitBreakerState.HALF_OPEN) {
      // Recovery successful, close the circuit
      this.status = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
      };
    } else if (this.status.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success
      this.status.failureCount = 0;
    }
  }

  private onFailure(error?: unknown): void {
    const now = Date.now();
    
    // Only count severe errors or throttling errors for circuit breaker
    if (error && (isSevereError(error) || isThrottlingError(error))) {
      this.status.failureCount++;
      this.status.lastFailureTime = now;

      if (this.status.state === CircuitBreakerState.HALF_OPEN) {
        // Failed during half-open, go back to open
        this.openCircuit(now);
      } else if (
        this.status.state === CircuitBreakerState.CLOSED &&
        this.status.failureCount >= this.config.circuitBreaker.failureThreshold
      ) {
        // Threshold reached, open the circuit
        this.openCircuit(now);
      }
    }
  }

  private openCircuit(now: number): void {
    this.status.state = CircuitBreakerState.OPEN;
    this.status.nextAttemptTime = now + this.config.circuitBreaker.recoveryTimeoutMs;
  }
}