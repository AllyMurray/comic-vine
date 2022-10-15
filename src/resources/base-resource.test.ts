import nock from 'nock';
import cloneDeep from 'clone-deep';
import { HttpClientFactory } from '../http-client';
import { Issue } from './issue/issue';
import apiRetrieveResponse from '../__mocks__/api-response/issue-details.json';
import expectedRetrieveResult from '../__mocks__/expected-responses/issue-details.json';
import apiListResponse from '../__mocks__/api-response/issue-list-item.json';
import expectedListResult from '../__mocks__/expected-responses/issue-list-item.json';

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
  });
});
