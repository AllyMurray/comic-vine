import { z } from 'zod';

/**
 * Priority level for API requests
 */
export type RequestPriority = 'user' | 'background';

/**
 * Adaptive configuration schema with validation and defaults
 */
export const AdaptiveConfigSchema = z
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

/**
 * Configuration for adaptive rate limiting
 */
export type AdaptiveConfig = z.infer<typeof AdaptiveConfigSchema>;

/**
 * Interface for rate limiting API requests per resource
 */
export interface RateLimitStore {
  /**
   * Check if a request to a resource can proceed based on rate limits
   * @param resource The resource name (e.g., 'issues', 'characters')
   * @returns True if the request can proceed, false if rate limited
   */
  canProceed(resource: string): Promise<boolean>;

  /**
   * Record a request to a resource for rate limiting tracking
   * @param resource The resource name (e.g., 'issues', 'characters')
   */
  record(resource: string): Promise<void>;

  /**
   * Get the current rate limit status for a resource
   * @param resource The resource name
   * @returns Rate limit information including remaining requests and reset time
   */
  getStatus(resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }>;

  /**
   * Reset rate limits for a resource (useful for testing)
   * @param resource The resource name
   */
  reset(resource: string): Promise<void>;

  /**
   * Get the time in milliseconds until the next request can be made
   * @param resource The resource name
   * @returns Milliseconds to wait, or 0 if no waiting is needed
   */
  getWaitTime(resource: string): Promise<number>;
}

/**
 * Enhanced interface for adaptive rate limiting stores with priority support
 */
export interface AdaptiveRateLimitStore extends RateLimitStore {
  /**
   * Check if a request to a resource can proceed based on rate limits
   * @param resource The resource name (e.g., 'issues', 'characters')
   * @param priority The priority level of the request (defaults to 'background')
   * @returns True if the request can proceed, false if rate limited
   */
  canProceed(resource: string, priority?: RequestPriority): Promise<boolean>;

  /**
   * Record a request to a resource for rate limiting tracking
   * @param resource The resource name (e.g., 'issues', 'characters')
   * @param priority The priority level of the request (defaults to 'background')
   */
  record(resource: string, priority?: RequestPriority): Promise<void>;

  /**
   * Get the current rate limit status for a resource
   * @param resource The resource name
   * @param priority The priority level of the request (defaults to 'background')
   * @returns Rate limit information including remaining requests and reset time
   */
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

  /**
   * Get the time in milliseconds until the next request can be made
   * @param resource The resource name
   * @param priority The priority level of the request (defaults to 'background')
   * @returns Milliseconds to wait, or 0 if no waiting is needed
   */
  getWaitTime(resource: string, priority?: RequestPriority): Promise<number>;
}
