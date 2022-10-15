import { GenericError } from './generic-error';

export const customError = (error: unknown) => {
  if (error instanceof Error) {
    return new GenericError(error.message);
  }
  return new GenericError();
};
