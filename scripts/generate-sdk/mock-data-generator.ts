import { convertSnakeCaseToCamelCase } from '../../src/utils/case-converter.js';

export interface MockDataOutput {
  apiResponse: Record<string, unknown>;
  expectedResponse: Record<string, unknown>;
  paginatedData?: Array<{
    fileSuffix: string;
    apiResponse: Record<string, unknown>;
    expectedResponse: Record<string, unknown>;
  }>;
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
  const numberOfPages = Math.ceil((numberOfTotalResults - offset) / limit);
  const startPage = Math.floor(offset / limit) + 1;

  const snakeResults = apiResponseSnakeCase.results as unknown[];
  const camelResults = apiResponseCamelCase.results as unknown[];

  const apiResponse: Record<string, unknown> = {};
  const expectedResponse: Record<string, unknown> = {};

  for (let i = 0; i < numberOfPages; i++) {
    const page = startPage + i;
    const currentOffset = (page - 1) * limit;

    apiResponse[`page${page}`] = {
      limit,
      number_of_page_results: limit,
      number_of_total_results: numberOfTotalResults,
      offset: currentOffset,
      results: snakeResults.slice(currentOffset, currentOffset + limit),
    };

    expectedResponse[`page${page}`] = {
      limit,
      numberOfPageResults: limit,
      numberOfTotalResults,
      offset: currentOffset,
      data: camelResults.slice(currentOffset, currentOffset + limit),
    };
  }

  return { fileSuffix, apiResponse, expectedResponse };
}

/**
 * Generate mock data files from a sample API response.
 * Returns the api-response JSON (snake_case) and the expected-response JSON (camelCase).
 */
export function generateMockData(
  resourceFolder: string,
  apiResponseSnakeCase: Record<string, unknown>,
): MockDataOutput {
  const apiResponseCamelCase =
    convertSnakeCaseToCamelCase<Record<string, unknown>>(apiResponseSnakeCase);

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
