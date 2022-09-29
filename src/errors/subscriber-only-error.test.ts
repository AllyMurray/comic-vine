import { ComicVineSubscriberOnlyError } from '.';
import { ComicVineError } from './comic-vine-error';

describe('ComicVineSubscriberOnlyError', () => {
  test('should be instanceof ComicVineError', () => {
    const comicVineSubscriberOnlyError = new ComicVineSubscriberOnlyError();
    expect(comicVineSubscriberOnlyError).toBeInstanceOf(ComicVineError);
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
