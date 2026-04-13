import { describe, test, expect, vi } from 'vitest';
import { ComicVine } from './comic-vine.js';
import { StatusCode } from './http-client/status-code.js';
import * as resources from './resources/resource-list.js';
import type { ValueOf } from './types/index.js';

describe('ComicVine', () => {
  const mockApiKey = 'mock-api-key';

  describe('constructor', () => {
    test('should create a ComicVine instance with object-based constructor', () => {
      const comicVine = new ComicVine({ apiKey: mockApiKey });
      expect(comicVine).toBeInstanceOf(ComicVine);
    });

    test('should handle baseUrl in constructor', () => {
      const customBaseUrl = 'https://custom.api.com/';
      const comicVine = new ComicVine({
        apiKey: mockApiKey,
        baseUrl: customBaseUrl,
      });
      expect(comicVine).toBeInstanceOf(ComicVine);
    });

    test('should handle stores in constructor', () => {
      const mockCache = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      const comicVine = new ComicVine({
        apiKey: mockApiKey,
        stores: { cache: mockCache },
      });
      expect(comicVine).toBeInstanceOf(ComicVine);
    });

    test('should handle client options in constructor', () => {
      const comicVine = new ComicVine({
        apiKey: mockApiKey,
        client: {
          defaultCacheTTL: 7200,
          throwOnRateLimit: false,
          maxWaitTime: 30000,
        },
      });
      expect(comicVine).toBeInstanceOf(ComicVine);
    });
  });

  type ComicVineProperty = keyof ComicVine;
  type ResourceClass = ValueOf<typeof resources>;
  const resourceList: Array<[ComicVineProperty, ResourceClass]> = [
    ['character', resources.Character],
    ['concept', resources.Concept],
    ['episode', resources.Episode],
    ['issue', resources.Issue],
    ['location', resources.Location],
    ['movie', resources.Movie],
    ['origin', resources.Origin],
    ['person', resources.Person],
    ['power', resources.Power],
    ['promo', resources.Promo],
    ['publisher', resources.Publisher],
    ['series', resources.Series],
    ['storyArc', resources.StoryArc],
    ['team', resources.Team],
    ['thing', resources.Thing],
    ['videoCategory', resources.VideoCategory],
    ['video', resources.Video],
    ['videoType', resources.VideoType],
    ['volume', resources.Volume],
  ];

  test.each(resourceList)(
    `should expose an instance of %s`,
    (resourceProperty, ResourceType) => {
      const comicVine = new ComicVine({ apiKey: mockApiKey });
      expect(comicVine[resourceProperty]).toBeInstanceOf(ResourceType);
    },
  );

  describe('rate limiting', () => {
    test('should use the same canonical resource name for list, retrieve, and status APIs', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: 'OK',
              limit: 1,
              offset: 0,
              number_of_page_results: 1,
              number_of_total_results: 1,
              status_code: StatusCode.OK,
              results: [{ id: 1, name: 'Issue 1' }],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: 'OK',
              limit: 1,
              offset: 0,
              number_of_page_results: 1,
              number_of_total_results: 1,
              status_code: StatusCode.OK,
              results: { id: 1, name: 'Issue 1' },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );

      vi.stubGlobal('fetch', fetchMock);

      const rateLimitStore = {
        canProceed: vi.fn().mockResolvedValue(true),
        record: vi.fn().mockResolvedValue(undefined),
        getStatus: vi.fn().mockResolvedValue({
          remaining: 59,
          resetTime: new Date(),
          limit: 60,
        }),
        reset: vi.fn().mockResolvedValue(undefined),
        getWaitTime: vi.fn().mockResolvedValue(0),
      };

      try {
        const comicVine = new ComicVine({
          apiKey: mockApiKey,
          stores: { rateLimit: rateLimitStore },
        });

        await comicVine.issue.list({ limit: 1 });
        await comicVine.issue.retrieve(1);
        await comicVine.getRateLimitStatus('issue');
        await comicVine.getRateLimitStatus('issues');
        await comicVine.resetRateLimit('issue');

        expect(rateLimitStore.canProceed).toHaveBeenNthCalledWith(
          1,
          'issues',
          'background',
        );
        expect(rateLimitStore.canProceed).toHaveBeenNthCalledWith(
          2,
          'issues',
          'background',
        );
        expect(rateLimitStore.record).toHaveBeenNthCalledWith(
          1,
          'issues',
          'background',
        );
        expect(rateLimitStore.record).toHaveBeenNthCalledWith(
          2,
          'issues',
          'background',
        );
        expect(rateLimitStore.getStatus).toHaveBeenNthCalledWith(1, 'issues');
        expect(rateLimitStore.getStatus).toHaveBeenNthCalledWith(2, 'issues');
        expect(rateLimitStore.reset).toHaveBeenCalledWith('issues');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
