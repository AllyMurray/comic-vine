import { describe, it, expect } from 'vitest';
import { chunkArray, calculateOptimalBatchSize } from './batch-operations.js';

describe('batch operations utilities', () => {
  describe('chunkArray', () => {
    it('should chunk array into specified sizes', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = chunkArray(array, 3);

      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
    });

    it('should handle empty arrays', () => {
      const chunks = chunkArray([], 5);
      expect(chunks).toEqual([]);
    });

    it('should handle arrays smaller than chunk size', () => {
      const array = [1, 2];
      const chunks = chunkArray(array, 5);
      expect(chunks).toEqual([[1, 2]]);
    });

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3];
      const chunks = chunkArray(array, 1);
      expect(chunks).toEqual([[1], [2], [3]]);
    });

    it('should handle arrays that divide evenly', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const chunks = chunkArray(array, 3);
      expect(chunks).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });
  });

  describe('calculateOptimalBatchSize', () => {
    it('should return max batch size for small items', () => {
      const averageSize = 1000; // 1KB
      const result = calculateOptimalBatchSize(averageSize);
      expect(result).toBe(25); // DynamoDB max batch size
    });

    it('should calculate based on 16MB limit for large items', () => {
      const averageSize = 1024 * 1024; // 1MB per item
      const result = calculateOptimalBatchSize(averageSize);
      expect(result).toBe(16); // 16MB / 1MB = 16 items
    });

    it('should respect custom max batch size', () => {
      const averageSize = 1000;
      const customMax = 10;
      const result = calculateOptimalBatchSize(averageSize, customMax);
      expect(result).toBe(customMax);
    });

    it('should handle very large items', () => {
      const averageSize = 8 * 1024 * 1024; // 8MB per item
      const result = calculateOptimalBatchSize(averageSize);
      expect(result).toBe(2); // 16MB / 8MB = 2 items
    });

    it('should handle extremely large items', () => {
      const averageSize = 20 * 1024 * 1024; // 20MB per item (larger than limit)
      const result = calculateOptimalBatchSize(averageSize);
      expect(result).toBe(0); // Can't fit any items
    });
  });
});
