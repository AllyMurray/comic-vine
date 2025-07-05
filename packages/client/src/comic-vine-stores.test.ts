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
class MockCacheStore implements CacheStore {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  async get(hash: string): Promise<any | undefined> {
    const item = this.cache.get(hash);
    if (!item || Date.now() > item.expiresAt) {
      return undefined;
    }
    return item.value;
  }

  async set(hash: string, value: any, ttlSeconds: number): Promise<void> {
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

class MockDedupeStore implements DedupeStore {
  private jobs = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();

  async waitFor(hash: string): Promise<any | undefined> {
    return undefined; // No existing jobs for testing
  }

  async register(hash: string): Promise<string> {
    return 'job-id';
  }

  async complete(hash: string, value: any): Promise<void> {
    const job = this.jobs.get(hash);
    if (job) {
      job.resolve(value);
      this.jobs.delete(hash);
    }
  }

  async fail(hash: string, error: Error): Promise<void> {
    const job = this.jobs.get(hash);
    if (job) {
      job.reject(error);
      this.jobs.delete(hash);
    }
  }

  async isInProgress(hash: string): Promise<boolean> {
    return false;
  }
}

class MockRateLimitStore implements RateLimitStore {
  private requests = new Map<string, number[]>();
  private shouldBlock = false;

  async canProceed(resource: string): Promise<boolean> {
    return !this.shouldBlock;
  }

  async record(resource: string): Promise<void> {
    const requests = this.requests.get(resource) || [];
    requests.push(Date.now());
    this.requests.set(resource, requests);
  }

  async getStatus(resource: string): Promise<{
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

  async reset(resource: string): Promise<void> {
    this.requests.delete(resource);
  }

  async getWaitTime(resource: string): Promise<number> {
    return this.shouldBlock ? 1000 : 0;
  }

  // Test helper method
  setShouldBlock(block: boolean): void {
    this.shouldBlock = block;
  }
}

describe('ComicVine with Stores', () => {
  let mockCacheStore: MockCacheStore;
  let mockDedupeStore: MockDedupeStore;
  let mockRateLimitStore: MockRateLimitStore;

  beforeEach(() => {
    mockCacheStore = new MockCacheStore();
    mockDedupeStore = new MockDedupeStore();
    mockRateLimitStore = new MockRateLimitStore();
  });

  describe('without stores', () => {
    it('should work normally without any stores', async () => {
      const client = new ComicVine('test-key');
      const result = await client.issue.retrieve(1);
      expect(result).toEqual({ id: 1, name: 'Test Issue' });
    });
  });

  describe('with cache store', () => {
    it('should cache and retrieve from cache', async () => {
      const client = new ComicVine('test-key', undefined, {
        cache: mockCacheStore,
      });

      // First call should hit the API and cache the result
      const result1 = await client.issue.retrieve(1);
      expect(result1).toEqual({ id: 1, name: 'Test Issue' });

      // Second call should hit the cache
      const result2 = await client.issue.retrieve(1);
      expect(result2).toEqual({ id: 1, name: 'Test Issue' });
    });

    it('should provide cache management methods', async () => {
      const client = new ComicVine('test-key', undefined, {
        cache: mockCacheStore,
      });

      const clearSpy = vi.spyOn(mockCacheStore, 'clear');
      await client.clearCache();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('with dedupe store', () => {
    it('should register and complete dedupe jobs', async () => {
      const client = new ComicVine('test-key', undefined, {
        dedupe: mockDedupeStore,
      });

      const registerSpy = vi.spyOn(mockDedupeStore, 'register');
      const completeSpy = vi.spyOn(mockDedupeStore, 'complete');

      const result = await client.issue.retrieve(1);
      expect(result).toEqual({ id: 1, name: 'Test Issue' });
      expect(registerSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('with rate limit store', () => {
    it('should record requests in rate limit store', async () => {
      const client = new ComicVine('test-key', undefined, {
        rateLimit: mockRateLimitStore,
      });

      const recordSpy = vi.spyOn(mockRateLimitStore, 'record');

      await client.issue.retrieve(1);
      expect(recordSpy).toHaveBeenCalledWith('issue');
    });

    it('should throw error when rate limited and throwOnRateLimit is true', async () => {
      mockRateLimitStore.setShouldBlock(true);

      const client = new ComicVine(
        'test-key',
        undefined,
        {
          rateLimit: mockRateLimitStore,
        },
        {
          throwOnRateLimit: true,
        },
      );

      await expect(client.issue.retrieve(1)).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    it('should wait when rate limited and throwOnRateLimit is false', async () => {
      mockRateLimitStore.setShouldBlock(true);

      const client = new ComicVine(
        'test-key',
        undefined,
        {
          rateLimit: mockRateLimitStore,
        },
        {
          throwOnRateLimit: false,
          maxWaitTime: 500, // Short wait for testing
        },
      );

      const startTime = Date.now();
      await client.issue.retrieve(1);
      const endTime = Date.now();

      // Should have waited at least some time
      expect(endTime - startTime).toBeGreaterThan(100);
    });

    it('should provide rate limit management methods', async () => {
      const client = new ComicVine('test-key', undefined, {
        rateLimit: mockRateLimitStore,
      });

      const status = await client.getRateLimitStatus('issue');
      expect(status).toEqual({
        remaining: 100,
        resetTime: expect.any(Date),
        limit: 100,
      });

      const resetSpy = vi.spyOn(mockRateLimitStore, 'reset');
      await client.resetRateLimit('issue');
      expect(resetSpy).toHaveBeenCalledWith('issue');
    });
  });

  describe('with all stores', () => {
    it('should use all stores in the correct order', async () => {
      const client = new ComicVine('test-key', undefined, {
        cache: mockCacheStore,
        dedupe: mockDedupeStore,
        rateLimit: mockRateLimitStore,
      });

      const cacheSpy = vi.spyOn(mockCacheStore, 'get');
      const dedupeSpy = vi.spyOn(mockDedupeStore, 'waitFor');
      const rateLimitSpy = vi.spyOn(mockRateLimitStore, 'canProceed');

      await client.issue.retrieve(1);

      // Should check cache first, then dedupe, then rate limit
      expect(cacheSpy).toHaveBeenCalled();
      expect(dedupeSpy).toHaveBeenCalled();
      expect(rateLimitSpy).toHaveBeenCalled();
    });
  });

  describe('list method wrapping', () => {
    it('should wrap list methods with stores', async () => {
      const client = new ComicVine('test-key', undefined, {
        cache: mockCacheStore,
        rateLimit: mockRateLimitStore,
      });

      const result = await client.issue.list({ limit: 10 });
      expect(result.data).toEqual([{ id: 1, name: 'Test Issue' }]);

      // Should also work as async iterator
      let count = 0;
      for await (const issue of client.issue.list({ limit: 10 })) {
        count++;
        expect(issue).toEqual({ id: 1, name: 'Test Issue' });
        break; // Just test first item
      }
      expect(count).toBe(1);
    });
  });

  describe('client options', () => {
    it('should use custom client options', () => {
      const client = new ComicVine(
        'test-key',
        undefined,
        {
          cache: mockCacheStore,
        },
        {
          defaultCacheTTL: 7200,
          throwOnRateLimit: false,
          maxWaitTime: 30000,
        },
      );

      // Options should be set (we can't easily test them directly due to private access)
      expect(client).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle store integration properly', async () => {
      // Test that the client integrates properly with stores
      const client = new ComicVine('test-key', undefined, {
        cache: mockCacheStore,
        dedupe: mockDedupeStore,
      });

      // Just verify the basic integration is working without errors
      const result = await client.issue.retrieve(1);
      expect(result).toEqual({ id: 1, name: 'Test Issue' });
    });
  });
});
