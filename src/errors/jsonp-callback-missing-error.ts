import { BaseError } from './base-error';

export class ComicJsonpCallbackMissingError extends BaseError {
  constructor() {
    super({
      message: 'JSONP format requires a callback',
      help: 'This library does not use JSONP, please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}
