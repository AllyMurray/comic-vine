import { BaseError } from './base-error.js';

class TestComicVineError extends BaseError {}
function throwTestComicVineError() {
  throw new TestComicVineError({
    message: 'Test message',
    help: 'Help message',
  });
}

describe('BaseError', () => {
  test('should have correct error message', () => {
    expect.assertions(1);
    try {
      throwTestComicVineError();
    } catch (error) {
      expect((error as TestComicVineError).message).toBe('Test message');
    }
  });

  test('should have correct help message', () => {
    expect.assertions(1);
    try {
      throwTestComicVineError();
    } catch (error) {
      expect((error as TestComicVineError).help).toBe('Help message');
    }
  });

  describe('stack trace', () => {
    test('should be defined', () => {
      expect.assertions(1);
      try {
        throwTestComicVineError();
      } catch (error) {
        expect((error as TestComicVineError).stack).toBeDefined();
      }
    });

    test('should start with the default error message formatting', () => {
      expect.assertions(1);
      try {
        throwTestComicVineError();
      } catch (error) {
        expect((error as TestComicVineError).stack?.split('\n')[0]).toBe(
          'TestComicVineError: Test message',
        );
      }
    });

    test('should contain the function where the error was thrown in the first stack frame', () => {
      expect.assertions(1);
      try {
        throwTestComicVineError();
      } catch (error) {
        expect(
          (error as TestComicVineError).stack
            ?.split('\n')[1]
            .indexOf('throwTestComicVineError'),
        ).toBe(7);
      }
    });

    test('should successfully create an error object when captureStackTrace is undefined', () => {
      const cacheCaptureStackTrace = Error.captureStackTrace;
      (Error.captureStackTrace as typeof Error.captureStackTrace | undefined) =
        undefined;
      const error = new TestComicVineError({
        message: 'Test message',
        help: 'Help message',
      });
      expect(error).toBeDefined();
      Error.captureStackTrace = cacheCaptureStackTrace;
    });
  });
});
