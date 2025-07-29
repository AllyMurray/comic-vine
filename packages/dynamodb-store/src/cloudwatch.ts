import type { MetricData } from './monitoring.js';

/**
 * CloudWatch integration for sending metrics to AWS CloudWatch
 */
export interface CloudWatchClient {
  putMetricData(params: {
    Namespace: string;
    MetricData: Array<MetricData>;
  }): Promise<void>;
}

/**
 * CloudWatch metrics publisher
 */
export class CloudWatchMetricsPublisher {
  private client?: CloudWatchClient;
  private namespace: string;
  private batchSize: number;
  private flushIntervalMs: number;
  private metricBuffer: Array<MetricData> = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    client: CloudWatchClient | undefined,
    namespace: string = 'DynamoDBStore',
    options: {
      batchSize?: number;
      flushIntervalMs?: number;
    } = {},
  ) {
    this.client = client;
    this.namespace = namespace;
    this.batchSize = options.batchSize || 20; // CloudWatch limit is 20 metrics per request
    this.flushIntervalMs = options.flushIntervalMs || 60000; // 1 minute

    if (this.client) {
      this.startFlushTimer();
    }
  }

  /**
   * Add metrics to the buffer for publishing
   */
  addMetrics(metrics: Array<MetricData>): void {
    if (!this.client || metrics.length === 0) {
      return;
    }

    this.metricBuffer.push(...metrics);

    // Auto-flush if buffer is getting full
    if (this.metricBuffer.length >= this.batchSize) {
      this.flush().catch((error) => {
        console.error('Failed to auto-flush CloudWatch metrics:', error);
      });
    }
  }

  /**
   * Immediately flush all buffered metrics to CloudWatch
   */
  async flush(): Promise<void> {
    if (!this.client || this.metricBuffer.length === 0) {
      return;
    }

    const metricsToSend = this.metricBuffer.splice(0);
    const batches = this.createBatches(metricsToSend);

    try {
      await Promise.all(
        batches.map((batch) =>
          this.client!.putMetricData({
            Namespace: this.namespace,
            MetricData: batch,
          }),
        ),
      );
    } catch (error) {
      // Re-add metrics to buffer on failure for retry
      this.metricBuffer.unshift(...metricsToSend);
      throw error;
    }
  }

  /**
   * Stop the flush timer and clean up
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush any remaining metrics
    await this.flush();
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.metricBuffer.length;
  }

  private createBatches(metrics: Array<MetricData>): Array<Array<MetricData>> {
    const batches: Array<Array<MetricData>> = [];

    for (let i = 0; i < metrics.length; i += this.batchSize) {
      batches.push(metrics.slice(i, i + this.batchSize));
    }

    return batches;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        console.error('Failed to flush CloudWatch metrics on timer:', error);
      }
    }, this.flushIntervalMs);

    // Don't keep the process alive just for metric flushing
    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }
}

/**
 * Create a CloudWatch client wrapper for AWS SDK v3
 */
export function createCloudWatchClient(): CloudWatchClient | undefined {
  try {
    // Dynamically import AWS SDK to avoid requiring it if not used

    const {
      CloudWatchClient,
      PutMetricDataCommand,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    } = require('@aws-sdk/client-cloudwatch');

    const client = new CloudWatchClient({});

    return {
      async putMetricData(params) {
        const command = new PutMetricDataCommand(params);
        await client.send(command);
      },
    };
  } catch {
    console.warn(
      'CloudWatch client not available - install @aws-sdk/client-cloudwatch for metrics support',
    );
    return undefined;
  }
}

/**
 * Utility functions for common CloudWatch metric patterns
 */
export class CloudWatchMetrics {
  static createDurationMetric(
    operationName: string,
    duration: number,
    dimensions?: Record<string, string>,
  ): MetricData {
    return {
      MetricName: 'OperationDuration',
      Value: duration,
      Unit: 'Seconds',
      Timestamp: new Date(),
      Dimensions: this.buildDimensions({
        Operation: operationName,
        ...dimensions,
      }),
    };
  }

  static createCountMetric(
    metricName: string,
    count: number = 1,
    dimensions?: Record<string, string>,
  ): MetricData {
    return {
      MetricName: metricName,
      Value: count,
      Unit: 'Count',
      Timestamp: new Date(),
      Dimensions: this.buildDimensions(dimensions),
    };
  }

  static createErrorMetric(
    operationName: string,
    errorType: string,
    dimensions?: Record<string, string>,
  ): MetricData {
    return {
      MetricName: 'Errors',
      Value: 1,
      Unit: 'Count',
      Timestamp: new Date(),
      Dimensions: this.buildDimensions({
        Operation: operationName,
        ErrorType: errorType,
        ...dimensions,
      }),
    };
  }

  static createCacheMetrics(
    storeName: string,
    stats: {
      totalItems?: number;
      expiredItems?: number;
      estimatedSizeBytes?: number;
      hitRate?: number;
    },
  ): Array<MetricData> {
    const metrics: Array<MetricData> = [];
    const commonDimensions = { Store: storeName };

    if (stats.totalItems !== undefined) {
      metrics.push({
        MetricName: 'CacheTotalItems',
        Value: stats.totalItems,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    if (stats.expiredItems !== undefined) {
      metrics.push({
        MetricName: 'CacheExpiredItems',
        Value: stats.expiredItems,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    if (stats.estimatedSizeBytes !== undefined) {
      metrics.push({
        MetricName: 'CacheSize',
        Value: stats.estimatedSizeBytes,
        Unit: 'Bytes',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    if (stats.hitRate !== undefined) {
      metrics.push({
        MetricName: 'CacheHitRate',
        Value: stats.hitRate * 100, // Convert to percentage
        Unit: 'Percent',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    return metrics;
  }

  static createRateLimitMetrics(
    resource: string,
    stats: {
      remaining?: number;
      limit?: number;
      utilizationPercent?: number;
    },
  ): Array<MetricData> {
    const metrics: Array<MetricData> = [];
    const commonDimensions = { Resource: resource };

    if (stats.remaining !== undefined) {
      metrics.push({
        MetricName: 'RateLimitRemaining',
        Value: stats.remaining,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    if (stats.limit !== undefined) {
      metrics.push({
        MetricName: 'RateLimitTotal',
        Value: stats.limit,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    if (stats.utilizationPercent !== undefined) {
      metrics.push({
        MetricName: 'RateLimitUtilization',
        Value: stats.utilizationPercent,
        Unit: 'Percent',
        Timestamp: new Date(),
        Dimensions: this.buildDimensions(commonDimensions),
      });
    }

    return metrics;
  }

  private static buildDimensions(
    dimensions?: Record<string, string>,
  ): MetricData['Dimensions'] {
    if (!dimensions) return undefined;

    return Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }));
  }
}

/**
 * CloudWatch dashboard configuration helper
 */
export class CloudWatchDashboardConfig {
  static createDynamoDBStoreDashboard(
    _dashboardName: string = 'DynamoDBStore',
    _namespace: string = 'DynamoDBStore',
  ): string {
    const dashboard = {
      widgets: [
        // Operation Duration
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              [_namespace, 'OperationDuration', 'Operation', 'cache.get'],
              ['.', '.', '.', 'cache.set'],
              ['.', '.', '.', 'dedupe.register'],
              ['.', '.', '.', 'rateLimit.canProceed'],
            ],
            period: 300,
            stat: 'Average',
            region: 'us-east-1',
            title: 'Operation Duration (Average)',
            yAxis: {
              left: {
                min: 0,
              },
            },
          },
        },
        // Operation Count
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              [_namespace, 'OperationCount', 'Operation', 'cache.get'],
              ['.', '.', '.', 'cache.set'],
              ['.', '.', '.', 'dedupe.register'],
              ['.', '.', '.', 'rateLimit.canProceed'],
            ],
            period: 300,
            stat: 'Sum',
            region: 'us-east-1',
            title: 'Operation Count',
            yAxis: {
              left: {
                min: 0,
              },
            },
          },
        },
        // Error Rate
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              [_namespace, 'Errors', 'Operation', 'cache.get'],
              ['.', '.', '.', 'cache.set'],
              ['.', '.', '.', 'dedupe.register'],
              ['.', '.', '.', 'rateLimit.canProceed'],
            ],
            period: 300,
            stat: 'Sum',
            region: 'us-east-1',
            title: 'Error Count',
            yAxis: {
              left: {
                min: 0,
              },
            },
          },
        },
        // Circuit Breaker State
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            metrics: [],
            period: 300,
            stat: 'Maximum',
            region: 'us-east-1',
            title: 'Circuit Breaker State (0=Closed, 1=Half-Open, 2=Open)',
            yAxis: {
              left: {
                min: 0,
                max: 2,
              },
            },
          },
        },
      ],
    };

    return JSON.stringify(dashboard, null, 2);
  }

  static createAlarmConfiguration(_namespace: string = 'DynamoDBStore'): Array<{
    AlarmName: string;
    MetricName: string;
    ComparisonOperator: string;
    Threshold: number;
    EvaluationPeriods: number;
    Description: string;
  }> {
    return [
      {
        AlarmName: 'DynamoDBStore-HighErrorRate',
        MetricName: 'Errors',
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 10,
        EvaluationPeriods: 2,
        Description: 'Alarm when error rate is high',
      },
      {
        AlarmName: 'DynamoDBStore-HighLatency',
        MetricName: 'OperationDuration',
        ComparisonOperator: 'GreaterThanThreshold',
        Threshold: 1.0, // 1 second
        EvaluationPeriods: 3,
        Description: 'Alarm when operation latency is high',
      },
    ];
  }
}
