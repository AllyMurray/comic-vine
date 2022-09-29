import { ComicVineError } from './comic-vine-error';

export class ComicVineObjectNotFoundError extends ComicVineError {
  constructor() {
    super({
      message:
        'The requested resource could not be found in the Comic Vine API',
      help: 'Ensure you have used a valid resource Id',
    });
  }
}
