import { ComicVineError } from './comic-vine-error';

export class ComicVineSubscriberOnlyError extends ComicVineError {
  constructor() {
    super({
      message: 'The requested video is for subscribers only',
      help: 'Subscriber videos are part of a paid service, if you wish to upgrade you can do so here: https://comicvine.gamespot.com/upgrade/',
    });
  }
}
