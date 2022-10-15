import { ComicVineSubscriberOnlyError } from '.';
import { BaseError } from './base-error';

describe('ComicVineSubscriberOnlyError', () => {
  test('should be instanceof BaseError', () => {
    const comicVineSubscriberOnlyError = new ComicVineSubscriberOnlyError();
    expect(comicVineSubscriberOnlyError).toBeInstanceOf(BaseError);
  });
  test('should be instanceof ComicVineSubscriberOnlyError', () => {
    const comicVineSubscriberOnlyError = new ComicVineSubscriberOnlyError();
    expect(comicVineSubscriberOnlyError).toBeInstanceOf(
      ComicVineSubscriberOnlyError
    );
  });
  test('should have correct name', () => {
    const comicVineSubscriberOnlyError = new ComicVineSubscriberOnlyError();
    expect(comicVineSubscriberOnlyError.name).toBe(
      'ComicVineSubscriberOnlyError'
    );
  });
  test('should have correct message', () => {
    const comicVineSubscriberOnlyError = new ComicVineSubscriberOnlyError();
    expect(comicVineSubscriberOnlyError.message).toBe(
      'The requested video is for subscribers only'
    );
  });
  test('should have correct help', () => {
    const comicVineSubscriberOnlyError = new ComicVineSubscriberOnlyError();
    expect(comicVineSubscriberOnlyError.help).toBe(
      'Subscriber videos are part of a paid service, if you wish to upgrade you can do so here: https://comicvine.gamespot.com/upgrade/'
    );
  });
});
