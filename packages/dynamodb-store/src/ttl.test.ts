import { describe, it, expect, vi } from 'vitest';
import { calculateTTL, isExpired } from './ttl.js';

describe('ttl utilities', () => {
  describe('calculateTTL', () => {
    it('should calculate future TTL timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      const ttl = calculateTTL(60); // 1 minute

      expect(ttl).toBeGreaterThan(now);
      expect(ttl).toBeLessThanOrEqual(now + 60);
    });

    it('should return immediate expiration for non-positive TTL', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000000);

      expect(calculateTTL(0)).toBe(1000);
      expect(calculateTTL(-10)).toBe(1000);

      vi.restoreAllMocks();
    });

    it('should handle large TTL values', () => {
      const largeTtl = 86400; // 1 day
      const now = Math.floor(Date.now() / 1000);
      const result = calculateTTL(largeTtl);

      expect(result).toBe(now + largeTtl);
    });
  });

  describe('isExpired', () => {
    it('should return true for expired TTL', () => {
      const pastTtl = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      expect(isExpired(pastTtl)).toBe(true);
    });

    it('should return false for future TTL', () => {
      const futureTtl = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
      expect(isExpired(futureTtl)).toBe(false);
    });

    it('should return true for current time TTL', () => {
      const currentTtl = Math.floor(Date.now() / 1000);
      expect(isExpired(currentTtl)).toBe(true);
    });
  });
});
