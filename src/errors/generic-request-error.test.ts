import { ComicVineGenericRequestError } from '.';
import { BaseError } from './base-error';

describe('ComicVineGenericRequestError', () => {
  const errorMessage = 'Test error message';
  test('should be instanceof BaseError', () => {
    const comicVineGenericRequestError = new ComicVineGenericRequestError();
    expect(comicVineGenericRequestError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof ComicVineGenericRequestError', () => {
    const comicVineGenericRequestError = new ComicVineGenericRequestError();
    expect(comicVineGenericRequestError).toBeInstanceOf(
      ComicVineGenericRequestError
    );
  });
  test('should have correct name', () => {
    const comicVineGenericRequestError = new ComicVineGenericRequestError();
    expect(comicVineGenericRequestError.name).toBe(
      'ComicVineGenericRequestError'
    );
  });
  test('should have correct message when no errorMessage is provided', () => {
    const comicVineGenericRequestError = new ComicVineGenericRequestError();
    expect(comicVineGenericRequestError.message).toBe(
      'Request to comic vine failed: Unknown Error'
    );
  });
  test('should have correct message when an errorMessage is provided', () => {
    const comicVineGenericRequestError = new ComicVineGenericRequestError(
      errorMessage
    );
    expect(comicVineGenericRequestError.message).toBe(
      'Request to comic vine failed: Test error message'
    );
  });
  test('should have correct help', () => {
    const comicVineGenericRequestError = new ComicVineGenericRequestError();
    expect(comicVineGenericRequestError.help).toBe(
      'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
