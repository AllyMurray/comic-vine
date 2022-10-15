import { z, ZodError } from 'zod';
import { customError, OptionsValidationError } from '../errors';

const options = z.object({
  /**
   * The base url for the Comic Vine API.
   * This could be used to set a proxy when using the library in a browser.
   * It also ensures that if the comic vine url was to change it wouldn't be a breaking change to the library.
   * @default https://comicvine.gamespot.com/api/
   */
  baseUrl: z
    .string()
    .url()
    .optional()
    .default('https://comicvine.gamespot.com/api/'),
});

export type userOptions = z.input<typeof options>;
export type Options = z.output<typeof options>;

export const loadOptions = (userOptions?: userOptions) => {
  try {
    return options.parse(userOptions ?? {});
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const validationError = error.issues[0];
      throw new OptionsValidationError(
        validationError.path,
        validationError.message
      );
    }
    throw customError(error);
  }
};
