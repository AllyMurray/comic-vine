import { BaseError } from './base-error.js';
import { ComicVineUnauthorizedError } from './unauthorized-error.js';

describe('ComicVineUnauthorizedError', () => {
  test('should be instanceof BaseError', () => {
    const comicVineUnauthorizedError = new ComicVineUnauthorizedError();
    expect(comicVineUnauthorizedError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof ComicVineUnauthorizedError', () => {
    const comicVineUnauthorizedError = new ComicVineUnauthorizedError();
    expect(comicVineUnauthorizedError).toBeInstanceOf(
      ComicVineUnauthorizedError,
    );
  });
  test('should have correct name', () => {
    const comicVineUnauthorizedError = new ComicVineUnauthorizedError();
    expect(comicVineUnauthorizedError.name).toBe('ComicVineUnauthorizedError');
  });
  test('should have correct message', () => {
    const comicVineUnauthorizedError = new ComicVineUnauthorizedError();
    expect(comicVineUnauthorizedError.message).toBe(
      'Unauthorized response received when calling the Comic Vine API',
    );
  });
  test('should have correct help', () => {
    const comicVineUnauthorizedError = new ComicVineUnauthorizedError();
    expect(comicVineUnauthorizedError.help).toBe(
      'Ensure you have a valid API key, you can get one from: https://comicvine.gamespot.com/api/',
    );
  });
});
