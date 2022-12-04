import nock from 'nock';
import cloneDeep from 'clone-deep';
import { HttpClientFactory } from '../http-client';
import { Issue } from './issue/issue';

import apiRetrieveResponse from '../__mocks__/api-response/issue-details.json';
import expectedRetrieveResult from '../__mocks__/expected-responses/issue-details.json';

import apiListResponse from '../__mocks__/api-response/issue-list.json';
import expectedListResult from '../__mocks__/expected-responses/issue-list.json';

import apiListAutoPaginationResponseNoLimitNoOffset from '../__mocks__/api-response/issue-list-auto-pagination-no-limit-or-offset.json';
import expectedAutoPaginationResponseNoLimitNoOffset from '../__mocks__/expected-responses/issue-list-auto-pagination-no-limit-or-offset.json';

import apiListAutoPaginationResponseLimit50 from '../__mocks__/api-response/issue-list-auto-pagination-limit-50.json';
import expectedAutoPaginationResponseLimit50 from '../__mocks__/expected-responses/issue-list-auto-pagination-limit-50.json';

import apiErrorInUrlFormatResponse from '../__mocks__/api-error-response/error-in-url-format-response.json';
import { ComicVineUrlFormatError } from '../errors';

const baseUrl = 'https://comicvine.gamespot.com/api/';

const pickProperties = <T>(obj: T, properties: Array<keyof T>) => {
  return Object.assign(
    {},
    ...properties.map((prop) => ({ [prop]: obj[prop] }))
  );
};

describe('Issue', () => {
  const MOCK_SUCCESSFUL_ISSUE_ID = 1;
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    baseUrl
  );

  describe('retrieve', () => {
    it('should return the full resource when a successful request is made', async () => {
      // Arrange
      nock(baseUrl)
        .get('/issue/4000-1?format=json&api_key=mock-api-key')
        .reply(200, apiRetrieveResponse);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.retrieve(MOCK_SUCCESSFUL_ISSUE_ID);

      // Assert
      expect(response).toStrictEqual(expectedRetrieveResult);
    });

    it('should return the correct properties when the field list is specified', async () => {
      // Arrange
      const expectedResult = pickProperties(expectedRetrieveResult, [
        'id',
        'name',
      ]);
      const mockApiResponse = {
        ...cloneDeep(apiRetrieveResponse),
        results: pickProperties(apiRetrieveResponse.results, ['id', 'name']),
      };
      nock(baseUrl)
        .get(
          '/issue/4000-1?format=json&api_key=mock-api-key&field_list=id%2Cname'
        )
        .reply(200, mockApiResponse);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.retrieve(MOCK_SUCCESSFUL_ISSUE_ID, {
        fieldList: ['id', 'name'],
      });

      // Assert
      expect(response).toStrictEqual(expectedResult);
    });
  });

  describe('list', () => {
    it('should return pagination details and a list of issues when a successful request is made', async () => {
      // Arrange
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key')
        .reply(200, apiListResponse);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list();

      // Assert
      expect(response).toStrictEqual(expectedListResult);
    });

    it('should return the correct properties when the field list is specified', async () => {
      // Arrange
      const expectedResult = {
        ...cloneDeep(expectedListResult),
        data: apiListResponse.results.map((item) =>
          pickProperties(item, ['id', 'name'])
        ),
      };
      const mockApiResponse = {
        ...cloneDeep(apiListResponse),
        results: apiListResponse.results.map((item) =>
          pickProperties(item, ['id', 'name'])
        ),
      };
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&field_list=id%2Cname')
        .reply(200, mockApiResponse);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list({
        fieldList: ['id', 'name'],
      });

      // Assert
      expect(response).toStrictEqual(expectedResult);
    });

    it('should return the correct data when limit is provided', async () => {
      // Arrange
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&limit=50')
        .reply(200, apiListAutoPaginationResponseLimit50.page1);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list({ limit: 50 });

      // Assert
      expect(response).toStrictEqual(
        expectedAutoPaginationResponseLimit50.page1
      );
    });

    it('should return the correct data when offset is provided', async () => {
      // Arrange
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&offset=100')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page2);
      const issue = new Issue(httpClient, urlBuilder);

      // Act
      const response = await issue.list({ offset: 100 });

      // Assert
      expect(response).toStrictEqual(
        expectedAutoPaginationResponseNoLimitNoOffset.page2
      );
    });

    it('should throw a ComicVineUrlFormatError', async () => {
      // Arrange
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key')
        .reply(200, apiErrorInUrlFormatResponse);
      const issue = new Issue(httpClient, urlBuilder);

      // Act / Assert
      await expect(() => issue.list()).rejects.toBeInstanceOf(
        ComicVineUrlFormatError
      );
    });

    it('should allow the use of `for await of`', async () => {
      // Arrange
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page1);
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&limit=100&offset=100')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page2);
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&limit=100&offset=200')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page3);

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
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&offset=100')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page2);
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&limit=100&offset=200')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page3);

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
      expect.assertions(1);
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key')
        .reply(200, apiListAutoPaginationResponseNoLimitNoOffset.page1);
      nock(baseUrl)
        .get('/issues?format=json&api_key=mock-api-key&limit=100&offset=100')
        .reply(200, apiErrorInUrlFormatResponse);

      const issue = new Issue(httpClient, urlBuilder);

      // Act
      try {
        const result = [];
        for await (const item of issue.list()) {
          result.push(item.name);
        }
      } catch (error) {
        // Assert
        console.log((error as any).message);
        expect(error).toBeInstanceOf(ComicVineUrlFormatError);
      }
    });
  });
});
