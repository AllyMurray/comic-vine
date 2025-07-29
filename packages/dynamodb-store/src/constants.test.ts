import { describe, it, expect } from 'vitest';
import {
  MAX_ITEM_SIZE_BYTES,
  DEFAULT_DEDUPE_TTL_SECONDS,
} from './constants.js';

describe('constants', () => {
  describe('MAX_ITEM_SIZE_BYTES', () => {
    it('should be 400KB in bytes', () => {
      expect(MAX_ITEM_SIZE_BYTES).toBe(400 * 1024);
    });
  });

  describe('DEFAULT_DEDUPE_TTL_SECONDS', () => {
    it('should be 5 minutes in seconds', () => {
      expect(DEFAULT_DEDUPE_TTL_SECONDS).toBe(5 * 60);
    });
  });
});
