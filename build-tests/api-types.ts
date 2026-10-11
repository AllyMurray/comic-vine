/**
 * Type contract tests for the public API surface.
 * Uses expect-type with TS6 and TS7 to check the published declarations.
 * A failing test here means a consumer-visible type change occurred.
 */
import { expectTypeOf } from 'expect-type';
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
expectTypeOf(client).toEqualTypeOf<ComicVine>();

// Named export and default export are the same class
expectTypeOf(client).toEqualTypeOf<ComicVineNamed>();

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
// @ts-expect-error The API key is required.
new ComicVine({});
// @ts-expect-error Constructor options are required.
new ComicVine();

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
expectTypeOf(client.character.list).toEqualTypeOf<
  typeof client.character.list
>();
expectTypeOf(client.issue.retrieve).toEqualTypeOf<
  typeof client.issue.retrieve
>();

// ---------------------------------------------------------------------------
// Resource methods — list() returns Promise & AsyncIterable
// ---------------------------------------------------------------------------

const listResult = client.character.list();

// list() result is thenable (Promise-like)
expectTypeOf(listResult).toExtend<PromiseLike<unknown>>();

// list() result is async-iterable
expectTypeOf(listResult).toExtend<AsyncIterable<unknown>>();

// ---------------------------------------------------------------------------
// Resource methods — retrieve() returns a Promise
// ---------------------------------------------------------------------------

const retrieveResult = client.character.retrieve(1);
expectTypeOf(retrieveResult).toExtend<Promise<unknown>>();

// ---------------------------------------------------------------------------
// Response<T> generic shape
// ---------------------------------------------------------------------------

declare const response: Response<string>;
expectTypeOf(response.error).toEqualTypeOf<'OK'>();
expectTypeOf(response.limit).toEqualTypeOf<number>();
expectTypeOf(response.offset).toEqualTypeOf<number>();
expectTypeOf(response.numberOfPageResults).toEqualTypeOf<number>();
expectTypeOf(response.numberOfTotalResults).toEqualTypeOf<number>();
expectTypeOf(response.statusCode).toEqualTypeOf<StatusCode>();
expectTypeOf(response.results).toEqualTypeOf<string>();

// ---------------------------------------------------------------------------
// StatusCode enum values
// ---------------------------------------------------------------------------

expectTypeOf<typeof StatusCode.OK>().toEqualTypeOf<StatusCode.OK>();
expectTypeOf<
  typeof StatusCode.InvalidApiKey
>().toEqualTypeOf<StatusCode.InvalidApiKey>();
expectTypeOf<
  typeof StatusCode.ObjectNotFound
>().toEqualTypeOf<StatusCode.ObjectNotFound>();
expectTypeOf<
  typeof StatusCode.UrlFormatError
>().toEqualTypeOf<StatusCode.UrlFormatError>();
expectTypeOf<
  typeof StatusCode.JsonpCallbackMissing
>().toEqualTypeOf<StatusCode.JsonpCallbackMissing>();
expectTypeOf<
  typeof StatusCode.FilterError
>().toEqualTypeOf<StatusCode.FilterError>();
expectTypeOf<
  typeof StatusCode.SubscriberOnlyVideo
>().toEqualTypeOf<StatusCode.SubscriberOnlyVideo>();

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
  expectTypeOf(error).toExtend<HttpClientError>();
  expectTypeOf(error.help).toEqualTypeOf<string>();
  expectTypeOf(error).toExtend<Error>();
}

// GenericError accepts optional message
new GenericError();
new GenericError('with message');

// ComicVineGenericRequestError extends ComicVineGenericError
expectTypeOf(
  new ComicVineGenericRequestError(),
).toExtend<ComicVineGenericError>();

// ---------------------------------------------------------------------------
// customError()
// ---------------------------------------------------------------------------

expectTypeOf(customError(new Error('test'))).toEqualTypeOf<GenericError>();
expectTypeOf(customError('non-error')).toEqualTypeOf<GenericError>();

// ---------------------------------------------------------------------------
// Utility methods on ComicVine instance
// ---------------------------------------------------------------------------

expectTypeOf(client.getAvailableResources()).toEqualTypeOf<Array<string>>();
expectTypeOf(client.hasResource('character')).toEqualTypeOf<boolean>();
expectTypeOf(client.clearCache()).toExtend<Promise<void>>();
expectTypeOf(client.resetRateLimit('character')).toExtend<Promise<void>>();
expectTypeOf(client.isResourceLoaded('character')).toEqualTypeOf<boolean>();

const stats = client.getCacheStats();
expectTypeOf(stats.total).toEqualTypeOf<number>();
expectTypeOf(stats.loaded).toEqualTypeOf<number>();
expectTypeOf(stats.loadedResources).toEqualTypeOf<Array<string>>();
