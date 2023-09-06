const mockError = (message?: string) => {
  jest.mock('zod', () => {
    const originalModule = jest.requireActual('zod');
    return {
      __esModule: true,
      ...originalModule,
      z: {
        ...originalModule.z,
        object: jest.fn(() => ({
          parse: jest.fn(() => {
            throw new Error(message);
          }),
          optional: jest.fn(),
        })),
      },
    };
  });
};

describe('loadOptions', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('should return the default values when no options are provided', async () => {
    const optionsModule = await import('./index.js');

    const options = optionsModule.loadOptions();

    expect(options).toStrictEqual({
      baseUrl: 'https://comicvine.gamespot.com/api/',
    });
  });

  it('should through if validation fails', async () => {
    const optionsModule = await import('./index.js');

    expect(() =>
      optionsModule.loadOptions({ baseUrl: '@not-a-valid-url' }),
    ).toThrow('Property: baseUrl, Problem: Invalid url');
  });

  it('should through if there is an unexpected error with an error message', async () => {
    mockError('not a Zod validation error');
    const optionsModule = await import('./index.js');
    expect(() =>
      optionsModule.loadOptions({
        baseUrl: 'https://comicvine.gamespot.com/api/',
      }),
    ).toThrow('An unexpected error occurred: not a Zod validation error');
  });

  it('should through if there is an unexpected error with no error message', async () => {
    mockError();
    const optionsModule = await import('./index.js');
    expect(() =>
      optionsModule.loadOptions({
        baseUrl: 'https://comicvine.gamespot.com/api/',
      }),
    ).toThrow('An unexpected error occurred: Unknown Error');
  });
});
