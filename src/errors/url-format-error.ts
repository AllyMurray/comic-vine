import { ComicVineError } from './comic-vine-error';

export class ComicVineUrlFormatError extends ComicVineError {
  constructor() {
    super({
      message: 'The url for the request was not in the correct format',
      help: 'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}
