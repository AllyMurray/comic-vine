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
