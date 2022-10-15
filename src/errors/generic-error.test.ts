import { GenericError } from '.';
import { BaseError } from './base-error';

describe('GenericError', () => {
  const errorMessage = 'Test error message';
  test('should be instanceof ComicVineError', () => {
    const genericError = new GenericError();
    expect(genericError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof GenericError', () => {
    const genericError = new GenericError();
    expect(genericError).toBeInstanceOf(GenericError);
  });
  test('should have correct name', () => {
    const genericError = new GenericError();
    expect(genericError.name).toBe('GenericError');
  });
  test('should have correct message when no errorMessage is provided', () => {
    const genericError = new GenericError();
    expect(genericError.message).toBe(
      'An unexpected error occurred: Unknown Error'
    );
  });
  test('should have correct message when an errorMessage is provided', () => {
    const genericError = new GenericError(errorMessage);
    expect(genericError.message).toBe(
      'An unexpected error occurred: Test error message'
    );
  });
  test('should have correct help', () => {
    const genericError = new GenericError();
    expect(genericError.help).toBe(
      'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
