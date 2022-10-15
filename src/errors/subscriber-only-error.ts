import { BaseError } from './base-error';

export class ComicVineSubscriberOnlyError extends BaseError {
  constructor() {
    super({
      message: 'The requested video is for subscribers only',
      help: 'Subscriber videos are part of a paid service, if you wish to upgrade you can do so here: https://comicvine.gamespot.com/upgrade/',
    });
  }
}
