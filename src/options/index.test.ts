import { describe, it, expect } from 'bun:test';
import { loadOptions } from './index.js';

describe('loadOptions', () => {
  it('should return the default values when no options are provided', async () => {
    const options = loadOptions();

    expect(options).toStrictEqual({
      baseUrl: 'https://comicvine.gamespot.com/api/',
    });
  });

  it('should throw if validation fails', async () => {
    expect(() => loadOptions({ baseUrl: '@not-a-valid-url' })).toThrow(
      'Property: baseUrl, Problem: Invalid URL',
    );
  });

  it('should preserve valid URLs and default an undefined URL', async () => {
    const baseUrl = 'https://proxy.example.com/comic-vine/';
    expect(loadOptions({ baseUrl })).toEqual({ baseUrl });
    expect(loadOptions({ baseUrl: undefined })).toEqual(loadOptions());
  });

  it.each([
    [null, 'null'],
    [42, 'number'],
  ])(
    'should preserve validation messages for baseUrl %s',
    async (baseUrl, received) => {
      // JavaScript consumers can supply values outside the TypeScript contract.
      expect(() =>
        Reflect.apply(loadOptions, undefined, [{ baseUrl }]),
      ).toThrow(
        `Property: baseUrl, Problem: Invalid input: expected string, received ${received}`,
      );
    },
  );

  it('should throw if there is an unexpected error with an error message', async () => {
    const input = {
      get baseUrl(): string {
        throw new Error('not a Zod validation error');
      },
    };
    expect(() => loadOptions(input)).toThrow(
      'An unexpected error occurred: not a Zod validation error',
    );
  });

  it('should throw if there is an unexpected error with no error message', async () => {
    const input = {
      get baseUrl(): string {
        throw new Error();
      },
    };
    expect(() => loadOptions(input)).toThrow(
      'An unexpected error occurred: Unknown Error',
    );
  });
});
