import { ComicJsonpCallbackMissingError } from '.';
import { BaseError } from './base-error';

describe('ComicJsonpCallbackMissingError', () => {
  test('should be instanceof BaseError', () => {
    const comicJsonpCallbackMissingError = new ComicJsonpCallbackMissingError();
    expect(comicJsonpCallbackMissingError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof ComicJsonpCallbackMissingError', () => {
    const comicJsonpCallbackMissingError = new ComicJsonpCallbackMissingError();
    expect(comicJsonpCallbackMissingError).toBeInstanceOf(
      ComicJsonpCallbackMissingError
    );
  });
  test('should have correct name', () => {
    const comicJsonpCallbackMissingError = new ComicJsonpCallbackMissingError();
    expect(comicJsonpCallbackMissingError.name).toBe(
      'ComicJsonpCallbackMissingError'
    );
  });
  test('should have correct message', () => {
    const comicJsonpCallbackMissingError = new ComicJsonpCallbackMissingError();
    expect(comicJsonpCallbackMissingError.message).toBe(
      'JSONP format requires a callback'
    );
  });
  test('should have correct help', () => {
    const comicJsonpCallbackMissingError = new ComicJsonpCallbackMissingError();
    expect(comicJsonpCallbackMissingError.help).toBe(
      'This library does not use JSONP, please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
