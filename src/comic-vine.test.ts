import { describe, test, expect, vi } from 'vitest';
import { ComicVine } from './comic-vine.js';
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
});
