import { BaseError } from './base-error';

/**
 * @deprecated will be removed in the next major version, use ComicVineGenericRequestError instead!
 */
export class ComicVineGenericError extends BaseError {
  constructor(message?: string) {
    super({
      message: `Request to comic vine failed: ${message ?? 'Unknown Error'}`,
      help: 'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}

export class ComicVineGenericRequestError extends ComicVineGenericError {
  constructor(message?: string) {
    super(message);
  }
}
