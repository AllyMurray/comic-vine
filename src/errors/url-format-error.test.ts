import { ComicVineUrlFormatError } from '.';
import { BaseError } from './base-error';

describe('ComicVineUrlFormatError', () => {
  test('should be instanceof BaseError', () => {
    const comicVineUrlFormatError = new ComicVineUrlFormatError();
    expect(comicVineUrlFormatError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof ComicVineUrlFormatError', () => {
    const comicVineUrlFormatError = new ComicVineUrlFormatError();
    expect(comicVineUrlFormatError).toBeInstanceOf(ComicVineUrlFormatError);
  });
  test('should have correct name', () => {
    const comicVineUrlFormatError = new ComicVineUrlFormatError();
    expect(comicVineUrlFormatError.name).toBe('ComicVineUrlFormatError');
  });
  test('should have correct message', () => {
    const comicVineUrlFormatError = new ComicVineUrlFormatError();
    expect(comicVineUrlFormatError.message).toBe(
      'The url for the request was not in the correct format'
    );
  });
  test('should have correct help', () => {
    const comicVineUrlFormatError = new ComicVineUrlFormatError();
    expect(comicVineUrlFormatError.help).toBe(
      'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
