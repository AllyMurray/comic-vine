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

## Configuration

All stores accept the same configuration options:

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
  AdaptiveDelayCalculator 
} from '@comic-vine/dynamodb-store';

// Execute operations in parallel with concurrency control
const results = await executeInParallel(
  items,
  async (item) => await processItem(item),
  { maxConcurrency: 10 }
);

// Batch writer for efficient bulk operations
const batchWriter = new BatchWriter(
  config,
  async (batch) => await writeBatch(batch)
);

// Add items to batch
items.forEach(item => batchWriter.add(item));

// Flush all batches
await batchWriter.flush();
```

### Error Handling and Resilience

Comprehensive error handling with automatic retry logic:

```typescript
import { 
  CircuitBreakerOpenError, 
  ThrottlingError, 
  OperationTimeoutError 
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

## Status

✅ **Phase 3 Complete** - Enhanced connection management, circuit breaker pattern, and performance optimizations implemented.

## License

MIT
