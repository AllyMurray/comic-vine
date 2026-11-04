import { afterEach, beforeEach, describe, it, expect, spyOn } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { HttpClient } from '@http-client-toolkit/core';
import { Issue } from './issue/index.js';

import apiErrorInUrlFormatResponse from '../__mocks__/api-error-response/error-in-url-format-response.json';
import apiRetrieveResponse from '../__mocks__/api-response/issue-details.json';
import apiListAutoPaginationResponseLimit50 from '../__mocks__/api-response/issue-list-auto-pagination-limit-50.json';
import apiListAutoPaginationResponseNoLimitNoOffset from '../__mocks__/api-response/issue-list-auto-pagination-no-limit-or-offset.json';
import apiListResponse from '../__mocks__/api-response/issue-list.json';
import expectedRetrieveResult from '../__mocks__/expected-responses/issue-details.json';

import expectedAutoPaginationResponseLimit50 from '../__mocks__/expected-responses/issue-list-auto-pagination-limit-50.json';
import expectedAutoPaginationResponseNoLimitNoOffset from '../__mocks__/expected-responses/issue-list-auto-pagination-no-limit-or-offset.json';
import expectedListResult from '../__mocks__/expected-responses/issue-list.json';

import { ComicVineUrlFormatError } from '../errors/index.js';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from '../http-client/hooks.js';
import { UrlBuilder } from '../http-client/url-builder.js';

const baseUrl = 'https://comicvine.gamespot.com/api/';
const responses: Array<{ path: string; body: unknown }> = [];
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

const mockResponse = (path: string, body: unknown) => {
  responses.push({ path, body });
};

beforeEach(() => {
  responses.length = 0;
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const response = responses.shift();
        if (!response) throw new Error(`Unexpected request: ${url}`);
        expect(url).toBe(`${baseUrl.replace(/\/$/, '')}${response.path}`);
        return Response.json(response.body);
      },
      { preconnect: fetch.preconnect },
    ),
  );
});

afterEach(() => {
  fetchSpy.mockRestore();
  expect(responses).toHaveLength(0);
});

const pickProperties = <T>(obj: T, properties: Array<keyof T>) => {
  return Object.assign(
    {},
    ...properties.map((prop) => ({ [prop]: obj[prop] })),
  );
};

describe('Issue', () => {
  const MOCK_SUCCESSFUL_ISSUE_ID = 1;
  const httpClient = new HttpClient({
    name: 'base-resource-test-client',
    responseTransformer: comicVineResponseTransformer,
    responseHandler: comicVineResponseHandler,
    errorHandler: comicVineErrorHandler,
  });
  const urlBuilder = new UrlBuilder('mock-api-key', baseUrl);

  describe('retrieve', () => {
    it('should return the full resource when a successful request is made', async () => {
      // Arrange
      mockResponse(
        '/issue/4000-1?format=json&api_key=mock-api-key',
        apiRetrieveResponse,
      );
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.retrieve(MOCK_SUCCESSFUL_ISSUE_ID);

      // Assert
      expect<unknown>(response).toStrictEqual(expectedRetrieveResult);
    });

    it('should return the correct properties when the field list is specified', async () => {
      // Arrange
      const expectedResult = pickProperties(expectedRetrieveResult, [
        'id',
        'name',
      ]);
      const mockApiResponse = {
        ...structuredClone(apiRetrieveResponse),
        results: pickProperties(apiRetrieveResponse.results, ['id', 'name']),
      };
      mockResponse(
        '/issue/4000-1?format=json&api_key=mock-api-key&field_list=id%2Cname',
        mockApiResponse,
      );
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.retrieve(MOCK_SUCCESSFUL_ISSUE_ID, {
        fieldList: ['id', 'name'],
      });

      // Assert
      expect<unknown>(response).toStrictEqual(expectedResult);
    });
  });

  describe('list', () => {
    it('should return pagination details and a list of issues when a successful request is made', async () => {
      // Arrange
      mockResponse('/issues?format=json&api_key=mock-api-key', apiListResponse);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list();

      // Assert
      expect<unknown>(response).toStrictEqual(expectedListResult);
    });

    it('should return the correct properties when the field list is specified', async () => {
      // Arrange
      const expectedResult = {
        ...structuredClone(expectedListResult),
        data: apiListResponse.results.map((item) =>
          pickProperties(item, ['id', 'name']),
        ),
      };
      const mockApiResponse = {
        ...structuredClone(apiListResponse),
        results: apiListResponse.results.map((item) =>
          pickProperties(item, ['id', 'name']),
        ),
      };
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&field_list=id%2Cname',
        mockApiResponse,
      );
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list({
        fieldList: ['id', 'name'],
      });

      // Assert
      expect<unknown>(response).toStrictEqual(expectedResult);
    });

    it('should return the correct data when limit is provided', async () => {
      // Arrange
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&limit=50',
        apiListAutoPaginationResponseLimit50.page1,
      );
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list({ limit: 50 });

      // Assert
      expect<unknown>(response).toStrictEqual(
        expectedAutoPaginationResponseLimit50.page1,
      );
    });

    it('should return the correct data when offset is provided', async () => {
      // Arrange
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&offset=100',
        apiListAutoPaginationResponseNoLimitNoOffset.page2,
      );
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list({ offset: 100 });

      // Assert
      expect<unknown>(response).toStrictEqual(
        expectedAutoPaginationResponseNoLimitNoOffset.page2,
      );
    });

    it('should throw a ComicVineUrlFormatError', async () => {
      // Arrange
      mockResponse(
        '/issues?format=json&api_key=mock-api-key',
        apiErrorInUrlFormatResponse,
      );
      const issue = new Issue(httpClient, urlBuilder);

      // Act / Assert
      await rejects(Promise.resolve(issue.list()), ComicVineUrlFormatError);
    });

    it('should allow the use of `for await of`', async () => {
      // Arrange
      mockResponse(
        '/issues?format=json&api_key=mock-api-key',
        apiListAutoPaginationResponseNoLimitNoOffset.page1,
      );
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&limit=100&offset=100',
        apiListAutoPaginationResponseNoLimitNoOffset.page2,
      );
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&limit=100&offset=200',
        apiListAutoPaginationResponseNoLimitNoOffset.page3,
      );

      const expectedResult = apiListResponse.results.map((item) => item.name);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const result = [];
      for await (const item of issue.list()) {
        result.push(item.name);
      }

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should allow the use of `for await of` with offset', async () => {
      // Arrange
      const offset = 100;
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&offset=100',
        apiListAutoPaginationResponseNoLimitNoOffset.page2,
      );
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&limit=100&offset=200',
        apiListAutoPaginationResponseNoLimitNoOffset.page3,
      );

      const expectedResult = apiListResponse.results
        .slice(offset) // Skip the offset
        .map((item) => item.name);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const result = [];
      for await (const item of issue.list({ offset })) {
        result.push(item.name);
      }

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw a ComicVineUrlFormatError when using `for await of`', async () => {
      // Arrange
      mockResponse(
        '/issues?format=json&api_key=mock-api-key',
        apiListAutoPaginationResponseNoLimitNoOffset.page1,
      );
      mockResponse(
        '/issues?format=json&api_key=mock-api-key&limit=100&offset=100',
        apiErrorInUrlFormatResponse,
      );

      const issue = new Issue(httpClient, urlBuilder);

      // Act
      try {
        const result = [];
        for await (const item of issue.list()) {
          result.push(item.name);
        }
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(ComicVineUrlFormatError);
      }
    });
  });
});
