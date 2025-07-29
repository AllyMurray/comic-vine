import { describe, it, expect } from 'vitest';
import {
  isThrottlingError,
  isConditionalCheckFailedError,
  isSevereError,
} from './error-detection.js';

describe('error detection utilities', () => {
  describe('isThrottlingError', () => {
    it('should detect throttling errors by name', () => {
      expect(isThrottlingError({ name: 'ThrottlingException' })).toBe(true);
      expect(
        isThrottlingError({ name: 'ProvisionedThroughputExceededException' }),
      ).toBe(true);
      expect(isThrottlingError({ name: 'ThrottlingError' })).toBe(true);
    });

    it('should detect throttling errors by code', () => {
      expect(isThrottlingError({ code: 'ThrottlingException' })).toBe(true);
      expect(
        isThrottlingError({ code: 'ProvisionedThroughputExceededException' }),
      ).toBe(true);
    });

    it('should return false for non-throttling errors', () => {
      expect(isThrottlingError({ name: 'ValidationException' })).toBe(false);
      expect(isThrottlingError({ code: 'ResourceNotFoundException' })).toBe(
        false,
      );
    });

    it('should handle invalid inputs', () => {
      expect(isThrottlingError(null)).toBe(false);
      expect(isThrottlingError(undefined)).toBe(false);
      expect(isThrottlingError('string')).toBe(false);
      expect(isThrottlingError({})).toBe(false);
    });
  });

  describe('isConditionalCheckFailedError', () => {
    it('should detect conditional check failed errors by name', () => {
      expect(
        isConditionalCheckFailedError({
          name: 'ConditionalCheckFailedException',
        }),
      ).toBe(true);
    });

    it('should detect conditional check failed errors by code', () => {
      expect(
        isConditionalCheckFailedError({
          code: 'ConditionalCheckFailedException',
        }),
      ).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(
        isConditionalCheckFailedError({ name: 'ValidationException' }),
      ).toBe(false);
      expect(
        isConditionalCheckFailedError({ code: 'ThrottlingException' }),
      ).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isConditionalCheckFailedError(null)).toBe(false);
      expect(isConditionalCheckFailedError(undefined)).toBe(false);
      expect(isConditionalCheckFailedError('string')).toBe(false);
    });
  });

  describe('isSevereError', () => {
    it('should detect service unavailable errors', () => {
      expect(isSevereError({ name: 'ServiceUnavailable' })).toBe(true);
      expect(isSevereError({ code: 'ServiceUnavailable' })).toBe(true);
      expect(isSevereError({ statusCode: 503 })).toBe(true);
    });

    it('should detect internal server errors', () => {
      expect(isSevereError({ name: 'InternalServerError' })).toBe(true);
      expect(isSevereError({ code: 'InternalServerError' })).toBe(true);
      expect(isSevereError({ statusCode: 500 })).toBe(true);
    });

    it('should detect connection timeout errors', () => {
      expect(isSevereError({ name: 'TimeoutError' })).toBe(true);
      expect(isSevereError({ name: 'ConnectTimeoutError' })).toBe(true);
      expect(isSevereError({ code: 'ECONNRESET' })).toBe(true);
      expect(isSevereError({ code: 'ENOTFOUND' })).toBe(true);
    });

    it('should detect throttling errors as severe', () => {
      expect(isSevereError({ name: 'ThrottlingException' })).toBe(true);
      expect(
        isSevereError({ code: 'ProvisionedThroughputExceededException' }),
      ).toBe(true);
    });

    it('should return false for non-severe errors', () => {
      expect(isSevereError({ name: 'ValidationException' })).toBe(false);
      expect(isSevereError({ statusCode: 400 })).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isSevereError(null)).toBe(false);
      expect(isSevereError(undefined)).toBe(false);
      expect(isSevereError('string')).toBe(false);
    });
  });
});
