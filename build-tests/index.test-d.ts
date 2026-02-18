/**
 * Type contract tests for the public API surface.
 * Uses tsd to assert that exported types match expected shapes.
 * A failing test here means a consumer-visible type change occurred.
 */
import { expectType, expectAssignable, expectError } from 'tsd';
import { HttpClientError } from '@http-client-toolkit/core';
import ComicVine, {
  ComicVine as ComicVineNamed,
  type ComicVineOptions,
  type Response,
  StatusCode,
  // Error classes
  GenericError,
  ComicVineFilterError,
  ComicVineGenericError,
  ComicVineGenericRequestError,
  ComicJsonpCallbackMissingError,
  ComicVineObjectNotFoundError,
  ComicVineSubscriberOnlyError,
  ComicVineUnauthorizedError,
  ComicVineUrlFormatError,
  OptionsValidationError,
  customError,
} from 'comic-vine-sdk';

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

// Minimal valid options: apiKey is required
const client = new ComicVine({ apiKey: 'test' });
expectType<ComicVine>(client);

// Named export and default export are the same class
expectType<ComicVineNamed>(client);

// Full options shape
new ComicVine({
  apiKey: 'test',
  baseUrl: 'https://example.com',
  stores: {},
  client: {
    defaultCacheTTL: 60,
    throwOnRateLimit: true,
    maxWaitTime: 5000,
  },
});

// Missing apiKey is a type error
expectError(new ComicVine({}));
expectError(new ComicVine());

// ---------------------------------------------------------------------------
// Resource properties (all 19)
// ---------------------------------------------------------------------------

const resources = [
  client.character,
  client.concept,
  client.episode,
  client.issue,
  client.location,
  client.movie,
  client.origin,
  client.person,
  client.power,
  client.promo,
  client.publisher,
  client.series,
  client.storyArc,
  client.team,
  client.thing,
  client.video,
  client.videoCategory,
  client.videoType,
  client.volume,
] as const;

// Each resource has list() and retrieve() methods (spot-check a few)
expectType<typeof client.character.list>(client.character.list);
expectType<typeof client.issue.retrieve>(client.issue.retrieve);

// ---------------------------------------------------------------------------
// Resource methods — list() returns Promise & AsyncIterable
// ---------------------------------------------------------------------------

const listResult = client.character.list();

// list() result is thenable (Promise-like)
expectAssignable<PromiseLike<unknown>>(listResult);

// list() result is async-iterable
expectAssignable<AsyncIterable<unknown>>(listResult);

// ---------------------------------------------------------------------------
// Resource methods — retrieve() returns a Promise
// ---------------------------------------------------------------------------

const retrieveResult = client.character.retrieve(1);
expectAssignable<Promise<unknown>>(retrieveResult);

// ---------------------------------------------------------------------------
// Response<T> generic shape
// ---------------------------------------------------------------------------

declare const response: Response<string>;
expectType<'OK'>(response.error);
expectType<number>(response.limit);
expectType<number>(response.offset);
expectType<number>(response.numberOfPageResults);
expectType<number>(response.numberOfTotalResults);
expectType<StatusCode>(response.statusCode);
expectType<string>(response.results);

// ---------------------------------------------------------------------------
// StatusCode enum values
// ---------------------------------------------------------------------------

expectType<StatusCode.OK>(StatusCode.OK);
expectType<StatusCode.InvalidApiKey>(StatusCode.InvalidApiKey);
expectType<StatusCode.ObjectNotFound>(StatusCode.ObjectNotFound);
expectType<StatusCode.UrlFormatError>(StatusCode.UrlFormatError);
expectType<StatusCode.JsonpCallbackMissing>(StatusCode.JsonpCallbackMissing);
expectType<StatusCode.FilterError>(StatusCode.FilterError);
expectType<StatusCode.SubscriberOnlyVideo>(StatusCode.SubscriberOnlyVideo);

// ---------------------------------------------------------------------------
// Error classes extend HttpClientError and have `help`
// ---------------------------------------------------------------------------

const errors = [
  new GenericError('test'),
  new ComicVineFilterError(),
  new ComicVineGenericError('test'),
  new ComicVineGenericRequestError('test'),
  new ComicJsonpCallbackMissingError(),
  new ComicVineObjectNotFoundError(),
  new ComicVineSubscriberOnlyError(),
  new ComicVineUnauthorizedError(),
  new ComicVineUrlFormatError(),
  new OptionsValidationError(['path'], 'message'),
] as const;

for (const error of errors) {
  expectAssignable<HttpClientError>(error);
  expectType<string>(error.help);
  expectAssignable<Error>(error);
}

// GenericError accepts optional message
new GenericError();
new GenericError('with message');

// ComicVineGenericRequestError extends ComicVineGenericError
expectAssignable<ComicVineGenericError>(new ComicVineGenericRequestError());

// ---------------------------------------------------------------------------
// customError()
// ---------------------------------------------------------------------------

expectType<GenericError>(customError(new Error('test')));
expectType<GenericError>(customError('non-error'));

// ---------------------------------------------------------------------------
// Utility methods on ComicVine instance
// ---------------------------------------------------------------------------

expectType<Array<string>>(client.getAvailableResources());
expectType<boolean>(client.hasResource('character'));
expectAssignable<Promise<void>>(client.clearCache());
expectAssignable<Promise<void>>(client.resetRateLimit('character'));
expectType<boolean>(client.isResourceLoaded('character'));

const stats = client.getCacheStats();
expectType<number>(stats.total);
expectType<number>(stats.loaded);
expectType<Array<string>>(stats.loadedResources);
