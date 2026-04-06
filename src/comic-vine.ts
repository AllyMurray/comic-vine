import {
  HttpClient,
  type CacheStore,
  type DedupeStore,
  type RateLimitStore,
} from '@http-client-toolkit/core';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from './http-client/hooks.js';
import { UrlBuilder } from './http-client/url-builder.js';
import { loadOptions } from './options/index.js';
import type { ResourceInterface } from './resources/base-resource.js';
import { ResourceFactory } from './resources/index.js';
import * as resources from './resources/resource-list.js';
import { getResource } from './resources/resource-map.js';
import { ResourceType } from './resources/resource-type.js';
import { toSnakeCase } from './utils/index.js';

function classNameToPropertyName(className: string): string {
  if (!className) {
    return '';
  }
  return className.charAt(0).toLowerCase() + className.slice(1);
}

type ResourceInstance = ReturnType<ResourceFactory['create']> &
  ResourceInterface;

// Create resource property type mapping dynamically
type ResourcePropertyMap = {
  [K in keyof typeof resources as Uncapitalize<K>]: InstanceType<
    (typeof resources)[K]
  >;
};

const resourceMappings = Object.values(ResourceType)
  .filter((value): value is ResourceType => typeof value === 'number')
  .map((resourceType) => getResource(resourceType));

const canonicalRateLimitResourceNames = new Map<string, string>();
for (const { detailName, listName } of resourceMappings) {
  canonicalRateLimitResourceNames.set(detailName, listName);
  canonicalRateLimitResourceNames.set(listName, listName);
  canonicalRateLimitResourceNames.set(toSnakeCase(detailName), listName);
  canonicalRateLimitResourceNames.set(toSnakeCase(listName), listName);
}

function normalizeRateLimitResourceName(resourceName: string): string {
  return (
    canonicalRateLimitResourceNames.get(toSnakeCase(resourceName)) ??
    resourceName
  );
}

function inferComicVineRateLimitResource(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const apiIndex = segments.indexOf('api');
    const endpoint = apiIndex >= 0 ? segments[apiIndex + 1] : segments[0];

    if (!endpoint) {
      return 'unknown';
    }

    return normalizeRateLimitResourceName(endpoint);
  } catch {
    return 'unknown';
  }
}

/**
 * Consolidated options interface for ComicVine client
 */
export interface ComicVineOptions {
  /** Comic Vine API key */
  apiKey: string;

  /** Base URL for the Comic Vine API */
  baseUrl?: string;

  /** Store implementations for caching, deduplication, and rate limiting */
  stores?: {
    cache?: CacheStore;
    dedupe?: DedupeStore;
    rateLimit?: RateLimitStore;
  };

  /** HTTP client configuration */
  client?: {
    /** Default cache TTL in seconds */
    defaultCacheTTL?: number;
    /** Whether to throw errors on rate limit violations */
    throwOnRateLimit?: boolean;
    /** Maximum time to wait for rate limit in milliseconds */
    maxWaitTime?: number;
  };
}

export class ComicVine implements ResourcePropertyMap {
  private resourceFactory: ResourceFactory;
  private resourceCache = new Map<string, ResourceInstance>();
  private resourceNames: Array<string>;
  private stores: {
    cache?: CacheStore;
    dedupe?: DedupeStore;
    rateLimit?: RateLimitStore;
  };

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

  /**
   * Create a new ComicVine client
   * @param options - Configuration options for the client
   */
  constructor(options: ComicVineOptions) {
    const { apiKey, baseUrl, stores = {}, client = {} } = options;

    const _options = loadOptions({ baseUrl });

    const httpClient = new HttpClient({
      name: 'comic-vine-sdk',
      cache: stores.cache
        ? {
            store: stores.cache,
            ttl: client.defaultCacheTTL,
          }
        : undefined,
      dedupe: stores.dedupe,
      rateLimit: stores.rateLimit
        ? {
            store: stores.rateLimit,
            throw: client.throwOnRateLimit,
            maxWaitTime: client.maxWaitTime,
          }
        : undefined,
      responseTransformer: comicVineResponseTransformer,
      responseHandler: comicVineResponseHandler,
      errorHandler: comicVineErrorHandler,
      resourceKeyResolver: inferComicVineRateLimitResource,
    });
    const urlBuilder = new UrlBuilder(apiKey, _options.baseUrl);

    this.resourceFactory = new ResourceFactory(httpClient, urlBuilder);
    this.stores = stores;

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

        this.resourceCache.set(propertyName, resource);
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

  async clearCache(): Promise<void> {
    if (this.stores.cache) {
      await this.stores.cache.clear();
    }
  }

  async getRateLimitStatus(resourceName: string) {
    if (this.stores.rateLimit) {
      return this.stores.rateLimit.getStatus(
        normalizeRateLimitResourceName(resourceName),
      );
    }
    return null;
  }

  async resetRateLimit(resourceName: string): Promise<void> {
    if (this.stores.rateLimit) {
      await this.stores.rateLimit.reset(
        normalizeRateLimitResourceName(resourceName),
      );
    }
  }
}
