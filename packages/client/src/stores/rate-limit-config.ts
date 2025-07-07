/**
 * Configuration for per-resource rate limiting.
 *
 * This interface is shared by all store implementations (e.g. in-memory,
 * SQLite) so that callers can use a single canonical type.
 */
export interface RateLimitConfig {
  /** Number of requests allowed per time window */
  limit: number;
  /** Duration of the window in milliseconds */
  windowMs: number;
}
