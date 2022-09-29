import { ComicVineError } from './comic-vine-error';

export class ComicVineUnauthorizedError extends ComicVineError {
  constructor() {
    super({
      message: 'Unauthorized response received when calling the Comic Vine API',
      help: 'Ensure you have a valid API key, you can get one from: https://comicvine.gamespot.com/api/',
    });
  }
}
