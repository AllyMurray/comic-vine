import { describe, it, expect } from 'vitest';
import { serializeValue, deserializeValue } from './serialization.js';
import { DynamoDBStoreError, ItemSizeError } from './types.js';

describe('serialization utilities', () => {
  describe('serializeValue', () => {
    it('should serialize simple values', () => {
      expect(serializeValue('test')).toBe('"test"');
      expect(serializeValue(123)).toBe('123');
      expect(serializeValue(true)).toBe('true');
      expect(serializeValue(null)).toBe('null');
    });

    it('should serialize objects', () => {
      const obj = { key: 'value', num: 42 };
      const result = serializeValue(obj);
      expect(result).toBe('{"key":"value","num":42}');
    });

    it('should handle undefined values', () => {
      expect(serializeValue(undefined)).toBe('__UNDEFINED__');
    });

    it('should throw DynamoDBStoreError for circular references', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj; // Create circular reference

      expect(() => serializeValue(obj)).toThrow(DynamoDBStoreError);
    });

    it('should throw ItemSizeError for large items', () => {
      const largeString = 'x'.repeat(500 * 1024); // 500KB string

      expect(() => serializeValue(largeString)).toThrow(ItemSizeError);
    });
  });

  describe('deserializeValue', () => {
    it('should deserialize simple values', () => {
      expect(deserializeValue('"test"')).toBe('test');
      expect(deserializeValue('123')).toBe(123);
      expect(deserializeValue('true')).toBe(true);
      expect(deserializeValue('null')).toBe(null);
    });

    it('should deserialize objects', () => {
      const serialized = '{"key":"value","num":42}';
      const result = deserializeValue(serialized);
      expect(result).toEqual({ key: 'value', num: 42 });
    });

    it('should handle undefined placeholder', () => {
      expect(deserializeValue('__UNDEFINED__')).toBeUndefined();
    });

    it('should throw DynamoDBStoreError for invalid JSON', () => {
      expect(() => deserializeValue('{invalid json')).toThrow(
        DynamoDBStoreError,
      );
    });

    it('should preserve type information', () => {
      const original = { str: 'test', num: 42, bool: true, arr: [1, 2, 3] };
      const serialized = serializeValue(original);
      const deserialized = deserializeValue(serialized);

      expect(deserialized).toEqual(original);
    });
  });
});
