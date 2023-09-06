import { BaseError } from './base-error.js';
import { ComicVineObjectNotFoundError } from './object-not-found-error.js';

describe('ComicVineObjectNotFoundError', () => {
  test('should be instanceof BaseError', () => {
    const comicVineObjectNotFoundError = new ComicVineObjectNotFoundError();
    expect(comicVineObjectNotFoundError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof ComicVineObjectNotFoundError', () => {
    const comicVineObjectNotFoundError = new ComicVineObjectNotFoundError();
    expect(comicVineObjectNotFoundError).toBeInstanceOf(
      ComicVineObjectNotFoundError,
    );
  });
  test('should have correct name', () => {
    const comicVineObjectNotFoundError = new ComicVineObjectNotFoundError();
    expect(comicVineObjectNotFoundError.name).toBe(
      'ComicVineObjectNotFoundError',
    );
  });
  test('should have correct message', () => {
    const comicVineObjectNotFoundError = new ComicVineObjectNotFoundError();
    expect(comicVineObjectNotFoundError.message).toBe(
      'The requested resource could not be found in the Comic Vine API',
    );
  });
  test('should have correct help', () => {
    const comicVineObjectNotFoundError = new ComicVineObjectNotFoundError();
    expect(comicVineObjectNotFoundError.help).toBe(
      'Ensure you have used a valid resource Id',
    );
  });
});
