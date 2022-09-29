import { ComicVineGenericError } from '.';
import { ComicVineError } from './comic-vine-error';

describe('ComicVineGenericError', () => {
  const errorMessage = 'Test error message';
  test('should be instanceof ComicVineError', () => {
    const comicVineGenericError = new ComicVineGenericError();
    expect(comicVineGenericError).toBeInstanceOf(ComicVineError);
  });
  test('should be instanceof ComicVineGenericError', () => {
    const comicVineGenericError = new ComicVineGenericError();
    expect(comicVineGenericError).toBeInstanceOf(ComicVineGenericError);
  });
  test('should have correct name', () => {
    const comicVineGenericError = new ComicVineGenericError();
    expect(comicVineGenericError.name).toBe('ComicVineGenericError');
  });
  test('should have correct message when no errorMessage is provided', () => {
    const comicVineGenericError = new ComicVineGenericError();
    expect(comicVineGenericError.message).toBe(
      'Request to comic vine failed: Unknown Error'
    );
  });
  test('should have correct message when an errorMessage is provided', () => {
    const comicVineGenericError = new ComicVineGenericError(errorMessage);
    expect(comicVineGenericError.message).toBe(
      'Request to comic vine failed: Test error message'
    );
  });
  test('should have correct help', () => {
    const comicVineGenericError = new ComicVineGenericError();
    expect(comicVineGenericError.help).toBe(
      'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
