import { UrlBuilder } from './url-builder.js';
import { ResourceType } from '../resources/index.js';

const mockApiKey = 'mock-api-key';
const getUrlBuilder = (
  baseUrl: string = 'https://comicvine.gamespot.com/api/',
) => {
  return new UrlBuilder(mockApiKey, baseUrl);
};

describe('UrlBuilder', () => {
  describe('retrieve', () => {
    test('should have correct url', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.retrieve(ResourceType.Character, 1);

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/character/4005-1?format=json&api_key=mock-api-key',
      );
    });

    test('should set field list in list string', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.retrieve<any>(ResourceType.Character, 1, {
        fieldList: ['testField1', 'testField2'],
      });

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/character/4005-1?format=json&api_key=mock-api-key&field_list=test_field1%2Ctest_field2',
      );
    });
  });

  describe('list', () => {
    test('should have correct url when useProxy is false', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.list(ResourceType.Character);

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/characters?format=json&api_key=mock-api-key',
      );
    });

    test('should set limit in list string', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.list(ResourceType.Character, { limit: 1 });

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/characters?format=json&api_key=mock-api-key&limit=1',
      );
    });

    test('should set offset in list string', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.list(ResourceType.Character, { offset: 1 });

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/characters?format=json&api_key=mock-api-key&offset=1',
      );
    });

    test('should set sort in list string', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.list(ResourceType.Character, {
        sort: { field: 'testField', direction: 'asc' },
      });

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/characters?format=json&api_key=mock-api-key&sort=testField%3Aasc',
      );
    });

    test('should set sort in list string', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.list(ResourceType.Character, {
        fieldList: ['testField1', 'testField2'],
      });

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/characters?format=json&api_key=mock-api-key&field_list=test_field1%2Ctest_field2',
      );
    });

    test('should set filter params in list string', () => {
      // Arrange
      const urlBuilder = getUrlBuilder();

      // Act
      const url = urlBuilder.list(ResourceType.Character, {
        filter: { testField1: 'test-value', testField2: 10 },
      });

      //Assert
      expect(url).toBe(
        'https://comicvine.gamespot.com/api/characters?format=json&api_key=mock-api-key&filter=test_field1%3Atest-value%2Ctest_field2%3A10',
      );
    });
  });
});
