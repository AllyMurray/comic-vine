import { isObject } from './utils.js';
import { toCamelCase } from './utils.js';

export interface MockDataOutput {
  apiResponse: Record<string, unknown>;
  expectedResponse: Record<string, unknown>;
  paginatedData?: Array<{
    fileSuffix: string;
    apiResponse: Record<string, unknown>;
    expectedResponse: Record<string, unknown>;
  }>;
}

function convertPropertiesToCamelCase(object: unknown): unknown {
  if (isObject(object)) {
    const newObject: Record<string, unknown> = {};

    Object.keys(object).forEach((key) => {
      newObject[toCamelCase(key)] = convertPropertiesToCamelCase(object[key]);
    });

    return newObject;
  } else if (Array.isArray(object)) {
    return object.map((arrayElement) =>
      convertPropertiesToCamelCase(arrayElement),
    );
  }

  return object;
}

function generatePagedData({
  apiResponseSnakeCase,
  apiResponseCamelCase,
  limit = 100,
  offset = 0,
  numberOfTotalResults,
  fileSuffix,
}: {
  apiResponseSnakeCase: Record<string, unknown>;
  apiResponseCamelCase: Record<string, unknown>;
  limit?: number;
  offset?: number;
  numberOfTotalResults: number;
  fileSuffix: string;
}): {
  fileSuffix: string;
  apiResponse: Record<string, unknown>;
  expectedResponse: Record<string, unknown>;
} {
  const numberOfPages = (numberOfTotalResults - offset) / limit;
  let page = offset ? offset / limit : 1;

  const pageNumbers = Array.from({ length: numberOfPages }, (_, i) => i + page);

  const response = {
    limit,
    number_of_page_results: limit,
    number_of_total_results: numberOfTotalResults,
  };
  const autoPaginatedResponse = pageNumbers.reduce(
    (previousValue: Record<string, unknown>, currentPage: number) => {
      const currentOffset = (currentPage - 1) * limit;
      const results = apiResponseSnakeCase.results as unknown[];

      return {
        ...previousValue,
        [`page${currentPage}`]: {
          ...response,
          offset: currentOffset,
          results: results.slice(currentOffset, currentOffset + limit),
        },
      };
    },
    {},
  );

  const expectedResponseBase = {
    limit,
    numberOfPageResults: limit,
    numberOfTotalResults,
  };
  const autoPaginatedExpectedResponse = pageNumbers.reduce(
    (previousValue: Record<string, unknown>, currentPage: number) => {
      const currentOffset = (currentPage - 1) * limit;
      const results = apiResponseCamelCase.results as unknown[];

      return {
        ...previousValue,
        [`page${currentPage}`]: {
          ...expectedResponseBase,
          offset: currentOffset,
          data: results.slice(currentOffset, currentOffset + limit),
        },
      };
    },
    {},
  );

  return {
    fileSuffix,
    apiResponse: autoPaginatedResponse,
    expectedResponse: autoPaginatedExpectedResponse,
  };
}

/**
 * Generate mock data files from a sample API response.
 * Returns the api-response JSON (snake_case) and the expected-response JSON (camelCase).
 */
export function generateMockData(
  resourceFolder: string,
  apiResponseSnakeCase: Record<string, unknown>,
): MockDataOutput {
  const apiResponseCamelCase = convertPropertiesToCamelCase(
    apiResponseSnakeCase,
  ) as Record<string, unknown>;

  const isListResource = Array.isArray(apiResponseCamelCase.results);

  let expectedResponse: Record<string, unknown>;
  if (isListResource) {
    expectedResponse = {
      limit: apiResponseCamelCase.limit,
      numberOfPageResults: apiResponseCamelCase.numberOfPageResults,
      numberOfTotalResults: apiResponseCamelCase.numberOfTotalResults,
      offset: apiResponseCamelCase.offset,
      data: apiResponseCamelCase.results,
    };
  } else {
    expectedResponse = apiResponseCamelCase.results as Record<string, unknown>;
  }

  const result: MockDataOutput = {
    apiResponse: apiResponseSnakeCase,
    expectedResponse,
  };

  // Generate pagination mock data for issue list resources
  if (isListResource && resourceFolder.toLowerCase().includes('issue')) {
    result.paginatedData = [
      generatePagedData({
        apiResponseSnakeCase,
        apiResponseCamelCase,
        numberOfTotalResults: 300,
        fileSuffix: 'no-limit-or-offset',
      }),
      generatePagedData({
        apiResponseSnakeCase,
        apiResponseCamelCase,
        limit: 50,
        numberOfTotalResults: 300,
        fileSuffix: 'limit-50',
      }),
    ];
  }

  return result;
}
