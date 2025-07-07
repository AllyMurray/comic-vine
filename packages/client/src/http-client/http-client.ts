import axios, { AxiosError, AxiosResponse } from 'axios';
import { StatusCode } from './status-code.js';
import { BaseError } from '../errors/base-error.js';
import {
  ComicVineFilterError,
  ComicJsonpCallbackMissingError,
  ComicVineObjectNotFoundError,
  ComicVineUnauthorizedError,
  ComicVineUrlFormatError,
  ComicVineSubscriberOnlyError,
  ComicVineGenericRequestError,
} from '../errors/index.js';
import {
  CacheStore,
  DedupeStore,
  RateLimitStore,
  hashRequest,
} from '../stores/index.js';
import { Response, HttpClient as HttpClientContract } from '../types/index.js';
import { convertSnakeCaseToCamelCase } from '../utils/case-converter.js';

export interface HttpClientStores {
  cache?: CacheStore;
  dedupe?: DedupeStore;
  rateLimit?: RateLimitStore;
}

export interface HttpClientOptions {
  /**
   * Default cache TTL in seconds
   */
  defaultCacheTTL?: number;
  /**
   * Whether to throw errors on rate limit violations
   */
  throwOnRateLimit?: boolean;
  /**
   * Maximum time to wait for rate limit in milliseconds
   */
  maxWaitTime?: number;
}

export class HttpClient implements HttpClientContract {
  private _http;
  private stores: HttpClientStores;
  private options: Required<HttpClientOptions>;

  constructor(stores: HttpClientStores = {}, options: HttpClientOptions = {}) {
    this._http = axios.create();
    this.stores = stores;
    this.options = {
      defaultCacheTTL: options.defaultCacheTTL ?? 3600, // 1 hour
      throwOnRateLimit: options.throwOnRateLimit ?? true,
      maxWaitTime: options.maxWaitTime ?? 60000, // 1 minute
    };
  }

  /**
   * Infer the resource name from the endpoint URL
   * @param url The full URL or endpoint path
   * @returns The resource name for rate limiting
   */
  private inferResource(url: string): string {
    // Extract the resource type from the URL
    // URLs are typically like: https://comicvine.gamespot.com/api/issues/4000-123456/
    // or for list: https://comicvine.gamespot.com/api/issues/
    const match = url.match(/\/api\/([^/]+)\//);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract endpoint and params from URL for request hashing
   * @param url The full URL
   * @returns Object with endpoint and params for hashing
   */
  private parseUrlForHashing(url: string): {
    endpoint: string;
    params: Record<string, unknown>;
  } {
    const urlObj = new URL(url);
    const endpoint = urlObj.pathname.replace('/api/', '');
    const params: Record<string, unknown> = {};

    // Convert URLSearchParams to a plain object
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return { endpoint, params };
  }

  private handleResponse<Result>(response: AxiosResponse<Response<Result>>) {
    switch (response.data.statusCode) {
      case StatusCode.FilterError:
        throw new ComicVineFilterError();
      case StatusCode.JsonpCallbackMissing:
        throw new ComicJsonpCallbackMissingError();
      case StatusCode.ObjectNotFound:
        throw new ComicVineObjectNotFoundError();
      case StatusCode.SubscriberOnlyVideo:
        throw new ComicVineSubscriberOnlyError();
      case StatusCode.UrlFormatError:
        throw new ComicVineUrlFormatError();
      default:
        return response.data;
    }
  }

  private generateClientError(err: unknown) {
    if (err instanceof BaseError) {
      return err;
    }

    const error = err as AxiosError<{ message?: string }>;
    if (error.response?.status === 401) {
      return new ComicVineUnauthorizedError();
    }

    const errorMessage = error.response?.data?.message;
    return new ComicVineGenericRequestError(
      `${error.message}${errorMessage ? `, ${errorMessage}` : ''}`,
    );
  }

  async get<Result>(url: string): Promise<Response<Result>> {
    const { endpoint, params } = this.parseUrlForHashing(url);
    const hash = hashRequest(endpoint, params);
    const resource = this.inferResource(url);

    try {
      // 1. Cache - check for cached response
      if (this.stores.cache) {
        const cachedResult = await this.stores.cache.get(hash);
        if (cachedResult !== undefined) {
          return cachedResult as Response<Result>;
        }
      }

      // 2. Deduplication - check for in-progress request
      if (this.stores.dedupe) {
        const existingResult = await this.stores.dedupe.waitFor(hash);
        if (existingResult !== undefined) {
          return existingResult as Response<Result>;
        }

        // Register this request as in-progress
        await this.stores.dedupe.register(hash);
      }

      // 3. Rate limiting - check if request can proceed
      if (this.stores.rateLimit) {
        const canProceed = await this.stores.rateLimit.canProceed(resource);
        if (!canProceed) {
          if (this.options.throwOnRateLimit) {
            const waitTime = await this.stores.rateLimit.getWaitTime(resource);
            throw new Error(
              `Rate limit exceeded for resource '${resource}'. Wait ${waitTime}ms before retrying.`,
            );
          } else {
            // Wait for rate limit to reset
            const waitTime = Math.min(
              await this.stores.rateLimit.getWaitTime(resource),
              this.options.maxWaitTime,
            );
            if (waitTime > 0) {
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
          }
        }
      }

      // 4. Execute the actual HTTP request
      const response = await this._http.get(url);
      const transformedData = response.data
        ? convertSnakeCaseToCamelCase<Response<Result>>(response.data)
        : undefined;

      const result = this.handleResponse({
        ...response,
        data: transformedData as Response<Result>,
      });

      // 5. Record the request for rate limiting
      if (this.stores.rateLimit) {
        await this.stores.rateLimit.record(resource);
      }

      // 6. Cache the result
      if (this.stores.cache) {
        await this.stores.cache.set(hash, result, this.options.defaultCacheTTL);
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

      throw this.generateClientError(error);
    }
  }
}
