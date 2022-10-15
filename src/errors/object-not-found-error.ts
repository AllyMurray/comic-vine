import { BaseError } from './base-error';

export class ComicVineObjectNotFoundError extends BaseError {
  constructor() {
    super({
      message:
        'The requested resource could not be found in the Comic Vine API',
      help: 'Ensure you have used a valid resource Id',
    });
  }
}
