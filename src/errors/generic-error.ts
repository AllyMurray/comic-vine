import { BaseError } from './base-error.js';

export class GenericError extends BaseError {
  constructor(message?: string) {
    super({
      message: `An unexpected error occurred: ${message || 'Unknown Error'}`,
      help: 'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}
