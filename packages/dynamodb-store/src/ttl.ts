/**
 * Calculate TTL timestamp from seconds
 */
export function calculateTTL(ttlSeconds: number): number {
  if (ttlSeconds <= 0) {
    return Math.floor(Date.now() / 1000); // Immediate expiration
  }
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Check if an item has expired based on TTL
 */
export function isExpired(ttl: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= ttl;
}
