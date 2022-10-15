import { customError } from './custom-error';

describe('Catch Error', () => {
  it(`should use the error message if the input is an instance of Error`, () => {
    const error = customError(new Error('Test message'));
    expect(error.message).toBe('An unexpected error occurred: Test message');
  });
  it(`should use the default error message if the input is an instance of Error with no message`, () => {
    const error = customError(new Error());
    expect(error.message).toBe('An unexpected error occurred: Unknown Error');
  });
  it(`should use the default error message if the input is not an instance of Error`, () => {
    const invalidErrorObject = {};
    const error = customError(invalidErrorObject);
    expect(error.message).toBe('An unexpected error occurred: Unknown Error');
  });
});
