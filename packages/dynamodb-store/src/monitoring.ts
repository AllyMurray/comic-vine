import { randomUUID } from 'node:crypto';

/**
 * Correlation ID for tracing requests across operations
 */
export interface CorrelationContext {
  correlationId: string;
  operationName: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * Metrics data structure for CloudWatch integration
 */
export interface MetricData {
  MetricName: string;
  Value: number;
  Unit: 'Count' | 'Seconds' | 'Bytes' | 'Percent';
  Timestamp?: Date;
  Dimensions?: Array<{
    Name: string;
    Value: string;
  }>;
}

/**
 * Performance monitoring data
 */
export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  success: boolean;
  errorType?: string;
  itemCount?: number;
  dataSize?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<
    string,
    {
      status: 'pass' | 'warn' | 'fail';
      message?: string;
      duration?: number;
      observed?: unknown;
      expected?: unknown;
    }
  >;
  timestamp: Date;
  version?: string;
}

/**
 * Structured logger interface
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /**
   * Whether to enable CloudWatch metrics
   */
  cloudWatchEnabled?: boolean;

  /**
   * CloudWatch namespace for metrics
   */
  cloudWatchNamespace?: string;

  /**
   * Whether to enable structured logging
   */
  loggingEnabled?: boolean;

  /**
   * Custom logger instance
   */
  logger?: Logger;

  /**
   * Whether to enable performance monitoring
   */
  performanceMonitoringEnabled?: boolean;

  /**
   * Whether to enable health checks
   */
  healthChecksEnabled?: boolean;

  /**
   * Custom dimensions to add to all metrics
   */
  defaultDimensions?: Record<string, string>;

  /**
   * Sampling rate for performance metrics (0-1)
   */
  performanceSamplingRate?: number;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements Logger {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(this.formatMessage('DEBUG', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(this.formatMessage('ERROR', message, context));
  }

  private formatMessage(
    level: string,
    message: string,
    context?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    return `[${timestamp}] ${level}: ${message}${contextStr ? ' ' + contextStr : ''}`;
  }
}

/**
 * Performance monitoring and metrics collection
 */
export class Monitor {
  private config: MonitoringConfig;
  private logger: Logger;
  private metrics: Array<MetricData> = [];
  private correlationStack: Array<CorrelationContext> = [];

  constructor(config: MonitoringConfig = {}) {
    this.config = {
      cloudWatchEnabled: false,
      cloudWatchNamespace: 'DynamoDBStore',
      loggingEnabled: true,
      performanceMonitoringEnabled: true,
      healthChecksEnabled: false,
      performanceSamplingRate: 1.0,
      ...config,
    };

    this.logger = this.config.logger || new ConsoleLogger();
  }

  /**
   * Start a new operation with correlation tracking
   */
  startOperation(
    operationName: string,
    metadata?: Record<string, unknown>,
  ): CorrelationContext {
    const context: CorrelationContext = {
      correlationId: randomUUID(),
      operationName,
      startTime: performance.now(),
      metadata,
    };

    this.correlationStack.push(context);

    if (this.config.loggingEnabled) {
      this.logger.debug(`Starting operation: ${operationName}`, {
        correlationId: context.correlationId,
        ...metadata,
      });
    }

    return context;
  }

  /**
   * End an operation and collect metrics
   */
  endOperation(
    context: CorrelationContext,
    success: boolean,
    error?: Error,
  ): void {
    const endTime = performance.now();
    const duration = endTime - context.startTime;

    // Remove from stack
    const index = this.correlationStack.findIndex(
      (c) => c.correlationId === context.correlationId,
    );
    if (index >= 0) {
      this.correlationStack.splice(index, 1);
    }

    const metrics: PerformanceMetrics = {
      operationName: context.operationName,
      duration,
      success,
      errorType: error?.name,
    };

    // Log operation completion
    if (this.config.loggingEnabled) {
      const logLevel = success ? 'info' : 'error';
      const message = `Operation ${success ? 'completed' : 'failed'}: ${context.operationName}`;
      const logContext = {
        correlationId: context.correlationId,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        ...context.metadata,
        ...(error && { error: error.message, errorType: error.name }),
      };

      this.logger[logLevel](message, logContext);
    }

    // Collect performance metrics
    if (this.config.performanceMonitoringEnabled && this.shouldSample()) {
      this.recordPerformanceMetrics(metrics);
    }
  }

  /**
   * Record custom metrics
   */
  recordMetric(
    metricName: string,
    value: number,
    unit: MetricData['Unit'],
    dimensions?: Record<string, string>,
  ): void {
    if (!this.config.cloudWatchEnabled) {
      return;
    }

    const metric: MetricData = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: this.buildDimensions(dimensions),
    };

    this.metrics.push(metric);

    if (this.config.loggingEnabled) {
      this.logger.debug(`Recorded metric: ${metricName}`, {
        value,
        unit,
        dimensions,
      });
    }
  }

  /**
   * Record store statistics
   */
  recordStoreStats(storeName: string, stats: Record<string, number>): void {
    if (!this.config.performanceMonitoringEnabled) {
      return;
    }

    for (const [statName, statValue] of Object.entries(stats)) {
      let unit: MetricData['Unit'] = 'Count';

      // Determine appropriate unit based on stat name
      if (
        statName.toLowerCase().includes('bytes') ||
        statName.toLowerCase().includes('size')
      ) {
        unit = 'Bytes';
      } else if (
        statName.toLowerCase().includes('duration') ||
        statName.toLowerCase().includes('time')
      ) {
        unit = 'Seconds';
      } else if (
        statName.toLowerCase().includes('percent') ||
        statName.toLowerCase().includes('utilization')
      ) {
        unit = 'Percent';
      }

      this.recordMetric(`Store${statName}`, statValue, unit, {
        StoreName: storeName,
      });
    }
  }

  /**
   * Get current correlation ID
   */
  getCurrentCorrelationId(): string | undefined {
    return this.correlationStack.length > 0
      ? this.correlationStack[this.correlationStack.length - 1]!.correlationId
      : undefined;
  }

  /**
   * Get all collected metrics and clear the buffer
   */
  getMetrics(): Array<MetricData> {
    const metrics = [...this.metrics];
    this.metrics = [];
    return metrics;
  }

  /**
   * Perform health check
   */
  async performHealthCheck(
    storeName: string,
    healthCheckFn: () => Promise<{
      success: boolean;
      duration: number;
      details?: unknown;
    }>,
  ): Promise<HealthCheckResult> {
    if (!this.config.healthChecksEnabled) {
      return {
        status: 'healthy',
        checks: {},
        timestamp: new Date(),
      };
    }

    const checks: HealthCheckResult['checks'] = {};
    let overallStatus: HealthCheckResult['status'] = 'healthy';

    try {
      const startTime = performance.now();
      const result = await healthCheckFn();
      const duration = performance.now() - startTime;

      checks[storeName] = {
        status: result.success ? 'pass' : 'fail',
        duration: Math.round(duration * 100) / 100,
        observed: result.details,
      };

      if (!result.success) {
        overallStatus = 'unhealthy';
      }

      // Record health check metrics
      this.recordMetric('HealthCheck', result.success ? 1 : 0, 'Count', {
        StoreName: storeName,
        Status: result.success ? 'pass' : 'fail',
      });

      this.recordMetric('HealthCheckDuration', duration / 1000, 'Seconds', {
        StoreName: storeName,
      });
    } catch (error) {
      checks[storeName] = {
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      };
      overallStatus = 'unhealthy';

      if (this.config.loggingEnabled) {
        this.logger.error(`Health check failed for ${storeName}`, {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.getCurrentCorrelationId(),
        });
      }
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date(),
    };
  }

  /**
   * Create a child monitor with additional context
   */
  createChild(additionalDimensions?: Record<string, string>): Monitor {
    return new Monitor({
      ...this.config,
      defaultDimensions: {
        ...this.config.defaultDimensions,
        ...additionalDimensions,
      },
    });
  }

  private recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    const dimensions = {
      OperationName: metrics.operationName,
      Success: metrics.success.toString(),
      ...(metrics.errorType && { ErrorType: metrics.errorType }),
    };

    // Record operation duration
    this.recordMetric(
      'OperationDuration',
      metrics.duration / 1000,
      'Seconds',
      dimensions,
    );

    // Record operation count
    this.recordMetric('OperationCount', 1, 'Count', dimensions);

    // Record error count if failed
    if (!metrics.success) {
      this.recordMetric('ErrorCount', 1, 'Count', {
        OperationName: metrics.operationName,
        ErrorType: metrics.errorType || 'Unknown',
      });
    }

    // Record item count if available
    if (metrics.itemCount !== undefined) {
      this.recordMetric('ItemCount', metrics.itemCount, 'Count', dimensions);
    }

    // Record data size if available
    if (metrics.dataSize !== undefined) {
      this.recordMetric('DataSize', metrics.dataSize, 'Bytes', dimensions);
    }
  }

  private buildDimensions(
    customDimensions?: Record<string, string>,
  ): MetricData['Dimensions'] {
    const allDimensions = {
      ...this.config.defaultDimensions,
      ...customDimensions,
    };

    return Object.entries(allDimensions).map(([Name, Value]) => ({
      Name,
      Value,
    }));
  }

  private shouldSample(): boolean {
    return Math.random() < (this.config.performanceSamplingRate || 1.0);
  }
}

/**
 * Global monitor instance
 */
let globalMonitor: Monitor | undefined;

/**
 * Get or create global monitor instance
 */
export function getGlobalMonitor(config?: MonitoringConfig): Monitor {
  if (!globalMonitor) {
    globalMonitor = new Monitor(config);
  }
  return globalMonitor;
}

/**
 * Set global monitor instance
 */
export function setGlobalMonitor(monitor: Monitor): void {
  globalMonitor = monitor;
}

/**
 * Decorator for monitoring method execution
 */
export function monitorOperation(operationName?: string) {
  return function <T extends (...args: Array<unknown>) => Promise<unknown>>(
    target: Record<string, unknown>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const originalMethod = descriptor.value!;
    const opName =
      operationName ||
      `${(target.constructor as { name: string }).name}.${propertyKey}`;

    descriptor.value = async function (this: unknown, ...args: Array<unknown>) {
      const monitor = getGlobalMonitor();
      const context = monitor.startOperation(opName, {
        className: (target.constructor as { name: string }).name,
        methodName: propertyKey,
      });

      try {
        const result = await originalMethod.apply(this, args);
        monitor.endOperation(context, true);
        return result;
      } catch (error) {
        monitor.endOperation(context, false, error as Error);
        throw error;
      }
    } as T;

    return descriptor;
  };
}
