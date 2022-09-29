import { ComicVineError } from './comic-vine-error';

export class ComicVineGenericError extends ComicVineError {
  constructor(message?: string) {
    super({
      message: `Request to comic vine failed: ${message ?? 'Unknown Error'}`,
      help: 'Please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}
