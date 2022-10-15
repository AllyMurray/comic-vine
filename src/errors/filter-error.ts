import { BaseError } from './base-error';

export class ComicVineFilterError extends BaseError {
  constructor() {
    super({
      message: 'There was a problem trying to filter the API results',
      help: 'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}
