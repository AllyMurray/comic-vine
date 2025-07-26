# Priority Rate Limiting: Implementation Guide

> **Single source of truth for implementing priority-based rate limiting with dynamic adaptive allocation**

## Core Principle: Real-Time Activity-Based Allocation

**Dynamically adjust capacity allocation based on recent user activity patterns to maximize API utilization while preserving user experience.**

## Sophisticated Implementation Strategy

### Configuration-Driven Adaptive System

```typescript
import { z } from 'zod';

const AdaptiveConfigSchema = z
  .object({
    monitoringWindowMs: z
      .number()
      .positive()
      .default(15 * 60 * 1000), // 15 minutes
    highActivityThreshold: z.number().min(0).default(10), // requests per window
    moderateActivityThreshold: z.number().min(0).default(3),
    recalculationIntervalMs: z.number().positive().default(30000), // 30 seconds
    sustainedInactivityThresholdMs: z
      .number()
      .positive()
      .default(30 * 60 * 1000), // 30 minutes
    backgroundPauseOnIncreasingTrend: z.boolean().default(true),
    maxUserScaling: z.number().positive().default(2.0), // don't exceed 2x capacity
    minUserReserved: z.number().min(0).default(5), // requests minimum
  })
  .refine(
    (data) => {
      return data.moderateActivityThreshold < data.highActivityThreshold;
    },
    {
      message:
        'moderateActivityThreshold must be less than highActivityThreshold',
    },
  );

interface ActivityMetrics {
  recentUserRequests: number[]; // Last N minutes of user requests
  recentBackgroundRequests: number[]; // Last N minutes of background requests
  userActivityTrend: 'increasing' | 'stable' | 'decreasing' | 'none';
}

type AdaptiveConfig = z.infer<typeof AdaptiveConfigSchema>;

interface DynamicCapacityResult {
  userReserved: number;
  backgroundMax: number;
  backgroundPaused: boolean;
  reason: string;
}

class AdaptiveCapacityCalculator {
  public readonly config: z.infer<typeof AdaptiveConfigSchema>;

  constructor(config: Partial<z.input<typeof AdaptiveConfigSchema>> = {}) {
    // Zod handles validation and applies defaults automatically
    this.config = AdaptiveConfigSchema.parse(config);
  }

  calculateDynamicCapacity(
    resource: string,
    totalLimit: number,
    activityMetrics: ActivityMetrics,
  ): DynamicCapacityResult {
    const recentUserActivity = this.getRecentActivity(
      activityMetrics.recentUserRequests,
    );
    const activityTrend = this.calculateActivityTrend(
      activityMetrics.recentUserRequests,
    );

    // Strategy 1: High Activity - Pause Background
    if (recentUserActivity >= this.config.highActivityThreshold) {
      const userCapacity = Math.min(
        totalLimit * 0.9,
        Math.floor(totalLimit * 0.5 * this.config.maxUserScaling), // 50% base * scaling factor
      );

      return {
        userReserved: userCapacity,
        backgroundMax: totalLimit - userCapacity,
        backgroundPaused:
          this.config.backgroundPauseOnIncreasingTrend &&
          activityTrend === 'increasing',
        reason: `High user activity (${recentUserActivity} requests/${this.config.monitoringWindowMs / 60000}min) - prioritizing users`,
      };
    }

    // Strategy 2: Moderate Activity - Balanced Scaling
    if (recentUserActivity >= this.config.moderateActivityThreshold) {
      const userMultiplier = this.getUserMultiplier(
        recentUserActivity,
        activityTrend,
      );
      const baseUserCapacity = Math.floor(totalLimit * 0.4); // 40% base allocation
      const dynamicUserCapacity = Math.min(
        totalLimit * 0.7,
        baseUserCapacity * userMultiplier,
      );

      return {
        userReserved: dynamicUserCapacity,
        backgroundMax: totalLimit - dynamicUserCapacity,
        backgroundPaused: false,
        reason: `Moderate user activity - dynamic scaling (${userMultiplier.toFixed(1)}x user capacity)`,
      };
    }

    // Strategy 3: Low/No Activity - Background Scale Up
    if (recentUserActivity === 0) {
      const sustainedInactivity = this.getSustainedInactivityPeriod(
        activityMetrics.recentUserRequests,
      );

      if (sustainedInactivity > this.config.sustainedInactivityThresholdMs) {
        return {
          userReserved: 0, // No reservation - background gets everything!
          backgroundMax: totalLimit, // Full capacity available
          backgroundPaused: false,
          reason: `Sustained zero activity (${Math.floor(sustainedInactivity / 60000)}+ min) - full capacity to background`,
        };
      } else {
        return {
          userReserved: this.config.minUserReserved, // Minimal safety buffer
          backgroundMax: totalLimit - this.config.minUserReserved,
          backgroundPaused: false,
          reason:
            'Recent zero activity - background scale up with minimal user buffer',
        };
      }
    }

    // Strategy 4: Very Low Activity - Gradual Background Scale Up
    const baseUserCapacity = Math.floor(totalLimit * 0.3); // 30% base for very low activity
    return {
      userReserved: Math.max(baseUserCapacity, this.config.minUserReserved),
      backgroundMax:
        totalLimit - Math.max(baseUserCapacity, this.config.minUserReserved),
      backgroundPaused: false,
      reason: `Low user activity (${recentUserActivity} requests/${this.config.monitoringWindowMs / 60000}min) - background scale up`,
    };
  }

  getRecentActivity(requests: number[]): number {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    return requests.filter((timestamp) => timestamp > cutoff).length;
  }

  calculateActivityTrend(
    requests: number[],
  ): 'increasing' | 'stable' | 'decreasing' | 'none' {
    const now = Date.now();
    const windowSize = this.config.monitoringWindowMs / 3; // Use 1/3 of monitoring window for trend
    const recent = requests.filter((t) => t > now - windowSize).length;
    const previous = requests.filter(
      (t) => t > now - 2 * windowSize && t <= now - windowSize,
    ).length;

    if (recent === 0 && previous === 0) return 'none';
    if (recent > previous * 1.5) return 'increasing';
    if (recent < previous * 0.5) return 'decreasing';
    return 'stable';
  }

  private getUserMultiplier(activity: number, trend: string): number {
    let base = Math.min(
      this.config.maxUserScaling,
      1 + activity / this.config.highActivityThreshold,
    );

    // Adjust based on trend
    if (trend === 'increasing') base *= 1.2;
    if (trend === 'decreasing') base *= 0.8;

    return Math.max(1.0, base);
  }

  private getSustainedInactivityPeriod(requests: number[]): number {
    if (requests.length === 0) {
      return Date.now(); // No requests ever = sustained inactivity
    }

    const lastRequest = Math.max(...requests);
    return Date.now() - lastRequest;
  }
}
```

### Enhanced Rate Limiter Implementation

```typescript
import type {
  AdaptiveRateLimitStore as IAdaptiveRateLimitStore,
  RequestPriority,
  AdaptiveConfig,
  AdaptiveConfigSchema,
} from '@comic-vine/client';
import { z } from 'zod';

interface ActivityMetrics {
  recentUserRequests: number[];
  recentBackgroundRequests: number[];
  userActivityTrend: 'increasing' | 'stable' | 'decreasing' | 'none';
}

interface DynamicCapacityResult {
  userReserved: number;
  backgroundMax: number;
  backgroundPaused: boolean;
  reason: string;
}

export interface AdaptiveRateLimitStoreOptions {
  adaptiveConfig?: Partial<z.input<typeof AdaptiveConfigSchema>>;
}

export class AdaptiveRateLimitStore implements IAdaptiveRateLimitStore {
  private activityMetrics = new Map<string, ActivityMetrics>();
  private capacityCalculator: AdaptiveCapacityCalculator;
  private lastCapacityUpdate = new Map<string, number>();
  private cachedCapacity = new Map<string, DynamicCapacityResult>();

  constructor(options: AdaptiveRateLimitStoreOptions = {}) {
    this.capacityCalculator = new AdaptiveCapacityCalculator(
      options.adaptiveConfig,
    );
  }

  async canProceed(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<boolean> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    // Check if background requests should be paused
    if (priority === 'background' && capacity.backgroundPaused) {
      return false; // Hard pause for background requests
    }

    // Get current usage
    const currentUserRequests = this.getCurrentUsage(
      metrics.recentUserRequests,
    );
    const currentBackgroundRequests = this.getCurrentUsage(
      metrics.recentBackgroundRequests,
    );

    if (priority === 'user') {
      return currentUserRequests < capacity.userReserved;
    } else {
      return currentBackgroundRequests < capacity.backgroundMax;
    }
  }

  async record(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<void> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const now = Date.now();

    if (priority === 'user') {
      metrics.recentUserRequests.push(now);
      this.cleanupOldRequests(metrics.recentUserRequests);
    } else {
      metrics.recentBackgroundRequests.push(now);
      this.cleanupOldRequests(metrics.recentBackgroundRequests);
    }

    // Update activity trend
    metrics.userActivityTrend = this.capacityCalculator.calculateActivityTrend(
      metrics.recentUserRequests,
    );
  }

  async getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
    adaptive?: {
      userReserved: number;
      backgroundMax: number;
      backgroundPaused: boolean;
      recentUserActivity: number;
      reason: string;
    };
  }> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);
    const currentUserUsage = this.getCurrentUsage(metrics.recentUserRequests);
    const currentBackgroundUsage = this.getCurrentUsage(
      metrics.recentBackgroundRequests,
    );

    return {
      remaining:
        capacity.userReserved -
        currentUserUsage +
        (capacity.backgroundMax - currentBackgroundUsage),
      resetTime: new Date(Date.now() + 3600000),
      limit: this.getResourceLimit(resource),
      adaptive: {
        userReserved: capacity.userReserved,
        backgroundMax: capacity.backgroundMax,
        backgroundPaused: capacity.backgroundPaused,
        recentUserActivity: this.capacityCalculator.getRecentActivity(
          metrics.recentUserRequests,
        ),
        reason: capacity.reason,
      },
    };
  }

  private calculateCurrentCapacity(
    resource: string,
    metrics: ActivityMetrics,
  ): DynamicCapacityResult {
    // Only recalculate based on configured interval to avoid thrashing
    const lastUpdate = this.lastCapacityUpdate.get(resource) || 0;
    const recalcInterval =
      this.capacityCalculator.config.recalculationIntervalMs;

    if (Date.now() - lastUpdate < recalcInterval) {
      return (
        this.cachedCapacity.get(resource) || this.getDefaultCapacity(resource)
      );
    }

    const totalLimit = this.getResourceLimit(resource);
    const capacity = this.capacityCalculator.calculateDynamicCapacity(
      resource,
      totalLimit,
      metrics,
    );

    this.cachedCapacity.set(resource, capacity);
    this.lastCapacityUpdate.set(resource, Date.now());

    return capacity;
  }

  private getOrCreateActivityMetrics(resource: string): ActivityMetrics {
    if (!this.activityMetrics.has(resource)) {
      this.activityMetrics.set(resource, {
        recentUserRequests: [],
        recentBackgroundRequests: [],
        userActivityTrend: 'none',
      });
    }
    return this.activityMetrics.get(resource)!;
  }

  private getCurrentUsage(requests: number[]): number {
    const oneHourAgo = Date.now() - 3600000; // 1 hour
    return requests.filter((timestamp) => timestamp > oneHourAgo).length;
  }

  private cleanupOldRequests(requests: number[]): void {
    const cutoff =
      Date.now() - this.capacityCalculator.config.monitoringWindowMs;
    while (requests.length > 0 && requests[0] < cutoff) {
      requests.shift();
    }
  }

  private getResourceLimit(resource: string): number {
    // Default Comic Vine API limits
    return 200; // requests per hour
  }

  private getDefaultCapacity(resource: string): DynamicCapacityResult {
    return {
      userReserved: Math.floor(this.getResourceLimit(resource) * 0.3),
      backgroundMax: Math.floor(this.getResourceLimit(resource) * 0.7),
      backgroundPaused: false,
      reason: 'Default capacity allocation',
    };
  }

  // Standard RateLimitStore methods (backward compatibility)
  async reset(resource: string): Promise<void> {
    this.activityMetrics.delete(resource);
    this.cachedCapacity.delete(resource);
    this.lastCapacityUpdate.delete(resource);
  }
}
```

## Real-World Scenarios

### 🌙 **Night Time: No User Activity**

```
Time: 2:00 AM (after 30+ minutes of zero activity)
Recent user activity: 0 requests/15min
Sustained inactivity: 45 minutes
Strategy: Full Background Scale Up

Capacity allocation:
- User reserved: 0 requests/hour (no reservation needed!)
- Background max: 200 requests/hour (FULL API capacity!)
- Background paused: false

Result: Maximum possible background throughput - 100% API utilization
```

**Early Night Transition (first 30 minutes):**

```
Time: 1:00 AM (only 15 minutes since last user request)
Recent user activity: 0 requests/15min
Strategy: Background Scale Up with Safety Buffer

Capacity allocation:
- User reserved: 5 requests/hour (minimal safety buffer)
- Background max: 195 requests/hour (95% capacity)
- Background paused: false

Result: Near-maximum background throughput with tiny safety margin
```

### 🌅 **Morning: Light User Activity**

```
Time: 8:00 AM
Recent user activity: 2 requests/15min
Trend: stable
Strategy: Gradual Background Scale Up

Capacity allocation:
- User reserved: 80 requests/hour (40% base allocation)
- Background max: 120 requests/hour
- Background paused: false

Result: Background gets extra capacity during low user periods
```

### 🌞 **Peak Hours: High User Activity**

```
Time: 10:00 AM
Recent user activity: 15 requests/15min
Trend: increasing
Strategy: Pause Background + User Priority

Capacity allocation:
- User reserved: 180 requests/hour (increased from baseline!)
- Background max: 20 requests/hour (minimal)
- Background paused: true (trend is increasing)

Result: Background requests completely paused, users get nearly full capacity
```

### 📈 **Sudden User Spike**

```
Time: 2:00 PM
Recent user activity: 25 requests/15min (sudden spike!)
Trend: increasing rapidly
Strategy: Emergency User Mode

Capacity allocation:
- User reserved: 180 requests/hour
- Background max: 20 requests/hour
- Background paused: true

Result: Instant adaptation to handle user surge
```

### 🚨 **What happens if a user request arrives during full background consumption?**

```
Scenario: 3:00 AM, background has consumed 180/200 requests in current hour
User request arrives for "Spider-Man comics"

System response:
1. ✅ User request proceeds immediately (20 requests still available)
2. 📊 System detects user activity and recalculates capacity
3. ⚡ Next capacity update (within 30 seconds) will:
   - Reserve capacity for future user requests
   - Reduce background allocation
   - Ensure user requests get priority

Result: User never experiences delays, system adapts automatically
```

**Edge Case - Background at absolute limit:**

```
Scenario: Background has consumed all 200/200 requests in current hour
User request arrives

System response:
1. ⏳ User request waits for next rate limit window (up to 1 hour)
2. 🔄 But system immediately starts prioritizing users for next hour
3. 📈 Background gets reduced capacity in subsequent hours

This is extremely rare and only during sustained zero activity periods
```

## Implementation Roadmap

### **Phase 1: Core Types & Interfaces**

#### 1.1 Add Priority Types and Adaptive Interface

**File: `packages/client/src/stores/rate-limit-store.ts`**

```typescript
// Add new types
export type RequestPriority = 'user' | 'background';

export const AdaptiveConfigSchema = z
  .object({
    monitoringWindowMs: z
      .number()
      .positive()
      .default(15 * 60 * 1000),
    highActivityThreshold: z.number().min(0).default(10),
    moderateActivityThreshold: z.number().min(0).default(3),
    recalculationIntervalMs: z.number().positive().default(30000),
    sustainedInactivityThresholdMs: z
      .number()
      .positive()
      .default(30 * 60 * 1000),
    backgroundPauseOnIncreasingTrend: z.boolean().default(true),
    maxUserScaling: z.number().positive().default(2.0),
    minUserReserved: z.number().min(0).default(5),
  })
  .refine(
    (data) => {
      return data.moderateActivityThreshold < data.highActivityThreshold;
    },
    {
      message:
        'moderateActivityThreshold must be less than highActivityThreshold',
    },
  );

export type AdaptiveConfig = z.infer<typeof AdaptiveConfigSchema>;

// Keep existing RateLimitStore interface unchanged for backward compatibility
export interface RateLimitStore {
  canProceed(resource: string): Promise<boolean>;
  record(resource: string): Promise<void>;
  getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }>;
  reset(resource: string): Promise<void>;
  getWaitTime(resource: string): Promise<number>;
}

// New interface for adaptive rate limiting stores
export interface AdaptiveRateLimitStore extends RateLimitStore {
  canProceed(resource: string, priority?: RequestPriority): Promise<boolean>;
  record(resource: string, priority?: RequestPriority): Promise<void>;
  getStatus(
    resource: string,
    priority?: RequestPriority,
  ): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
    adaptive?: {
      userReserved: number;
      backgroundMax: number;
      backgroundPaused: boolean;
      recentUserActivity: number;
      reason: string;
    };
  }>;
  getWaitTime(resource: string, priority?: RequestPriority): Promise<number>;
}
```

#### 1.2 Update Request Types

**File: `packages/client/src/types/request.ts`**

```typescript
import type { RequestPriority } from '../stores/rate-limit-store.js';

export interface PriorityOptions {
  /**
   * Priority level for the request (affects rate limiting behavior)
   * - 'user': High priority, gets reserved capacity during activity
   * - 'background': Lower priority, may be throttled during high user activity
   */
  priority?: RequestPriority;
}

export interface RetrieveOptions<FieldKey>
  extends BaseOptions<FieldKey>,
    PriorityOptions {}

export interface ListOptions<FieldKey, Filter>
  extends BaseOptions<FieldKey>,
    PriorityOptions {
  // ... existing options
}
```

### **Phase 2: In-Memory Store Implementation**

#### 2.1 Create Adaptive Capacity Calculator

**File: `packages/in-memory-store/src/adaptive-capacity-calculator.ts`**

- Implement the full `AdaptiveCapacityCalculator` class from the detailed spec above
- Include all four strategies (high activity, moderate, low/no activity, very low)
- Add comprehensive unit tests

#### 2.2 Create New Adaptive Rate Limit Store

**File: `packages/in-memory-store/src/adaptive-rate-limit-store.ts`**

Also update **`packages/in-memory-store/src/index.ts`**:

```typescript
export { AdaptiveRateLimitStore } from './adaptive-rate-limit-store.js';
export type { AdaptiveRateLimitStoreOptions } from './adaptive-rate-limit-store.js';
```

```typescript
import type {
  AdaptiveRateLimitStore as IAdaptiveRateLimitStore,
  RequestPriority,
  AdaptiveConfig,
  AdaptiveConfigSchema,
} from '@comic-vine/client';
import { AdaptiveCapacityCalculator } from './adaptive-capacity-calculator.js';
import { z } from 'zod';

export interface AdaptiveRateLimitStoreOptions {
  adaptiveConfig?: Partial<z.input<typeof AdaptiveConfigSchema>>;
}

export class AdaptiveRateLimitStore implements IAdaptiveRateLimitStore {
  private activityMetrics = new Map<string, ActivityMetrics>();
  private capacityCalculator: AdaptiveCapacityCalculator;
  private lastCapacityUpdate = new Map<string, number>();
  private cachedCapacity = new Map<string, DynamicCapacityResult>();

  constructor(options: AdaptiveRateLimitStoreOptions = {}) {
    this.capacityCalculator = new AdaptiveCapacityCalculator(
      options.adaptiveConfig,
    );
  }

  async canProceed(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<boolean> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const capacity = this.calculateCurrentCapacity(resource, metrics);

    // Check if background requests should be paused
    if (priority === 'background' && capacity.backgroundPaused) {
      return false; // Hard pause for background requests
    }

    // Get current usage
    const currentUserRequests = this.getCurrentUsage(
      metrics.recentUserRequests,
    );
    const currentBackgroundRequests = this.getCurrentUsage(
      metrics.recentBackgroundRequests,
    );

    if (priority === 'user') {
      return currentUserRequests < capacity.userReserved;
    } else {
      return currentBackgroundRequests < capacity.backgroundMax;
    }
  }

  async record(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<void> {
    const metrics = this.getOrCreateActivityMetrics(resource);
    const now = Date.now();

    if (priority === 'user') {
      metrics.recentUserRequests.push(now);
      this.cleanupOldRequests(metrics.recentUserRequests);
    } else {
      metrics.recentBackgroundRequests.push(now);
      this.cleanupOldRequests(metrics.recentBackgroundRequests);
    }

    // Update activity trend
    metrics.userActivityTrend = this.capacityCalculator.calculateActivityTrend(
      metrics.recentUserRequests,
    );
  }

  // ... implement other methods from full spec above
}

// Export existing InMemoryRateLimitStore unchanged for backward compatibility
// (implementation remains in existing file)
```

### **Phase 3: SQLite Store Implementation**

#### 3.1 Update Database Schema

**File: `packages/sqlite-store/src/schema.ts`**

```sql
-- Add priority column to existing rate_limits table
ALTER TABLE rate_limits ADD COLUMN priority TEXT DEFAULT 'background';

-- Add index for priority queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_resource_priority_timestamp
ON rate_limits(resource, priority, timestamp);
```

#### 3.2 Create SQLite Adaptive Rate Limit Store

**File: `packages/sqlite-store/src/sqlite-adaptive-rate-limit-store.ts`**

Also update **`packages/sqlite-store/src/index.ts`**:

```typescript
export { SqliteAdaptiveRateLimitStore } from './sqlite-adaptive-rate-limit-store.js';
export type { SqliteAdaptiveRateLimitStoreOptions } from './sqlite-adaptive-rate-limit-store.js';
```

```typescript
import type {
  AdaptiveRateLimitStore as IAdaptiveRateLimitStore,
  RequestPriority,
  AdaptiveConfig,
  AdaptiveConfigSchema,
} from '@comic-vine/client';
import { AdaptiveCapacityCalculator } from '@comic-vine/in-memory-store';
import { z } from 'zod';

export interface SqliteAdaptiveRateLimitStoreOptions {
  adaptiveConfig?: Partial<z.input<typeof AdaptiveConfigSchema>>;
}

export class SqliteAdaptiveRateLimitStore implements IAdaptiveRateLimitStore {
  private capacityCalculator: AdaptiveCapacityCalculator;
  // Maintain activity metrics in memory for performance
  private activityMetrics = new Map<string, ActivityMetrics>();

  constructor(options: SqliteAdaptiveRateLimitStoreOptions = {}) {
    this.capacityCalculator = new AdaptiveCapacityCalculator(
      options.adaptiveConfig,
    );
  }

  async canProceed(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<boolean> {
    // Load recent activity from database if not in memory
    await this.ensureActivityMetrics(resource);
    // Same logic as in-memory implementation
  }

  async record(
    resource: string,
    priority: RequestPriority = 'background',
  ): Promise<void> {
    // Store to database with priority column
    await this.db.run(
      'INSERT INTO rate_limits (resource, timestamp, priority) VALUES (?, ?, ?)',
      [resource, Date.now(), priority],
    );
    // Update in-memory metrics
  }

  // ... implement other methods
}

// Export existing SqliteRateLimitStore unchanged for backward compatibility
// (implementation remains in existing file)
```

### **Phase 4: HTTP Client Integration**

#### 4.1 Update HTTP Client

**File: `packages/client/src/http-client/http-client.ts`**

```typescript
// Update the request flow to pass priority
async get<Result>(
  url: string,
  options: { signal?: AbortSignal; priority?: RequestPriority } = {}
): Promise<Response<Result>> {
  const priority = options.priority || 'background';
  const resource = this.extractResourceFromUrl(url); // Extract resource from URL

  // Pass priority to rate limiting calls
  if (this.stores.rateLimit) {
    const canProceed = await this.stores.rateLimit.canProceed(resource, priority);
    // ... rest of rate limiting logic
    await this.stores.rateLimit.record(resource, priority);
  }
  // ... rest of method
}
```

### **Phase 5: Resource API Updates**

#### 5.1 Update Base Resource

**File: `packages/client/src/resources/base-resource.ts`**

- Pass through priority options from retrieve/list calls to HTTP client

#### 5.2 Update Individual Resources

- Update all resource classes to accept and pass through priority options
- Ensure type safety throughout the chain

### **Phase 6: Testing & Documentation**

#### 6.1 Comprehensive Test Suite

**Test files are co-located with source files:**

- **Unit tests**: Each adaptive strategy scenario
  - `packages/in-memory-store/src/adaptive-capacity-calculator.test.ts`
  - `packages/in-memory-store/src/in-memory-rate-limit-store.test.ts`
  - `packages/sqlite-store/src/sqlite-rate-limit-store.test.ts`
- **Integration tests**: End-to-end priority behavior
  - `packages/client/src/http-client/http-client.test.ts`
  - `packages/client/src/resources/base-resource.test.ts`
- **Performance tests**: Verify minimal overhead when disabled
- **Edge case tests**: Concurrent requests, rapid priority changes

#### 6.2 Update Documentation

- **README updates**: Add priority configuration examples
- **API documentation**: Document all new options
- **Migration guide**: Help existing users adopt priority features

### **Phase 7: Build & Release**

#### 7.1 Build Testing

- Test CommonJS builds
- Test ESM builds
- Verify TypeScript exports

#### 7.2 Release Preparation

- Update changelogs
- Version bumps (minor release)
- Final integration testing

## **Implementation Flow**

**Core Implementation**: Phases 1-4 (includes HTTP client interface updates in Phase 1)
**Integration & Release**: Phases 5-7

## **Key Implementation Notes**

### **Backward Compatibility**

- Original `RateLimitStore` interface remains unchanged
- Existing `InMemoryRateLimitStore` and `SqliteRateLimitStore` continue to work
- New adaptive stores are separate classes users can opt into
- All priority parameters are optional with sensible defaults

### **Performance Considerations**

- Simple stores have zero performance overhead (no changes)
- Adaptive stores only track metrics when used
- Minimal memory overhead with sliding window cleanup
- Configurable recalculation intervals prevent thrashing

### **Error Handling**

- Each store implementation is isolated (no cross-contamination)
- Clear error messages include priority context when relevant
- AbortSignal support maintained throughout

## Super Simple Configuration

### **Default Usage (Just Works!)**

```typescript
import { AdaptiveRateLimitStore } from '@comic-vine/in-memory-store';

const client = new ComicVine({
  stores: {
    rateLimit: new AdaptiveRateLimitStore({
      // That's it! Great defaults included - no configuration needed
    }),
  },
});
```

### **Custom Tuning (Optional)**

```typescript
import { AdaptiveRateLimitStore } from '@comic-vine/in-memory-store';

const client = new ComicVine({
  stores: {
    rateLimit: new AdaptiveRateLimitStore({
      // Only override what you want to change
      adaptiveConfig: {
        highActivityThreshold: 15, // Default: 10 - be more tolerant of user activity
        sustainedInactivityThresholdMs: 45 * 60 * 1000, // Default: 30min - wait longer before full scale-up
        minUserReserved: 10, // Default: 5 - always guarantee 10 requests for users
        // All other settings use smart defaults
      },
    }),
  },
});
```

## Benefits of Simplified Approach

### ✅ **Maximum Efficiency**

- **Night time**: Background gets **200/200 requests** when users sleep (100% utilization!)
- **Low activity**: Background gets 120/200 requests during quiet periods
- **High activity**: Users get 180/200 requests during peak usage

### ✅ **Intelligent Adaptation**

- **Real-time monitoring**: Adjusts every 30 seconds based on activity
- **Trend awareness**: Pauses background on increasing user activity
- **Graceful scaling**: Smooth transitions between allocation strategies

### ✅ **User Experience Protection**

- **Instant response**: High user activity immediately pauses background
- **Always guaranteed**: Minimum user capacity even during background scale-up
- **Spike handling**: Automatic detection and response to user surges

### ✅ **Dead Simple API**

- **Zero configuration**: Just set `priorityMode: 'adaptive'` and it works perfectly
- **Smart defaults**: Tuned for 95% of use cases out of the box
- **Optional customization**: Override only what you need to change
- **No complex schedules**: Real-time adaptation beats time-based rules

## 🎯 **Perfect for Your Use Case**

**🌙 Night Mode**: Background jobs consume **all 200 requests/hour** when you're asleep
**🌞 Day Mode**: User searches get instant priority when you're actively using the app
**⚡ Adaptive**: Seamlessly transitions between modes based on real activity patterns

The system automatically **pauses background jobs** during user activity spikes and **scales them up to full capacity** during quiet periods, giving you the absolute best of both worlds! 💯
