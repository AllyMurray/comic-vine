import axios, { type AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComicVine } from './comic-vine.js';
import {
  HttpClient,
  HttpClientStores,
  HttpClientOptions,
} from './http-client/http-client.js';
import { CacheStore, DedupeStore, RateLimitStore } from './stores/index.js';

vi.mock('axios');

describe('ComicVine with Stores', () => {
  let comicVine: ComicVine;
  let mockCache: CacheStore;
  let mockDedupe: DedupeStore;
  let mockRateLimit: RateLimitStore;
  let axiosInstance: Partial<AxiosInstance>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create axios mock instance
    axiosInstance = {
      get: vi.fn().mockResolvedValue({
        data: {
          statusCode: 1,
          results: { id: 1, name: 'Test Issue' },
        },
      }),
    };

    // Mock axios.create to return our mock instance
    vi.mocked(axios.create).mockReturnValue(axiosInstance as AxiosInstance);

    // Create mock stores
    mockCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    mockDedupe = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      register: vi.fn().mockResolvedValue('job-id'),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      isInProgress: vi.fn().mockResolvedValue(false),
    };

    mockRateLimit = {
      canProceed: vi.fn().mockResolvedValue(true),
      record: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockResolvedValue({
        remaining: 100,
        resetTime: new Date(),
        limit: 100,
      }),
      reset: vi.fn().mockResolvedValue(undefined),
      getWaitTime: vi.fn().mockResolvedValue(0),
    };

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

    comicVine = new ComicVine({
      apiKey: 'test-key',
      stores: {
        cache: mockCache,
        dedupe: mockDedupe,
        rateLimit: mockRateLimit,
      },
    });
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
    it('should check for existing requests before making new ones', async () => {
      // Mock dedupe to return undefined (no existing request)
      mockDedupe.waitFor = vi.fn().mockResolvedValue(undefined);
      mockDedupe.register = vi.fn().mockResolvedValue('job-id');

      const result = await comicVine.character.retrieve(1);

      expect(mockDedupe.waitFor).toHaveBeenCalledWith(expect.any(String));
      expect(mockDedupe.register).toHaveBeenCalledWith(expect.any(String));
      expect(mockDedupe.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          statusCode: 1,
          results: { id: 1, name: 'Test Issue' },
        }),
      );
      expect(result).toEqual({ id: 1, name: 'Test Issue' });
    });

    it('should return existing result if request is in progress', async () => {
      // Mock dedupe to return an existing result
      mockDedupe.waitFor = vi.fn().mockResolvedValue({
        statusCode: 1,
        results: { test: 'deduped-value' },
      });

      const result = await comicVine.character.retrieve(1);

      expect(mockDedupe.waitFor).toHaveBeenCalledWith(expect.any(String));
      expect(mockDedupe.register).not.toHaveBeenCalled();
      expect(axiosInstance.get).not.toHaveBeenCalled();
      expect(result).toEqual({ test: 'deduped-value' });
    });
  });

  describe('rate limit store integration', () => {
    it('should check rate limit before making request', async () => {
      // Mock rate limit to allow request
      mockRateLimit.canProceed = vi.fn().mockResolvedValue(true);
      mockRateLimit.record = vi.fn().mockResolvedValue(undefined);

      const result = await comicVine.character.retrieve(1);

      expect(mockRateLimit.canProceed).toHaveBeenCalledWith('character');
      expect(mockRateLimit.record).toHaveBeenCalledWith('character');
      expect(result).toEqual({ id: 1, name: 'Test Issue' });
    });

    it('should throw error when rate limited and throwOnRateLimit is true', async () => {
      // Create client with throwOnRateLimit: true
      const rateLimitedClient = new ComicVine({
        apiKey: 'test-key',
        stores: {
          rateLimit: mockRateLimit,
        },
        client: {
          throwOnRateLimit: true,
        },
      });

      // Mock rate limit to block request
      mockRateLimit.canProceed = vi.fn().mockResolvedValue(false);
      mockRateLimit.getWaitTime = vi.fn().mockResolvedValue(5000);

      await expect(rateLimitedClient.character.retrieve(1)).rejects.toThrow(
        'Rate limit exceeded',
      );

      expect(mockRateLimit.canProceed).toHaveBeenCalledWith('character');
      expect(mockRateLimit.getWaitTime).toHaveBeenCalledWith('character');
      expect(axiosInstance.get).not.toHaveBeenCalled();
    });
  });
});
