# DynamoDB Store Implementation Plan

## Overview

This document outlines the implementation plan for a `@comic-vine/dynamodb-store` package that provides DynamoDB-backed implementations of the Comic Vine client's store interfaces for caching, deduplication, and rate limiting.

## Architecture Analysis

### Existing Store Interfaces

Based on the current codebase, the following interfaces need DynamoDB implementations:

1. **CacheStore<T>** (`packages/client/src/stores/cache-store.ts`)
   - `get(hash: string): Promise<T | undefined>`
   - `set(hash: string, value: T, ttlSeconds: number): Promise<void>`
   - `delete(hash: string): Promise<void>`
   - `clear(): Promise<void>`

2. **DedupeStore<T>** (`packages/client/src/stores/dedupe-store.ts`)
   - `waitFor(hash: string): Promise<T | undefined>`
   - `register(hash: string): Promise<string>`
   - `complete(hash: string, value: T): Promise<void>`
   - `fail(hash: string, error: Error): Promise<void>`
   - `isInProgress(hash: string): Promise<boolean>`

3. **RateLimitStore** (`packages/client/src/stores/rate-limit-store.ts`)
   - `canProceed(resource: string): Promise<boolean>`
   - `record(resource: string): Promise<void>`
   - `getStatus(resource: string): Promise<{remaining: number; resetTime: Date; limit: number}>`
   - `reset(resource: string): Promise<void>`
   - `getWaitTime(resource: string): Promise<number>`

4. **AdaptiveRateLimitStore** (extends RateLimitStore)
   - Same methods but with optional `priority` parameter for user/background requests
   - Enhanced `getStatus()` with adaptive metrics

### Existing Implementation Patterns

From analyzing `sqlite-store` and `in-memory-store`:

- **Consistent naming**: `DynamoDB{Feature}Store` (e.g., `DynamoDBCacheStore`)
- **Constructor options**: Accept configuration objects with sensible defaults
- **Error handling**: Graceful degradation with proper error messages
- **Lifecycle management**: Support for cleanup/destruction
- **Type safety**: Full TypeScript support with proper generics
- **Testing**: Comprehensive test coverage with mocked dependencies

## DynamoDB Design

### Table Architecture

**Single Table Design** with the following structure:

```
Table: comic-vine-store (configurable name)
PK (Partition Key): string - Entity type and identifier
SK (Sort Key): string - Additional context/timestamp
TTL: number - Unix timestamp for auto-expiration
Data: object - Serialized entity data
GSI1PK: string - Global Secondary Index for alternate access patterns
GSI1SK: string - GSI sort key
```

**Note**: Consumers are responsible for creating this table. Complete table creation instructions will be provided in the documentation.

### Entity Patterns

#### Cache Store

```
PK: CACHE#{hash}
SK: DATA
TTL: expiresAt timestamp
Data: { value: T, createdAt: number }
```

#### Dedupe Store

```
PK: DEDUPE#{hash}
SK: JOB#{jobId}
TTL: expiresAt (short-lived, ~5 minutes)
Data: { status: 'pending'|'completed'|'failed', result?: T, error?: string, createdAt: number, updatedAt: number }
```

#### Rate Limit Store

```
PK: RATELIMIT#{resource}
SK: REQ#{timestamp}#{uuid}
TTL: expiresAt (based on rate limit window)
Data: { priority?: 'user'|'background', createdAt: number }
```

#### Adaptive Rate Limit Metadata

```
PK: ADAPTIVE#{resource}
SK: META
Data: {
  userRequestCount: number,
  backgroundRequestCount: number,
  lastCalculation: number,
  backgroundPaused: boolean,
  activityLevel: 'low'|'moderate'|'high',
  reason: string
}
```

### Global Secondary Indexes

**GSI1**: Query by expiration time for cleanup operations

- GSI1PK: `EXPIRES#{entityType}`
- GSI1SK: `{ttl}#{pk}`

### Required Table Structure

Consumers must create a DynamoDB table with the following specifications:

```yaml
Table Name: comic-vine-store (or custom name)
Partition Key: PK (String)
Sort Key: SK (String)
TTL Attribute: TTL (Number)

Global Secondary Index 1:
  Name: GSI1
  Partition Key: GSI1PK (String)
  Sort Key: GSI1SK (String)
  Projection: ALL
```

## Implementation Plan

### Phase 1: Core Infrastructure (High Priority)

#### 1. Package Structure

```
packages/dynamodb-store/
├── src/
│   ├── dynamodb-cache-store.ts ✅
│   ├── dynamodb-dedupe-store.ts ✅
│   ├── dynamodb-rate-limit-store.ts ✅
│   ├── dynamodb-adaptive-rate-limit-store.ts ✅
│   ├── schema.ts ✅
│   ├── client.ts ✅
│   ├── types.ts ✅
│   ├── utils.ts ✅
│   ├── monitoring.ts ✅
│   ├── cloudwatch.ts ✅
│   ├── performance.ts ✅
│   ├── __mocks__/
│   │   └── dynamodb-client.ts ✅
│   └── index.ts ✅
├── package.json ✅
├── tsconfig.json ✅
├── vitest.config.ts ✅
└── README.md ✅
```

#### 2. Dependencies

```json
{
  "dependencies": {
    "@comic-vine/client": "workspace:*",
    "@aws-sdk/client-dynamodb": "^3.x.x",
    "@aws-sdk/lib-dynamodb": "^3.x.x",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/tsup-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "20",
    "tsup": "8.5.0",
    "typescript": "5.8.3",
    "vitest": "3.2.4"
  }
}
```

#### 3. Configuration Schema

```typescript
export const DynamoDBStoreConfigSchema = z.object({
  tableName: z.string().default('comic-vine-store'),
  region: z.string().optional(),
  endpoint: z.string().optional(), // For local DynamoDB
  client: z.any().optional(), // Existing DynamoDB client
  maxRetries: z.number().default(3),
  retryDelayMs: z.number().default(100),
  batchSize: z.number().default(25),
  cleanupIntervalMs: z.number().default(300000), // 5 minutes
});
```

### Phase 2: Core Store Implementations (High Priority)

#### 4. DynamoDB Cache Store

- TTL-based expiration using DynamoDB native TTL
- JSON serialization with size limits (400KB DynamoDB item limit)
- Batch operations for bulk get/set operations
- Automatic cleanup of expired items

Key features:

- `get()`: Single item retrieval with automatic expiration check
- `set()`: Conditional writes to prevent race conditions
- `delete()`: Single item deletion
- `clear()`: Scan and delete all cache items (paginated)

#### 5. DynamoDB Dedupe Store

- Short-lived job tracking (5-minute TTL)
- Atomic job registration with unique job IDs using Node.js `crypto.randomUUID()`
- Polling-based `waitFor()` implementation with exponential backoff
- Status tracking: pending → completed/failed

Key features:

- `waitFor()`: Poll for job completion with configurable timeout
- `register()`: Atomic job creation with UUID generation using Node.js crypto
- `complete()`/`fail()`: Status updates with result/error storage
- `isInProgress()`: Simple status check

#### 6. DynamoDB Rate Limit Store

- Time-window based rate limiting
- Configurable limits per resource type
- Efficient request counting using query operations
- Automatic cleanup of old request records

Key features:

- `canProceed()`: Query recent requests within time window
- `record()`: Store request timestamp with TTL
- `getStatus()`: Calculate remaining requests and reset time
- `getWaitTime()`: Calculate delay until next allowed request

#### 7. DynamoDB Adaptive Rate Limit Store

- Extends basic rate limiting with priority support
- User vs background request classification
- Dynamic capacity allocation based on activity patterns
- Metadata storage for adaptive algorithm state

Key features:

- Priority-aware request handling
- Activity pattern detection (low/moderate/high)
- Background request pausing during high user activity
- Configurable scaling parameters

### Phase 3: Advanced Features (Medium Priority)

#### 8. Connection Management

- Client factory with connection pooling
- Support for existing DynamoDB client instances
- AWS credential chain integration
- Region-aware configuration

#### 9. Error Handling & Resilience ✅ IMPLEMENTED

- **Smithy StandardRetryStrategy**: Built-in exponential backoff with jitter via AWS SDK v3
- **Automatic retry handling**: Throttling detection and adaptive delays handled by AWS SDK
- **Configuration**: Configurable max retries (default: 3) via `DynamoDBStoreConfig`
- **Graceful degradation**: Proper error propagation when DynamoDB unavailable

#### 10. Performance Optimization

- Batch operations for bulk reads/writes
- Parallel processing where safe
- Connection pooling and reuse
- Configurable timeouts and limits

### Phase 4: Testing & Documentation (Medium Priority)

#### 11. Comprehensive Testing

- Unit tests with mocked DynamoDB client
- Integration tests with DynamoDB Local
- Error scenario testing
- Performance and load testing
- Compatibility tests with existing stores

Test structure:

```
src/
├── dynamodb-cache-store.test.ts
├── dynamodb-dedupe-store.test.ts
├── dynamodb-rate-limit-store.test.ts
├── dynamodb-adaptive-rate-limit-store.test.ts
└── __mocks__/
    └── dynamodb-client.ts
```

#### 12. Documentation & Examples

- README with setup instructions
- **DynamoDB table creation guide** with complete table structure
- Configuration examples
- Migration guide from other stores
- Performance tuning recommendations
- AWS deployment best practices

### Phase 5: Production Readiness (Low Priority)

#### 13. Monitoring & Observability

- CloudWatch metrics integration
- Structured logging with correlation IDs
- Performance monitoring hooks
- Health check endpoints

#### 14. Advanced Documentation

- DynamoDB auto-scaling setup guide
- Backup and restore best practices
- Multi-region deployment documentation
- Cost optimization recommendations

## Key Implementation Considerations

### 1. DynamoDB Limitations

- **Item size limit**: 400KB maximum item size
- **Batch operations**: 25 items max per batch request
- **Query limits**: 1MB response size limit
- **Eventual consistency**: Consider read consistency requirements

### 2. Cost Optimization

- **TTL usage**: Leverage native TTL for automatic cleanup
- **Batch operations**: Minimize request count with batching
- **Projection expressions**: Only fetch required attributes
- **Capacity planning**: Right-size read/write capacity

### 3. Security Considerations

- **IAM permissions**: Minimal required permissions
- **Data encryption**: Encryption at rest and in transit
- **Access patterns**: Secure key design
- **Audit logging**: Track access patterns

### 4. Table Management

- **Consumer responsibility**: Consumers must create and manage the DynamoDB table
- **Table structure documentation**: Complete schema and index specifications provided
- **Interface compatibility**: Drop-in replacement for existing stores
- **Data migration**: Tools for moving from SQLite/in-memory
- **Gradual rollout**: Feature flags for safe deployment
- **Rollback plan**: Ability to revert to previous store implementation

## Success Criteria

1. **Functional**: All store interfaces implemented with full feature parity
2. **Performance**: Sub-100ms p95 latency for typical operations
3. **Reliability**: 99.9% success rate under normal load
4. **Scalability**: Handle 10x current load without degradation
5. **Cost-effective**: Reasonable DynamoDB costs for typical usage patterns
6. **Maintainable**: Clear code structure following project conventions
7. **Testable**: 90%+ test coverage with comprehensive edge case handling

## Risk Mitigation

1. **AWS SDK complexity**: Start with simple operations, add complexity incrementally
2. **DynamoDB costs**: Implement cost monitoring and alerting early
3. **Performance issues**: Benchmark against existing stores throughout development
4. **Migration complexity**: Develop migration tools in parallel with core implementation
5. **Testing challenges**: Set up DynamoDB Local early for realistic testing
6. **UUID generation**: Use Node.js built-in `crypto.randomUUID()` instead of custom implementation for better security and performance
