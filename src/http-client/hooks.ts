import type { HttpErrorContext } from '@http-client-toolkit/core';
import { StatusCode } from './status-code.js';
import {
  ComicVineFilterError,
  ComicJsonpCallbackMissingError,
  ComicVineObjectNotFoundError,
  ComicVineSubscriberOnlyError,
  ComicVineUrlFormatError,
  ComicVineUnauthorizedError,
  ComicVineGenericRequestError,
} from '../errors/index.js';
import { convertSnakeCaseToCamelCase } from '../utils/case-converter.js';

/**
 * Transforms snake_case API responses to camelCase.
 * Plugs into the toolkit's `responseTransformer` hook.
 */
export function comicVineResponseTransformer(data: unknown): unknown {
  return convertSnakeCaseToCamelCase(data);
}

/**
 * Checks Comic Vine application-level status codes and throws domain errors.
 * Plugs into the toolkit's `responseHandler` hook.
 *
 * Comic Vine returns 200 OK for application-level errors with a `statusCode`
 * field in the response body that indicates the actual result.
 */
export function comicVineResponseHandler(data: unknown): unknown {
  if (
    data !== null &&
    typeof data === 'object' &&
    'statusCode' in data &&
    typeof (data as Record<string, unknown>).statusCode === 'number'
  ) {
    const statusCode = (data as Record<string, unknown>).statusCode as number;
    switch (statusCode) {
      case StatusCode.FilterError:
        throw new ComicVineFilterError();
      case StatusCode.JsonpCallbackMissing:
        throw new ComicJsonpCallbackMissingError();
      case StatusCode.ObjectNotFound:
        throw new ComicVineObjectNotFoundError();
      case StatusCode.SubscriberOnlyVideo:
        throw new ComicVineSubscriberOnlyError();
      case StatusCode.UrlFormatError:
        throw new ComicVineUrlFormatError();
    }
  }
  return data;
}

/**
 * Maps HTTP errors to Comic Vine domain-specific errors.
 * Plugs into the toolkit's `errorHandler` hook.
 */
export function comicVineErrorHandler(context: HttpErrorContext): Error {
  if (context.response.status === 401) {
    return new ComicVineUnauthorizedError();
  }

  const bodyMessage =
    typeof context.response.data === 'object' && context.response.data !== null
      ? (context.response.data as { message?: string }).message
      : undefined;
  const message = bodyMessage
    ? `${context.message}, ${bodyMessage}`
    : context.message;
  return new ComicVineGenericRequestError(message);
}
