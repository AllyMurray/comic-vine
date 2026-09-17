import { en } from 'zod/locales';
import { z } from 'zod/mini';
import { customError, OptionsValidationError } from '../errors/index.js';

const options = z.object({
  /**
   * The base url for the Comic Vine API.
   * This could be used to set a proxy when using the library in a browser.
   * It also ensures that if the comic vine url was to change it wouldn't be a breaking change to the library.
   * @default https://comicvine.gamespot.com/api/
   */
  baseUrl: z._default(
    z.optional(z.url()),
    'https://comicvine.gamespot.com/api/',
  ),
});

// Preserve English validation messages without changing consumers' global Zod config.
const validationErrorMap = en().localeError;

export type userOptions = z.input<typeof options>;
export type Options = z.output<typeof options>;

export const loadOptions = (userOptions?: userOptions) => {
  try {
    return options.parse(userOptions ?? {}, { error: validationErrorMap });
  } catch (error: unknown) {
    if (error instanceof z.core.$ZodError) {
      const validationError = error.issues[0];
      if (validationError) {
        throw new OptionsValidationError(
          validationError.path.filter(
            (segment): segment is string | number =>
              typeof segment === 'string' || typeof segment === 'number',
          ),
          validationError.message,
        );
      }
      throw new OptionsValidationError([], 'Unknown validation error');
    }
    throw customError(error);
  }
};
