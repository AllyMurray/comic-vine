import {
  convertCamelCaseToSnakeCase,
  convertSnakeCaseToCamelCase,
} from './case-converter.js';

describe('case-converter', () => {
  let camelCaseObject: Object;
  let snakeCaseObject: Object;

  beforeEach(() => {
    camelCaseObject = {
      error: 'OK',
      limit: 1,
      results: {
        aliases: null,
        apiDetailUrl: 'https://comicvine.gamespot.com/api/issue/4000-719442/',
        dateAdded: '2019-09-19 07:18:39',
        hasStaffReview: false,
        id: 719442,
        issueNumber: '1',
        storyArcs: [1, 2, 3],
        volume: {
          apiDetailUrl:
            'https://comicvine.gamespot.com/api/volume/4050-121420/',
          id: 121420,
          name: 'Spider-Man',
        },
      },
    };

    snakeCaseObject = {
      error: 'OK',
      limit: 1,
      results: {
        aliases: null,
        api_detail_url: 'https://comicvine.gamespot.com/api/issue/4000-719442/',
        date_added: '2019-09-19 07:18:39',
        has_staff_review: false,
        id: 719442,
        issue_number: '1',
        story_arcs: [1, 2, 3],
        volume: {
          api_detail_url:
            'https://comicvine.gamespot.com/api/volume/4050-121420/',
          id: 121420,
          name: 'Spider-Man',
        },
      },
    };
  });

  test('should convert snake case to camel case', () => {
    const result = convertSnakeCaseToCamelCase(snakeCaseObject);
    expect(result).toStrictEqual(camelCaseObject);
  });

  test('should convert camel case to snake case', () => {
    const result = convertCamelCaseToSnakeCase(camelCaseObject);
    expect(result).toStrictEqual(snakeCaseObject);
  });
});
