import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComicVine } from './comic-vine.js';
import { CacheStore, DedupeStore, RateLimitStore } from './stores/index.js';

// Mock the HTTP client and URL builder
vi.mock('./http-client/index.js', () => ({
  HttpClientFactory: {
    createClient: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((url) => {
        if (url.includes('retrieve')) {
          return Promise.resolve({
            results: { id: 1, name: 'Test Issue' },
            limit: 10,
            numberOfPageResults: 1,
            numberOfTotalResults: 1,
            offset: 0,
          });
        } else {
          // For list endpoints, return results as an array
          return Promise.resolve({
            results: [{ id: 1, name: 'Test Issue' }],
            limit: 10,
            numberOfPageResults: 1,
            numberOfTotalResults: 1,
            offset: 0,
          });
        }
      }),
    }),
    createUrlBuilder: vi.fn().mockReturnValue({
      retrieve: vi.fn().mockReturnValue('http://test.com/retrieve'),
      list: vi.fn().mockReturnValue('http://test.com/list'),
    }),
  },
}));

// Mock store implementations
class _MockCacheStore implements CacheStore {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();

  async get(hash: string): Promise<unknown | undefined> {
    const item = this.cache.get(hash);
    if (!item || Date.now() > item.expiresAt) {
      return undefined;
    }
    return item.value;
  }

  async set(hash: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.cache.set(hash, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(hash: string): Promise<void> {
    this.cache.delete(hash);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

class _MockDedupeStore implements DedupeStore {
  private jobs = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  async waitFor(_hash: string): Promise<unknown | undefined> {
    return undefined; // No existing jobs for testing
  }

  async register(_hash: string): Promise<string> {
    return 'job-id';
  }

  async complete(_hash: string, value: unknown): Promise<void> {
    const job = this.jobs.get(_hash);
    if (job) {
      job.resolve(value);
      this.jobs.delete(_hash);
    }
  }

  async fail(_hash: string, error: Error): Promise<void> {
    const job = this.jobs.get(_hash);
    if (job) {
      job.reject(error);
      this.jobs.delete(_hash);
    }
  }

  async isInProgress(_hash: string): Promise<boolean> {
    return false;
  }
}

class _MockRateLimitStore implements RateLimitStore {
  private requests = new Map<string, Array<number>>();
  private shouldBlock = false;

  async canProceed(_resource: string): Promise<boolean> {
    return !this.shouldBlock;
  }

  async record(_resource: string): Promise<void> {
    const requests = this.requests.get(_resource) || [];
    requests.push(Date.now());
    this.requests.set(_resource, requests);
  }

  async getStatus(_resource: string): Promise<{
    remaining: number;
    resetTime: Date;
    limit: number;
  }> {
    return {
      remaining: 100,
      resetTime: new Date(Date.now() + 60000),
      limit: 100,
    };
  }

  async reset(_resource: string): Promise<void> {
    this.requests.delete(_resource);
  }

  async getWaitTime(_resource: string): Promise<number> {
    return this.shouldBlock ? 1000 : 0;
  }

  // Test helper method
  setShouldBlock(block: boolean): void {
    this.shouldBlock = block;
  }
}

describe('ComicVine with Stores', () => {
  let comicVine: ComicVine;
  let mockCache: CacheStore;
  let mockDedupe: DedupeStore;
  let mockRateLimit: RateLimitStore;

  beforeEach(() => {
    mockCache = {
      get: () => Promise.resolve(undefined),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };

    mockDedupe = {
      register: () => Promise.resolve('test-id'),
      waitFor: () => Promise.resolve(undefined),
      complete: () => Promise.resolve(),
      fail: () => Promise.resolve(),
      isInProgress: () => Promise.resolve(false),
    };

    mockRateLimit = {
      canProceed: () => Promise.resolve(true),
      record: () => Promise.resolve(),
      getStatus: () =>
        Promise.resolve({
          remaining: 100,
          resetTime: new Date(Date.now() + 60000),
          limit: 100,
        }),
      reset: () => Promise.resolve(),
      getWaitTime: () => Promise.resolve(0),
    };

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
      let cacheChecked = false;
      let requestMade = false;

      mockCache.get = async (_hash: string) => {
        cacheChecked = true;
        return { test: 'cached-value' };
      };

      // Mock the actual API call using vi.spyOn
      const retrieveSpy = vi
        .spyOn(comicVine.character, 'retrieve')
        .mockImplementation(async () => {
          requestMade = true;
          return { test: 'api-value' } as unknown;
        });

      await comicVine.character.retrieve(1);

      expect(cacheChecked).toBe(true);
      expect(requestMade).toBe(false);

      retrieveSpy.mockRestore();
    });

    it('should store result in cache after successful request', async () => {
      let cacheSet = false;
      let cachedValue: unknown;

      mockCache.get = async (_hash: string) => undefined;
      mockCache.set = async (_hash: string, value: unknown) => {
        cacheSet = true;
        cachedValue = value;
      };

      // Mock the actual API call using vi.spyOn
      const retrieveSpy = vi
        .spyOn(comicVine.character, 'retrieve')
        .mockImplementation(async () => {
          return { test: 'api-value' } as unknown;
        });

      await comicVine.character.retrieve(1);

      expect(cacheSet).toBe(true);
      expect(cachedValue).toEqual({ test: 'api-value' });

      retrieveSpy.mockRestore();
    });
  });

  describe('dedupe store integration', () => {
    it('should register and complete dedupe jobs', async () => {
      let registered = false;
      let completed = false;

      mockDedupe.register = async (_hash: string) => {
        registered = true;
        return 'test-id';
      };

      mockDedupe.complete = async (_hash: string, _value: unknown) => {
        completed = true;
      };

      // Mock the actual API call
      const _originalGet = comicVine.character.retrieve;
      (comicVine.character.retrieve as unknown as typeof _originalGet) = async (
        _id: number,
        _options: Record<string, unknown> = {},
      ) => {
        return { test: 'api-value' } as unknown;
      };

      await comicVine.character.retrieve(1);

      expect(registered).toBe(true);
      expect(completed).toBe(true);
    });
  });

  describe('rate limit store integration', () => {
    it('should check rate limit before making request', async () => {
      let rateLimitChecked = false;
      let rateLimitRecorded = false;

      mockRateLimit.canProceed = async (_resource: string) => {
        rateLimitChecked = true;
        return true;
      };

      mockRateLimit.record = async (_resource: string) => {
        rateLimitRecorded = true;
      };

      // Mock the actual API call
      const _originalGet = comicVine.character.retrieve;
      (comicVine.character.retrieve as unknown as typeof _originalGet) = async (
        _id: number,
        _options: Record<string, unknown> = {},
      ) => {
        return { test: 'api-value' } as unknown;
      };

      await comicVine.character.retrieve(1);

      expect(rateLimitChecked).toBe(true);
      expect(rateLimitRecorded).toBe(true);
    });

    it('should wait when rate limited and throwOnRateLimit is false', async () => {
      // Create a separate ComicVine instance with throwOnRateLimit: false
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

      let waitTimeCalled = false;

      mockRateLimit.canProceed = async (_resource: string) => {
        return false;
      };

      mockRateLimit.getWaitTime = async (_resource: string) => {
        waitTimeCalled = true;
        return 100; // 100ms wait time
      };

      // Mock the actual API call
      const _originalGet = rateLimitedComicVine.character.retrieve;
      (rateLimitedComicVine.character
        .retrieve as unknown as typeof _originalGet) = async (
        _id: number,
        _options: Record<string, unknown> = {},
      ) => {
        return { test: 'api-value' } as unknown;
      };

      const startTime = Date.now();
      await rateLimitedComicVine.character.retrieve(1);
      const endTime = Date.now();

      expect(waitTimeCalled).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});
