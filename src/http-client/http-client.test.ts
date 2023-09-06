import nock from 'nock';
import { HttpClient } from './http-client.js';
import { StatusCode } from './status-code.js';
import {
  ComicJsonpCallbackMissingError,
  ComicVineFilterError,
  ComicVineGenericRequestError,
  ComicVineObjectNotFoundError,
  ComicVineSubscriberOnlyError,
  ComicVineUnauthorizedError,
  ComicVineUrlFormatError,
} from '../errors/index.js';

const baseUrl = 'https://comicvine.gamespot.com/api';

interface SnakeCaseResponse {
  error: 'OK';
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  statusCode: StatusCode;
  results: any;
}

const getMockResponse = (
  overrides: Partial<SnakeCaseResponse>,
): SnakeCaseResponse => {
  return {
    error: 'OK',
    limit: 1,
    offset: 0,
    number_of_page_results: 1,
    number_of_total_results: 1,
    statusCode: 1,
    results: undefined,
    ...overrides,
  };
};

describe('HttpClient', () => {
  let httpClient: HttpClient;
  beforeEach(() => {
    httpClient = new HttpClient();
  });

  test('should return a successful response', async () => {
    // Arrange
    const mockResponse = getMockResponse({ results: [] });
    nock(baseUrl).get('/successful-response').reply(200, mockResponse);

    // Act
    const result = await httpClient.get(`${baseUrl}/successful-response`);

    // Assert
    expect(result).toStrictEqual({
      error: 'OK',
      limit: 1,
      offset: 0,
      numberOfPageResults: 1,
      numberOfTotalResults: 1,
      statusCode: 1,
      results: [],
    });
  });

  test('should throw a ComicVineFilterError when statusCode FilterError (104) is returned', async () => {
    // Arrange
    const mockResponse = getMockResponse({
      statusCode: StatusCode.FilterError,
    });
    nock(baseUrl).get('/filter-error').reply(200, mockResponse);

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/filter-error`),
    ).rejects.toThrowError(new ComicVineFilterError());
  });

  test('should throw a ComicJsonpCallbackMissingError when statusCode JsonpCallbackMissing (103) is returned', async () => {
    // Arrange
    const mockResponse = getMockResponse({
      statusCode: StatusCode.JsonpCallbackMissing,
    });
    nock(baseUrl).get('/jsonp-error').reply(200, mockResponse);

    // Act/Assert
    await expect(httpClient.get(`${baseUrl}/jsonp-error`)).rejects.toThrowError(
      new ComicJsonpCallbackMissingError(),
    );
  });

  test('should throw a ComicVineObjectNotFoundError when statusCode ObjectNotFound (101) is returned', async () => {
    // Arrange
    const mockResponse = getMockResponse({
      statusCode: StatusCode.ObjectNotFound,
    });
    nock(baseUrl).get('/object-not-found-error').reply(200, mockResponse);

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/object-not-found-error`),
    ).rejects.toThrowError(new ComicVineObjectNotFoundError());
  });

  test('should throw a ComicVineSubscriberOnlyError when statusCode SubscriberOnlyVideo (105) is returned', async () => {
    // Arrange
    const mockResponse = getMockResponse({
      statusCode: StatusCode.SubscriberOnlyVideo,
    });
    nock(baseUrl).get('/subscriber-only-video').reply(200, mockResponse);

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/subscriber-only-video`),
    ).rejects.toThrowError(new ComicVineSubscriberOnlyError());
  });

  test('should throw a ComicVineUrlFormatError when statusCode UrlFormatError (102) is returned', async () => {
    // Arrange
    const mockResponse = getMockResponse({
      statusCode: StatusCode.UrlFormatError,
    });
    nock(baseUrl).get('/url-format-error').reply(200, mockResponse);

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/url-format-error`),
    ).rejects.toThrowError(new ComicVineUrlFormatError());
  });

  test('should throw a ComicVineUnauthorizedError when http status 401 is returned', async () => {
    // Arrange
    nock(baseUrl).get('/unauthorized').reply(401, {
      error: 'Invalid API Key',
      limit: 0,
      offset: 0,
      number_of_page_results: 0,
      number_of_total_results: 0,
      status_code: 100,
      results: [],
    });

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/unauthorized`),
    ).rejects.toThrowError(new ComicVineUnauthorizedError());
  });

  test('should throw a ComicVineGenericRequestError when an unknown error has occurred', async () => {
    // Arrange
    const errorMessage = 'An unknown error has occurred';
    nock(baseUrl).get('/unknown-error').reply(500, {
      message: errorMessage,
    });

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/unknown-error`),
    ).rejects.toThrowError(
      new ComicVineGenericRequestError(
        `Request failed with status code 500, ${errorMessage}`,
      ),
    );
  });

  test('should throw a ComicVineGenericRequestError when an unknown error has occurred and there is no response data', async () => {
    // Arrange
    nock(baseUrl).get('/unknown-error').reply(500);

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/unknown-error`),
    ).rejects.toThrowError(
      new ComicVineGenericRequestError(`Request failed with status code 500`),
    );
  });

  test('should throw a ComicVineGenericRequestError when the request fails and there is no response', async () => {
    // Arrange
    nock(baseUrl).get('/failed-request').replyWithError('Complete failure');

    // Act/Assert
    await expect(
      httpClient.get(`${baseUrl}/failed-request`),
    ).rejects.toThrowError(
      new ComicVineGenericRequestError(`Complete failure`),
    );
  });
});
