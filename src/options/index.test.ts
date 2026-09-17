describe('loadOptions', () => {
  afterEach(() => {
    vi.doUnmock('zod/mini');
    vi.resetModules();
  });

  it('should return the default values when no options are provided', async () => {
    const { loadOptions } = await import('./index.js');

    const options = loadOptions();

    expect(options).toStrictEqual({
      baseUrl: 'https://comicvine.gamespot.com/api/',
    });
  });

  it('should throw if validation fails', async () => {
    const { loadOptions } = await import('./index.js');

    expect(() => loadOptions({ baseUrl: '@not-a-valid-url' })).toThrow(
      'Property: baseUrl, Problem: Invalid URL',
    );
  });

  it('should preserve valid URLs and default an undefined URL', async () => {
    const { loadOptions } = await import('./index.js');
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
      const { loadOptions } = await import('./index.js');
      // JavaScript consumers can supply values outside the TypeScript contract.
      expect(() =>
        Reflect.apply(loadOptions, undefined, [{ baseUrl }]),
      ).toThrow(
        `Property: baseUrl, Problem: Invalid input: expected string, received ${received}`,
      );
    },
  );

  it('should throw if there is an unexpected error with an error message', async () => {
    // Mock zod to throw a non-ZodError
    vi.doMock('zod/mini', async () => {
      const originalModule =
        await vi.importActual<typeof import('zod/mini')>('zod/mini');
      return {
        __esModule: true,
        ...originalModule,
        z: {
          ...originalModule.z,
          object: vi.fn(() => ({
            parse: vi.fn(() => {
              throw new Error('not a Zod validation error');
            }),
          })),
        },
      };
    });

    const { loadOptions } = await import('./index.js');
    expect(() =>
      loadOptions({
        baseUrl: 'https://comicvine.gamespot.com/api/',
      }),
    ).toThrow('An unexpected error occurred: not a Zod validation error');
  });

  it('should throw if there is an unexpected error with no error message', async () => {
    // Mock zod to throw an error without a message
    vi.doMock('zod/mini', async () => {
      const originalModule =
        await vi.importActual<typeof import('zod/mini')>('zod/mini');
      return {
        __esModule: true,
        ...originalModule,
        z: {
          ...originalModule.z,
          object: vi.fn(() => ({
            parse: vi.fn(() => {
              throw new Error();
            }),
          })),
        },
      };
    });

    const { loadOptions } = await import('./index.js');
    expect(() =>
      loadOptions({
        baseUrl: 'https://comicvine.gamespot.com/api/',
      }),
    ).toThrow('An unexpected error occurred: Unknown Error');
  });
});
