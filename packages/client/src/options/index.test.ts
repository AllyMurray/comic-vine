describe('loadOptions', () => {
  afterEach(() => {
    vi.doUnmock('zod');
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
      'Property: baseUrl, Problem: Invalid url',
    );
  });

  it('should throw if there is an unexpected error with an error message', async () => {
    // Mock zod to throw a non-ZodError
    vi.doMock('zod', async () => {
      const originalModule = await vi.importActual<typeof import('zod')>('zod');
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
    vi.doMock('zod', async () => {
      const originalModule = await vi.importActual<typeof import('zod')>('zod');
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
