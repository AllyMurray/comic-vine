import type { HttpErrorContext } from '@http-client-toolkit/core';
import { describe, test, expect } from 'vitest';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from './hooks.js';
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

describe('comicVineResponseTransformer', () => {
  test('should convert snake_case keys to camelCase', () => {
    const input = {
      status_code: 1,
      number_of_page_results: 10,
      number_of_total_results: 100,
      results: [{ first_name: 'Bruce', last_name: 'Wayne' }],
    };

    const result = comicVineResponseTransformer(input);

    expect(result).toStrictEqual({
      statusCode: 1,
      numberOfPageResults: 10,
      numberOfTotalResults: 100,
      results: [{ firstName: 'Bruce', lastName: 'Wayne' }],
    });
  });

  test('should pass through non-object data unchanged', () => {
    expect(comicVineResponseTransformer('hello')).toBe('hello');
    expect(comicVineResponseTransformer(42)).toBe(42);
    expect(comicVineResponseTransformer(null)).toBe(null);
  });
});

describe('comicVineResponseHandler', () => {
  test('should return data when statusCode is OK', () => {
    const data = { statusCode: StatusCode.OK, results: [] };
    expect(comicVineResponseHandler(data)).toBe(data);
  });

  test('should throw ComicVineFilterError for FilterError status', () => {
    const data = { statusCode: StatusCode.FilterError, results: [] };
    expect(() => comicVineResponseHandler(data)).toThrow(ComicVineFilterError);
  });

  test('should throw ComicJsonpCallbackMissingError for JsonpCallbackMissing status', () => {
    const data = { statusCode: StatusCode.JsonpCallbackMissing, results: [] };
    expect(() => comicVineResponseHandler(data)).toThrow(
      ComicJsonpCallbackMissingError,
    );
  });

  test('should throw ComicVineObjectNotFoundError for ObjectNotFound status', () => {
    const data = { statusCode: StatusCode.ObjectNotFound, results: [] };
    expect(() => comicVineResponseHandler(data)).toThrow(
      ComicVineObjectNotFoundError,
    );
  });

  test('should throw ComicVineSubscriberOnlyError for SubscriberOnlyVideo status', () => {
    const data = { statusCode: StatusCode.SubscriberOnlyVideo, results: [] };
    expect(() => comicVineResponseHandler(data)).toThrow(
      ComicVineSubscriberOnlyError,
    );
  });

  test('should throw ComicVineUrlFormatError for UrlFormatError status', () => {
    const data = { statusCode: StatusCode.UrlFormatError, results: [] };
    expect(() => comicVineResponseHandler(data)).toThrow(
      ComicVineUrlFormatError,
    );
  });

  test('should pass through data without statusCode field', () => {
    const data = { results: [] };
    expect(comicVineResponseHandler(data)).toBe(data);
  });

  test('should pass through null data', () => {
    expect(comicVineResponseHandler(null)).toBe(null);
  });
});

describe('comicVineErrorHandler', () => {
  test('should return ComicVineUnauthorizedError for 401 status', () => {
    const context: HttpErrorContext = {
      message: 'Request failed with status 401',
      url: 'https://comicvine.gamespot.com/api/issues',
      response: {
        status: 401,
        data: { error: 'Invalid API Key' },
        headers: new Headers(),
      },
    };

    const error = comicVineErrorHandler(context);
    expect(error).toBeInstanceOf(ComicVineUnauthorizedError);
  });

  test('should return ComicVineGenericRequestError for non-401 errors', () => {
    const context: HttpErrorContext = {
      message: 'Request failed with status 500',
      url: 'https://comicvine.gamespot.com/api/issues',
      response: {
        status: 500,
        data: { message: 'Internal Server Error' },
        headers: new Headers(),
      },
    };

    const error = comicVineErrorHandler(context);
    expect(error).toBeInstanceOf(ComicVineGenericRequestError);
    expect(error.message).toBe(
      'Request to comic vine failed: Request failed with status 500, Internal Server Error',
    );
  });

  test('should return ComicVineGenericRequestError without body message', () => {
    const context: HttpErrorContext = {
      message: 'Request failed with status 500',
      url: 'https://comicvine.gamespot.com/api/issues',
      response: {
        status: 500,
        data: undefined,
        headers: new Headers(),
      },
    };

    const error = comicVineErrorHandler(context);
    expect(error).toBeInstanceOf(ComicVineGenericRequestError);
    expect(error.message).toBe(
      'Request to comic vine failed: Request failed with status 500',
    );
  });
});
