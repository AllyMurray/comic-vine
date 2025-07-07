import axios from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComicVine } from './comic-vine.js';
import {
  HttpClient,
  HttpClientStores,
  HttpClientOptions,
} from './http-client/http-client.js';
import { CacheStore, DedupeStore, RateLimitStore } from './stores/index.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ComicVine with Stores', () => {
  let comicVine: ComicVine;
  let mockCache: CacheStore;
  let mockDedupe: DedupeStore;
  let mockRateLimit: RateLimitStore;
  let axiosInstance: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    mockDedupe = {
      register: vi.fn().mockResolvedValue('test-id'),
      waitFor: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      isInProgress: vi.fn().mockResolvedValue(false),
    };

    mockRateLimit = {
      canProceed: vi.fn().mockResolvedValue(true),
      record: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockResolvedValue({
        remaining: 100,
        resetTime: new Date(Date.now() + 60000),
        limit: 100,
      }),
      reset: vi.fn().mockResolvedValue(undefined),
      getWaitTime: vi.fn().mockResolvedValue(0),
    };

    axiosInstance = {
      get: vi.fn().mockResolvedValue({
        data: {
          statusCode: 1,
          results: { id: 1, name: 'Test Issue' },
          limit: 10,
          numberOfPageResults: 1,
          numberOfTotalResults: 1,
          offset: 0,
        },
      }),
    };

    mockedAxios.create = vi.fn().mockReturnValue(axiosInstance);

    // Mock HttpClientFactory to create HttpClient with stores
    vi.doMock('./http-client/index.js', () => ({
      HttpClientFactory: {
        createClient: (
          stores: HttpClientStores,
          options: HttpClientOptions,
        ) => {
          return new HttpClient(stores, options);
        },
        createUrlBuilder: vi.fn().mockReturnValue({
          retrieve: vi.fn().mockReturnValue('http://test.com/api/character/'),
          list: vi.fn().mockReturnValue('http://test.com/api/character/'),
        }),
      },
    }));

    comicVine = new ComicVine(
      'test-key',
      {},
      {
        cache: mockCache,
        dedupe: mockDedupe,
        rateLimit: mockRateLimit,
      },
    );
  });

  describe('cache store integration', () => {
    it('should check cache before making request', async () => {
      // Mock cache to return a value
      mockCache.get = vi.fn().mockResolvedValue({
        statusCode: 1,
        results: { test: 'cached-value' },
      });

      const result = await comicVine.character.retrieve(1);

      expect(mockCache.get).toHaveBeenCalledWith(expect.any(String));
      expect(axiosInstance.get).not.toHaveBeenCalled();
      expect(result).toEqual({ test: 'cached-value' });
    });

    it('should store result in cache after successful request', async () => {
      // Mock cache to return undefined (no cached value)
      mockCache.get = vi.fn().mockResolvedValue(undefined);
      mockCache.set = vi.fn().mockResolvedValue(undefined);

      const result = await comicVine.character.retrieve(1);

      expect(mockCache.get).toHaveBeenCalledWith(expect.any(String));
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          statusCode: 1,
          results: { id: 1, name: 'Test Issue' },
        }),
        3600, // default TTL
      );
      expect(result).toEqual({ id: 1, name: 'Test Issue' });
    });
  });

  describe('dedupe store integration', () => {
    it('should register and complete dedupe jobs', async () => {
      await comicVine.character.retrieve(1);

      expect(mockDedupe.register).toHaveBeenCalledWith(expect.any(String));
      expect(mockDedupe.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          statusCode: 1,
          results: { id: 1, name: 'Test Issue' },
        }),
      );
    });
  });

  describe('rate limit store integration', () => {
    it('should check rate limit before making request', async () => {
      await comicVine.character.retrieve(1);

      expect(mockRateLimit.canProceed).toHaveBeenCalledWith('character');
      expect(mockRateLimit.record).toHaveBeenCalledWith('character');
    });

    it('should wait when rate limited and throwOnRateLimit is false', async () => {
      const rateLimitedComicVine = new ComicVine(
        'test-key',
        {},
        {
          cache: mockCache,
          dedupe: mockDedupe,
          rateLimit: mockRateLimit,
        },
        {
          throwOnRateLimit: false,
          maxWaitTime: 200,
        },
      );

      mockRateLimit.canProceed = vi.fn().mockResolvedValue(false);
      mockRateLimit.getWaitTime = vi.fn().mockResolvedValue(100);

      const startTime = Date.now();
      await rateLimitedComicVine.character.retrieve(1);
      const endTime = Date.now();

      expect(mockRateLimit.getWaitTime).toHaveBeenCalledWith('character');
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});
