import { ComicVineFilterError } from '.';
import { ComicVineError } from './comic-vine-error';

describe('ComicVineFilterError', () => {
  const errorMessage = 'Test error message';
  test('should be instanceof ComicVineError', () => {
    const comicVineFilterError = new ComicVineFilterError();
    expect(comicVineFilterError).toBeInstanceOf(ComicVineError);
  });
  test('should be instanceof ComicVineFilterError', () => {
    const comicVineFilterError = new ComicVineFilterError();
    expect(comicVineFilterError).toBeInstanceOf(ComicVineFilterError);
  });
  test('should have correct name', () => {
    const comicVineFilterError = new ComicVineFilterError();
    expect(comicVineFilterError.name).toBe('ComicVineFilterError');
  });
  test('should have correct message', () => {
    const comicVineFilterError = new ComicVineFilterError();
    expect(comicVineFilterError.message).toBe(
      'There was a problem trying to filter the API results'
    );
  });
  test('should have correct help', () => {
    const comicVineFilterError = new ComicVineFilterError();
    expect(comicVineFilterError.help).toBe(
      'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
