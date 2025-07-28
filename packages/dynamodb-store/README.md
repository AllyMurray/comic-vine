# @comic-vine/dynamodb-store

DynamoDB-backed implementations of Comic Vine client store interfaces for caching, deduplication, and rate limiting.

## Installation

```bash
pnpm add @comic-vine/dynamodb-store
```

## Prerequisites

**Important**: This package does not create DynamoDB tables automatically. You must create the required table structure before using the stores.

### Required DynamoDB Table Structure

Create a DynamoDB table with the following specifications:

```yaml
Table Name: comic-vine-store (or your custom name)
Partition Key: PK (String)
Sort Key: SK (String)
TTL Attribute: TTL (Number) - Enable TTL on this attribute

Global Secondary Index 1:
  Name: GSI1
  Partition Key: GSI1PK (String)
  Sort Key: GSI1SK (String)
  Projection: ALL
```

### AWS CLI Table Creation Example

```bash
# Create the main table
aws dynamodb create-table \
  --table-name comic-vine-store \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=GSI1,KeySchema='[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
  --billing-mode PAY_PER_REQUEST

# Enable TTL on the TTL attribute
aws dynamodb update-time-to-live \
  --table-name comic-vine-store \
  --time-to-live-specification \
    Enabled=true,AttributeName=TTL
```

### CloudFormation Template

```yaml
Resources:
  ComicVineStoreTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: comic-vine-store
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: GSI1PK
          AttributeType: S
        - AttributeName: GSI1SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - AttributeName: GSI1PK
              KeyType: HASH
            - AttributeName: GSI1SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      BillingMode: PAY_PER_REQUEST
      TimeToLiveSpecification:
        AttributeName: TTL
        Enabled: true
```

## Quick Start

```typescript
import { DynamoDBCacheStore } from '@comic-vine/dynamodb-store';

// Basic usage with default configuration
const cacheStore = new DynamoDBCacheStore({
  tableName: 'comic-vine-store', // Your DynamoDB table name
  region: 'us-east-1',
});

// Cache a value with 1 hour TTL
await cacheStore.set('cache-key', { data: 'value' }, 3600);

// Retrieve cached value
const cached = await cacheStore.get('cache-key');
```

## Store Examples

### Cache Store

The cache store provides TTL-based caching with automatic cleanup:

```typescript
import { DynamoDBCacheStore } from '@comic-vine/dynamodb-store';

const cacheStore = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  cleanupIntervalMs: 300000, // Clean up expired items every 5 minutes
});

// Store different data types
await cacheStore.set('user:123', { id: 123, name: 'John' }, 3600);
await cacheStore.set('config', { theme: 'dark', lang: 'en' }, 7200);

// Retrieve values
const user = await cacheStore.get<{ id: number; name: string }>('user:123');
const config = await cacheStore.get<{ theme: string; lang: string }>('config');

// Manual cleanup and statistics
const deletedCount = await cacheStore.cleanup();
const stats = await cacheStore.getStats();
console.log(
  `Cache contains ${stats.totalItems} items (${stats.expiredItems} expired)`,
);

// Clean shutdown
await cacheStore.close();
```

### Dedupe Store

The dedupe store prevents duplicate concurrent operations:

```typescript
import { DynamoDBDedupeStore } from '@comic-vine/dynamodb-store';

const dedupeStore = new DynamoDBDedupeStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  defaultTtlSeconds: 300, // Jobs expire after 5 minutes
  maxWaitTimeMs: 30000, // Wait up to 30 seconds for completion
});

async function processExpensiveOperation(hash: string) {
  // Check if operation is already in progress
  const existing = await dedupeStore.waitFor(hash);
  if (existing !== undefined) {
    return existing; // Another process completed it
  }

  // Register new job
  const jobId = await dedupeStore.register(hash);

  try {
    // Perform expensive operation
    const result = await performActualWork(hash);

    // Mark as completed
    await dedupeStore.complete(hash, result);
    return result;
  } catch (error) {
    // Mark as failed
    await dedupeStore.fail(hash, error);
    throw error;
  }
}

// Usage
const result1 = processExpensiveOperation('operation-1'); // Will execute
const result2 = processExpensiveOperation('operation-1'); // Will wait for result1

await dedupeStore.close();
```

### Rate Limit Store

The rate limit store provides resource-based rate limiting:

```typescript
import { DynamoDBRateLimitStore } from '@comic-vine/dynamodb-store';

const rateLimitStore = new DynamoDBRateLimitStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  defaultConfig: {
    limit: 100, // 100 requests per window
    windowMs: 60 * 1000, // 1 minute window
  },
});

async function apiCall(resource: string) {
  // Check if we can proceed
  if (!(await rateLimitStore.canProceed(resource))) {
    const waitTime = await rateLimitStore.getWaitTime(resource);
    throw new Error(`Rate limited. Wait ${waitTime}ms`);
  }

  // Record the request
  await rateLimitStore.record(resource);

  // Make the actual API call
  return makeRequest(resource);
}

// Get status for monitoring
const status = await rateLimitStore.getStatus('api-endpoint');
console.log(`${status.remaining}/${status.limit} requests remaining`);
console.log(`Resets at: ${status.resetTime}`);

// Per-resource configuration
rateLimitStore.setResourceConfig('slow-api', {
  limit: 10,
  windowMs: 60 * 1000, // More restrictive for slow API
});

rateLimitStore.setResourceConfig('fast-api', {
  limit: 1000,
  windowMs: 60 * 1000, // More permissive for fast API
});

// Get current configuration for a resource
const config = rateLimitStore.getResourceConfig('slow-api');
console.log(`slow-api limit: ${config.limit} per ${config.windowMs}ms`);

await rateLimitStore.close();
```

### Adaptive Rate Limit Store

The adaptive rate limit store provides priority-aware rate limiting:

```typescript
import { DynamoDBAdaptiveRateLimitStore } from '@comic-vine/dynamodb-store';

const adaptiveStore = new DynamoDBAdaptiveRateLimitStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  defaultConfig: {
    limit: 200,
    windowMs: 60 * 1000, // 1 minute window
  },
  adaptiveConfig: {
    monitoringWindowMs: 15 * 60 * 1000, // 15 minute monitoring window
    highActivityThreshold: 10, // 10+ user requests = high activity
    backgroundPauseOnIncreasingTrend: true,
  },
});

// User-initiated request (high priority)
async function userRequest(resource: string) {
  if (!(await adaptiveStore.canProceed(resource, 'user'))) {
    throw new Error('User request rate limited');
  }

  await adaptiveStore.record(resource, 'user');
  return performUserOperation();
}

// Background task (lower priority)
async function backgroundTask(resource: string) {
  if (!(await adaptiveStore.canProceed(resource, 'background'))) {
    const waitTime = await adaptiveStore.getWaitTime(resource, 'background');
    console.log(`Background task paused for ${waitTime}ms`);
    return; // Skip this iteration
  }

  await adaptiveStore.record(resource, 'background');
  return performBackgroundWork();
}

// Monitor adaptive behavior
const status = await adaptiveStore.getStatus('api');
console.log('Adaptive status:', status.adaptive);

await adaptiveStore.close();
```

## Configuration

All stores accept common DynamoDB configuration options:

```typescript
interface DynamoDBStoreOptions {
  tableName?: string; // Default: 'comic-vine-store'
  region?: string; // AWS region
  endpoint?: string; // Custom endpoint (for local DynamoDB)
  client?: DynamoDBClient; // Existing DynamoDB client
  maxRetries?: number; // Default: 3
  retryDelayMs?: number; // Default: 100ms
  batchSize?: number; // Default: 25 (DynamoDB max)
  cleanupIntervalMs?: number; // Default: 300000 (5 minutes)
  circuitBreaker?: {
    failureThreshold?: number; // Default: 5
    recoveryTimeoutMs?: number; // Default: 60000 (1 minute)
    timeoutMs?: number; // Default: 30000 (30 seconds)
    enabled?: boolean; // Default: true
  };
  monitoring?: {
    cloudWatch?: {
      enabled?: boolean; // Default: false
      namespace?: string; // Default: 'DynamoDBStore'
      region?: string;
    };
    logging?: {
      enabled?: boolean; // Default: true
      level?: 'debug' | 'info' | 'warn' | 'error';
    };
  };
}

// Rate limit stores also accept:
interface RateLimitStoreOptions {
  defaultConfig?: RateLimitConfig; // { limit: 200, windowMs: 60000 }
  resourceConfigs?: Map<string, RateLimitConfig>; // Per-resource overrides
}

// Dedupe store specific options:
interface DedupeStoreOptions {
  defaultTtlSeconds?: number; // Default: 300 (5 minutes)
  maxWaitTimeMs?: number; // Default: 30000 (30 seconds)
  pollIntervalMs?: number; // Default: 100ms
}

// Adaptive rate limit store additional options:
interface AdaptiveRateLimitStoreOptions {
  adaptiveConfig?: {
    monitoringWindowMs?: number; // Default: 15 * 60 * 1000
    highActivityThreshold?: number; // Default: 10
    moderateActivityThreshold?: number; // Default: 3
    recalculationIntervalMs?: number; // Default: 30000
    sustainedInactivityThresholdMs?: number; // Default: 30 * 60 * 1000
    backgroundPauseOnIncreasingTrend?: boolean; // Default: true
    maxUserScaling?: number; // Default: 2.0
    minUserReserved?: number; // Default: 5
  };
}
```

## Available Stores

- `DynamoDBCacheStore` - Implements `CacheStore<T>` for API response caching
- `DynamoDBDedupeStore` - Implements `DedupeStore<T>` for request deduplication
- `DynamoDBRateLimitStore` - Implements `RateLimitStore` for rate limiting
- `DynamoDBAdaptiveRateLimitStore` - Implements `AdaptiveRateLimitStore` for priority-based rate limiting

## Advanced Features

### Circuit Breaker Pattern

All stores include circuit breaker protection to prevent cascading failures:

```typescript
const cacheStore = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  circuitBreaker: {
    failureThreshold: 5, // Open circuit after 5 consecutive failures
    recoveryTimeoutMs: 60000, // Wait 1 minute before retry
    timeoutMs: 30000, // 30 second operation timeout
    enabled: true,
  },
});

// Check circuit breaker status
const status = cacheStore.getCircuitBreakerStatus();
console.log(`Circuit breaker state: ${status.state}`);

// Reset circuit breaker if needed
cacheStore.resetCircuitBreaker();
```

### Performance Optimization

The package includes utilities for optimizing DynamoDB operations:

```typescript
import {
  executeInParallel,
  BatchWriter,
  AdaptiveDelayCalculator,
} from '@comic-vine/dynamodb-store';

// Execute operations in parallel with concurrency control
const results = await executeInParallel(
  items,
  async (item) => await processItem(item),
  { maxConcurrency: 10 },
);

// Batch writer for efficient bulk operations
const batchWriter = new BatchWriter(
  config,
  async (batch) => await writeBatch(batch),
);

// Add items to batch
items.forEach((item) => batchWriter.add(item));

// Flush all batches
await batchWriter.flush();
```

### Error Handling and Resilience

Comprehensive error handling with automatic retry logic:

```typescript
import {
  CircuitBreakerOpenError,
  ThrottlingError,
  OperationTimeoutError,
} from '@comic-vine/dynamodb-store';

try {
  await cacheStore.get('key');
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Circuit breaker is open, service degraded
    console.log('Service temporarily unavailable');
  } else if (error instanceof ThrottlingError) {
    // DynamoDB is throttling requests
    console.log('Rate limited, backing off');
  } else if (error instanceof OperationTimeoutError) {
    // Operation timed out
    console.log('Operation timed out');
  }
}
```

## Infrastructure Setup

### Auto-Scaling Configuration

To enable DynamoDB auto-scaling for your table:

1. **Enable Auto-Scaling via AWS Console:**
   - Navigate to your DynamoDB table
   - Go to "Capacity" tab
   - Enable "Auto scaling" for read and write capacity
   - Set target utilization (recommended: 70%)
   - Configure minimum and maximum capacity units

2. **Monitor Auto-Scaling Events:**
   - Use CloudWatch metrics to monitor capacity utilization
   - Set up alarms for capacity changes
   - Review scaling patterns regularly

### Backup and Restore

**Point-in-Time Recovery:**

```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name comic-vine-store \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

**On-Demand Backups:**

```bash
# Create an on-demand backup
aws dynamodb create-backup \
  --table-name comic-vine-store \
  --backup-name comic-vine-store-backup-$(date +%Y%m%d)
```

**Data Export (for large-scale backups):**

- Use DynamoDB Export to S3 for cost-effective backups
- Configure scheduled exports using EventBridge and Lambda
- Consider data lifecycle policies for backup retention

### Multi-Region Setup

**Global Tables (Recommended):**

```bash
# Create global table
aws dynamodb create-global-table \
  --global-table-name comic-vine-store \
  --replication-group RegionName=us-east-1 RegionName=us-west-2
```

**Manual Multi-Region Setup:**

1. Create identical tables in each region
2. Use the same table creation commands from the prerequisites section
3. Implement application-level routing and failover
4. Monitor regional health and latency

**Considerations:**

- Global Tables provide automatic replication and conflict resolution
- Manual setup gives you more control over failover logic
- Consider data consistency requirements (eventual vs strong consistency)
- Monitor cross-region replication lag

## Status

✅ **Phase 5 Complete** - Production-ready with monitoring, observability, and comprehensive documentation.

## Migration Guide

### From In-Memory Store

The DynamoDB stores are drop-in replacements for in-memory stores:

```typescript
// Before: In-memory store
import { InMemoryCacheStore } from '@comic-vine/in-memory-store';
const cache = new InMemoryCacheStore();

// After: DynamoDB store
import { DynamoDBCacheStore } from '@comic-vine/dynamodb-store';
const cache = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
});
```

### From SQLite Store

Migration requires updating the constructor and ensuring DynamoDB table exists:

```typescript
// Before: SQLite store
import { SqliteCacheStore } from '@comic-vine/sqlite-store';
const cache = new SqliteCacheStore({ dbPath: './cache.db' });

// After: DynamoDB store
import { DynamoDBCacheStore } from '@comic-vine/dynamodb-store';
const cache = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  // Optional: reuse existing DynamoDB client
  client: existingDynamoDBClient,
});
```

### Configuration Mapping

| In-Memory/SQLite Option | DynamoDB Equivalent    | Notes                          |
| ----------------------- | ---------------------- | ------------------------------ |
| `maxItems`              | Not applicable         | DynamoDB has no item limits    |
| `maxMemoryBytes`        | Not applicable         | Use TTL for cleanup instead    |
| `cleanupIntervalMs`     | `cleanupIntervalMs`    | Same functionality             |
| `dbPath`                | `tableName` + `region` | DynamoDB table instead of file |

## AWS Deployment Best Practices

### IAM Permissions

Create an IAM policy with minimal required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:region:account:table/comic-vine-store",
        "arn:aws:dynamodb:region:account:table/comic-vine-store/index/*"
      ]
    }
  ]
}
```

### Production Configuration

```typescript
const store = new DynamoDBCacheStore({
  tableName: process.env.DYNAMODB_TABLE_NAME || 'comic-vine-store',
  region: process.env.AWS_REGION || 'us-east-1',

  // Production-optimized settings
  maxRetries: 5,
  retryDelayMs: 200,
  cleanupIntervalMs: 300000, // 5 minutes

  // Circuit breaker for resilience
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    recoveryTimeoutMs: 60000,
    timeoutMs: 30000,
  },
});
```

### Monitoring and Observability

The package includes comprehensive monitoring features:

```typescript
import {
  CloudWatchMetricsPublisher,
  Monitor,
  monitorOperation,
} from '@comic-vine/dynamodb-store';

// Enable CloudWatch metrics
const store = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  monitoring: {
    cloudWatch: {
      enabled: true,
      namespace: 'MyApp/DynamoDBStore',
      region: 'us-east-1',
    },
    logging: {
      enabled: true,
      level: 'info',
    },
    performance: {
      enabled: true,
      samplingRate: 1.0, // Track 100% of operations
    },
    healthChecks: {
      enabled: true,
      intervalMs: 60000, // Health check every minute
    },
  },
});

// Monitor operations with automatic metrics
const result = await monitorOperation(
  'get-user',
  async () => {
    return await store.get('user:123');
  },
  { userId: '123' },
);

// Manual monitoring setup
const monitor = new Monitor();

// Record custom metrics
monitor.recordMetric({
  name: 'cache_hit_rate',
  value: 0.85,
  unit: 'Percent',
  timestamp: new Date(),
});

// Start operation correlation
const correlationId = monitor.startCorrelation('api_call', {
  endpoint: '/users/123',
  method: 'GET',
});

// End correlation with success/failure
monitor.endCorrelation(correlationId, true);

// Health checks
const healthResult = await monitor.performHealthCheck();
console.log('Health check:', healthResult.success ? 'PASS' : 'FAIL');

// Circuit breaker monitoring
setInterval(() => {
  const status = store.getCircuitBreakerStatus();
  if (status.state === 'open') {
    console.warn('Circuit breaker open - DynamoDB issues detected');
    monitor.recordMetric({
      name: 'circuit_breaker_open',
      value: 1,
      unit: 'Count',
      timestamp: new Date(),
    });
  }
}, 60000);
```

**CloudWatch Dashboard Configuration:**

```typescript
import { CloudWatchDashboardConfig } from '@comic-vine/dynamodb-store';

// Generate dashboard configuration
const dashboardJson = CloudWatchDashboardConfig.createDynamoDBStoreDashboard(
  'MyApp-DynamoDB-Store',
);

// Deploy via AWS SDK
import {
  CloudWatchClient,
  PutDashboardCommand,
} from '@aws-sdk/client-cloudwatch';

const cloudWatch = new CloudWatchClient({ region: 'us-east-1' });
await cloudWatch.send(
  new PutDashboardCommand({
    DashboardName: 'MyApp-DynamoDB-Store',
    DashboardBody: dashboardJson,
  }),
);
```

### Cost Optimization

1. **Use TTL for automatic cleanup**: Set appropriate TTL values to avoid manual cleanup costs
2. **Optimize batch sizes**: Use `calculateOptimalBatchSize()` utility for efficient batching
3. **Monitor read/write capacity**: Set up CloudWatch alarms for throttling events
4. **Use on-demand billing**: For unpredictable workloads, consider on-demand pricing

### Multi-Region Deployment

For multi-region setups, create separate table instances per region:

```typescript
// Primary region
const primaryStore = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
});

// Secondary region (for failover)
const secondaryStore = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-west-2',
});

// Simple failover logic
async function getCachedValue(key: string) {
  try {
    return await primaryStore.get(key);
  } catch (error) {
    console.warn('Primary region failed, trying secondary:', error);
    return await secondaryStore.get(key);
  }
}
```

**Setup Requirements:**

- Create identical table structures in each target region
- Configure appropriate IAM permissions for cross-region access
- Consider data consistency requirements for your use case
- Monitor regional health and implement circuit breaker patterns

## Troubleshooting

### Common Issues

1. **Circuit breaker frequently open**
   - Check DynamoDB throttling metrics
   - Increase read/write capacity or use on-demand
   - Reduce request frequency

2. **High latency**
   - Ensure proper AWS region selection
   - Check network connectivity
   - Consider using DynamoDB Accelerator (DAX)

3. **Size limit errors**
   - DynamoDB items are limited to 400KB
   - Consider data compression or splitting large items

4. **TTL not working**
   - Verify TTL is enabled on the table
   - Check TTL attribute name matches `TTL`
   - Allow up to 48 hours for TTL cleanup

### Debug Mode

Enable detailed logging:

```typescript
const store = new DynamoDBCacheStore({
  tableName: 'comic-vine-store',
  region: 'us-east-1',
  // Enable AWS SDK logging
  client: new DynamoDBClient({
    logger: console, // Enable AWS SDK debug logging
  }),
});
```

## Testing

Run the test suite:

```bash
# Run all tests
pnpm test

# Run specific store tests
pnpm test dynamodb-cache-store.test.ts

# Run with coverage
pnpm test --coverage
```

The package includes comprehensive test coverage:

- Unit tests with mocked DynamoDB client
- Error scenario testing
- Circuit breaker functionality testing
- Performance optimization testing
- Configuration validation testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run the test suite: `pnpm test`
5. Run linting: `pnpm run lint`
6. Submit a pull request

## License

MIT
