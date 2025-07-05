import { HttpClientFactory } from './http-client/index.js';
import { userOptions, loadOptions } from './options/index.js';
import { ResourceFactory } from './resources/index.js';
import * as resources from './resources/resource-list.js';
import {
  CacheStore,
  DedupeStore,
  RateLimitStore,
  hashRequest,
} from './stores/index.js';

function classNameToPropertyName(className: string): string {
  if (!className) {
    return '';
  }
  return className.charAt(0).toLowerCase() + className.slice(1);
}

type ResourceInstance = ReturnType<ResourceFactory['create']>;

// Create resource property type mapping dynamically
type ResourcePropertyMap = {
  [K in keyof typeof resources as Uncapitalize<K>]: InstanceType<
    (typeof resources)[K]
  >;
};

export interface StoreOptions {
  cache?: CacheStore;
  dedupe?: DedupeStore;
  rateLimit?: RateLimitStore;
}

export interface ComicVineClientOptions {
  /** Default cache TTL in seconds */
  defaultCacheTTL?: number;
  /** Whether to throw errors on rate limit violations */
  throwOnRateLimit?: boolean;
  /** Maximum time to wait for rate limit in milliseconds */
  maxWaitTime?: number;
}

export class ComicVine implements ResourcePropertyMap {
  private resourceFactory: ResourceFactory;
  private resourceCache = new Map<string, ResourceInstance>();
  private resourceNames: Array<string>;
  private stores: StoreOptions;
  private clientOptions: Required<ComicVineClientOptions>;

  // TypeScript property declarations for static typing (will be provided by Proxy)
  declare readonly character: ResourcePropertyMap['character'];
  declare readonly concept: ResourcePropertyMap['concept'];
  declare readonly episode: ResourcePropertyMap['episode'];
  declare readonly issue: ResourcePropertyMap['issue'];
  declare readonly location: ResourcePropertyMap['location'];
  declare readonly movie: ResourcePropertyMap['movie'];
  declare readonly origin: ResourcePropertyMap['origin'];
  declare readonly person: ResourcePropertyMap['person'];
  declare readonly power: ResourcePropertyMap['power'];
  declare readonly promo: ResourcePropertyMap['promo'];
  declare readonly publisher: ResourcePropertyMap['publisher'];
  declare readonly series: ResourcePropertyMap['series'];
  declare readonly storyArc: ResourcePropertyMap['storyArc'];
  declare readonly team: ResourcePropertyMap['team'];
  declare readonly thing: ResourcePropertyMap['thing'];
  declare readonly video: ResourcePropertyMap['video'];
  declare readonly videoCategory: ResourcePropertyMap['videoCategory'];
  declare readonly videoType: ResourcePropertyMap['videoType'];
  declare readonly volume: ResourcePropertyMap['volume'];

  constructor(
    key: string,
    options?: userOptions,
    stores: StoreOptions = {},
    clientOptions: ComicVineClientOptions = {},
  ) {
    const _options = loadOptions(options);
    const httpClient = HttpClientFactory.createClient();
    const urlBuilder = HttpClientFactory.createUrlBuilder(
      key,
      _options.baseUrl,
    );
    this.resourceFactory = new ResourceFactory(httpClient, urlBuilder);
    this.stores = stores;
    this.clientOptions = {
      defaultCacheTTL: clientOptions.defaultCacheTTL ?? 3600, // 1 hour
      throwOnRateLimit: clientOptions.throwOnRateLimit ?? true,
      maxWaitTime: clientOptions.maxWaitTime ?? 60000, // 1 minute
    };

    // Discover available resources dynamically
    this.resourceNames = Object.keys(resources);

    // Return a proxy that provides lazy loading with full type safety
    return new Proxy(this, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'string' && target.isResourceProperty(prop)) {
          return target.getResource(prop);
        }
        return Reflect.get(target, prop);
      },
    }) as ComicVine;
  }

  private isResourceProperty(prop: string): boolean {
    // Check if this property corresponds to a known resource
    const className = prop.charAt(0).toUpperCase() + prop.slice(1);
    return this.resourceNames.includes(className);
  }

  private getResource(propertyName: string): ResourceInstance {
    // Lazy loading: create resource only when first accessed
    if (!this.resourceCache.has(propertyName)) {
      const className =
        propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
      try {
        const resource = this.resourceFactory.create(
          className as keyof typeof resources,
        );

        // Wrap resource with stores if any are provided
        const wrappedResource = this.hasStores()
          ? this.createWrappedResource(resource, propertyName)
          : resource;

        this.resourceCache.set(propertyName, wrappedResource);
      } catch (error) {
        throw new Error(`Failed to create resource '${className}': ${error}`);
      }
    }
    return this.resourceCache.get(propertyName)!;
  }

  getAvailableResources(): Array<string> {
    return this.resourceNames.map((name) => classNameToPropertyName(name));
  }

  hasResource(resourceName: string): boolean {
    return this.isResourceProperty(resourceName);
  }

  getResourceByName(resourceName: string): ResourceInstance | undefined {
    if (!this.isResourceProperty(resourceName)) {
      return undefined;
    }
    return this.getResource(resourceName);
  }

  isResourceLoaded(resourceName: string): boolean {
    return this.resourceCache.has(resourceName);
  }

  getCacheStats(): {
    total: number;
    loaded: number;
    loadedResources: Array<string>;
  } {
    const total = this.resourceNames.length;
    const loaded = this.resourceCache.size;
    const loadedResources = Array.from(this.resourceCache.keys());
    return { total, loaded, loadedResources };
  }

  // Store management methods
  async clearCache(): Promise<void> {
    if (this.stores.cache) {
      await this.stores.cache.clear();
    }
  }

  async getRateLimitStatus(resourceName: string) {
    if (this.stores.rateLimit) {
      return this.stores.rateLimit.getStatus(resourceName);
    }
    return null;
  }

  async resetRateLimit(resourceName: string): Promise<void> {
    if (this.stores.rateLimit) {
      await this.stores.rateLimit.reset(resourceName);
    }
  }

  private hasStores(): boolean {
    return !!(this.stores.cache || this.stores.dedupe || this.stores.rateLimit);
  }

  private createWrappedResource(
    resource: ResourceInstance,
    resourceName: string,
  ) {
    // Create a proxy that wraps the resource methods
    return new Proxy(resource, {
      get: (target, prop: string | symbol) => {
        if (prop === 'retrieve') {
          return this.wrapRetrieveMethod(target, resourceName);
        }
        if (prop === 'list') {
          return this.wrapListMethod(target, resourceName);
        }
        return Reflect.get(target, prop);
      },
    });
  }

  private wrapRetrieveMethod(resource: ResourceInstance, resourceName: string) {
    return async <T>(
      id: number,
      options: Record<string, unknown> = {},
    ): Promise<T> => {
      const endpoint = `${resourceName}/retrieve`;
      const params = { id, ...options };

      return this.executeWithStores(
        endpoint,
        params,
        resourceName,
        async () => {
          // Call the original retrieve method with proper type handling
          // We need to cast to unknown to work around the union type issue
          // This is safe because we control the input parameters
          const originalRetrieve = (
            resource as unknown as {
              retrieve: (...args: Array<unknown>) => unknown;
            }
          ).retrieve;
          return originalRetrieve.call(resource, id, options) as Promise<T>;
        },
      );
    };
  }

  private wrapListMethod(resource: ResourceInstance, resourceName: string) {
    return (options: Record<string, unknown> = {}) => {
      const endpoint = `${resourceName}/list`;
      const params = options;

      // Get the original list result (which has both Promise and AsyncIterable)
      const originalResult = (
        resource as unknown as { list: (...args: Array<unknown>) => unknown }
      ).list(options);

      // For list methods, we need to handle both the Promise and AsyncIterable
      const wrappedPromise = this.executeWithStores(
        endpoint,
        params,
        resourceName,
        async () => originalResult,
      );

      // Create async iterator that delegates to the original result's iterator
      const asyncIterator = {
        async *[Symbol.asyncIterator]() {
          // First make sure the promise resolves (for caching/dedupe/rate limiting)
          await wrappedPromise;

          // Then delegate to the original result's iterator
          if (
            originalResult &&
            typeof originalResult === 'object' &&
            Symbol.asyncIterator in originalResult
          ) {
            const iterator = (originalResult as Record<symbol, unknown>)[
              Symbol.asyncIterator
            ];
            if (typeof iterator === 'function') {
              yield* iterator.call(originalResult);
            }
          }
        },
      };

      return Object.assign(wrappedPromise, asyncIterator);
    };
  }

  private async executeWithStores<T>(
    endpoint: string,
    params: Record<string, unknown>,
    resourceName: string,
    executeFn: () => Promise<T>,
  ): Promise<T> {
    const hash = hashRequest(endpoint, params);

    try {
      // 1. Check cache first
      if (this.stores.cache) {
        const cachedResult = await this.stores.cache.get(hash);
        if (cachedResult !== undefined) {
          // We know the cached result should be of type T, but stores return unknown
          // This is a safe cast because we control what goes into the cache
          return cachedResult as T;
        }
      }

      // 2. Handle deduplication
      if (this.stores.dedupe) {
        const existingResult = await this.stores.dedupe.waitFor(hash);
        if (existingResult !== undefined) {
          // Same safe cast - we control what goes into dedupe storage
          return existingResult as T;
        }

        // Register this request
        await this.stores.dedupe.register(hash);
      }

      // 3. Check rate limiting
      if (this.stores.rateLimit) {
        const canProceed = await this.stores.rateLimit.canProceed(resourceName);
        if (!canProceed) {
          if (this.clientOptions.throwOnRateLimit) {
            const waitTime =
              await this.stores.rateLimit.getWaitTime(resourceName);
            throw new Error(
              `Rate limit exceeded for resource '${resourceName}'. Wait ${waitTime}ms before retrying.`,
            );
          } else {
            // Wait for rate limit to reset
            const waitTime = Math.min(
              await this.stores.rateLimit.getWaitTime(resourceName),
              this.clientOptions.maxWaitTime,
            );
            if (waitTime > 0) {
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
          }
        }
      }

      // 4. Execute the actual API call
      const result = await executeFn();

      // 5. Record the request for rate limiting
      if (this.stores.rateLimit) {
        await this.stores.rateLimit.record(resourceName);
      }

      // 6. Cache the result
      if (this.stores.cache) {
        await this.stores.cache.set(
          hash,
          result,
          this.clientOptions.defaultCacheTTL,
        );
      }

      // 7. Mark deduplication as complete
      if (this.stores.dedupe) {
        await this.stores.dedupe.complete(hash, result);
      }

      return result;
    } catch (error) {
      // Mark deduplication as failed
      if (this.stores.dedupe) {
        await this.stores.dedupe.fail(hash, error as Error);
      }
      throw error;
    }
  }
}
