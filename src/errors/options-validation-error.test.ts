import { OptionsValidationError } from '.';
import { BaseError } from './base-error';

describe('OptionsValidationError', () => {
  const path = ['baseUrl'];
  const errorMessage = 'Test error message';
  test('should be instanceof BaseError', () => {
    const optionsValidationError = new OptionsValidationError(
      path,
      errorMessage
    );
    expect(optionsValidationError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof OptionsValidationError', () => {
    const optionsValidationError = new OptionsValidationError(
      path,
      errorMessage
    );
    expect(optionsValidationError).toBeInstanceOf(OptionsValidationError);
  });
  test('should have correct name', () => {
    const optionsValidationError = new OptionsValidationError(
      path,
      errorMessage
    );
    expect(optionsValidationError.name).toBe('OptionsValidationError');
  });
  test('should have correct message when an errorMessage is provided', () => {
    const optionsValidationError = new OptionsValidationError(
      path,
      errorMessage
    );
    expect(optionsValidationError.message).toBe(
      'Property: baseUrl, Problem: Test error message'
    );
  });
  test('should have correct help', () => {
    const optionsValidationError = new OptionsValidationError(
      path,
      errorMessage
    );
    expect(optionsValidationError.help).toBe(
      'If the error message does not provide enough information or you believe there is a bug, please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues'
    );
  });
});
