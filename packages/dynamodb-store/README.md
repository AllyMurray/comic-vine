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
}
```

## Available Stores

- `DynamoDBCacheStore` - Implements `CacheStore<T>` for API response caching
- `DynamoDBDedupeStore` - Implements `DedupeStore<T>` for request deduplication
- `DynamoDBRateLimitStore` - Implements `RateLimitStore` for rate limiting
- `DynamoDBAdaptiveRateLimitStore` - Implements `AdaptiveRateLimitStore` for priority-based rate limiting

## Status

🚧 **In Development** - Core infrastructure complete, store implementations coming in Phase 2.

## License

MIT
