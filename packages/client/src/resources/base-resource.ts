import { ResourceType } from './resource-type.js';
import type {
  RetrieveOptions,
  ListOptions,
  HttpClient,
  UrlBuilder,
  PickFilters,
} from '../types/index.js';

// Common interface that all resources must implement
export interface ResourceInterface {
  retrieve(id: number, options?: Record<string, unknown>): Promise<unknown>;
  list(
    options?: Record<string, unknown>,
  ): Promise<unknown> & AsyncIterable<unknown>;
}

export abstract class BaseResource<Resource, ResourceListItem>
  implements ResourceInterface
{
  protected abstract resourceType: ResourceType;

  constructor(
    private httpClient: HttpClient,
    private urlBuilder: UrlBuilder,
  ) {}

  async retrieve<FieldKey extends keyof Resource>(
    id: number,
    options?: RetrieveOptions<FieldKey>,
  ) {
    type ReturnType<T> = T extends object ? Pick<Resource, FieldKey> : Resource;

    const url = this.urlBuilder.retrieve(this.resourceType, id, options);
    const _fieldList = options?.fieldList;
    type ResponseType = ReturnType<typeof _fieldList>;
    const response = await this.httpClient.get<ResponseType>(url);

    return response.results;
  }

  private async fetchPage<FieldKey extends keyof ResourceListItem>(
    options?: ListOptions<FieldKey, PickFilters<ResourceListItem>>,
  ) {
    type ReturnType<T> = T extends object
      ? Pick<ResourceListItem, FieldKey>
      : ResourceListItem;

    const url = this.urlBuilder.list(this.resourceType, options);
    const _fieldList = options?.fieldList;
    type ResponseType = ReturnType<typeof _fieldList>;
    const response = await this.httpClient.get<Array<ResponseType>>(url);

    return {
      limit: response.limit,
      numberOfPageResults: response.numberOfPageResults,
      numberOfTotalResults: response.numberOfTotalResults,
      offset: response.offset,
      data: response.results,
    };
  }

  list<FieldKey extends keyof ResourceListItem>(
    options?: ListOptions<FieldKey, PickFilters<ResourceListItem>>,
  ) {
    // Proxy the call to this.fetchPage so that we can close over `this`, allowing access in the iterator
    const fetchPage = (opts?: Parameters<typeof this.fetchPage>[0]) =>
      this.fetchPage.call(this, opts);
    const fetchPagePromise = fetchPage(options);

    const asyncIterator = {
      async *[Symbol.asyncIterator]() {
        const defaultPageSize = 100;
        const limit = options?.limit ?? defaultPageSize;
        let page = options?.offset ? options.offset / limit + 1 : 1;
        let hasMoreResults = true;
        let response = await fetchPagePromise;

        do {
          for (const resource of response.data) {
            yield resource;
          }

          hasMoreResults =
            response.limit + response.offset < response.numberOfTotalResults;

          if (hasMoreResults) {
            response = await fetchPage({
              limit,
              offset: response.numberOfPageResults * page++,
            });
          }
        } while (hasMoreResults);
      },
    };

    const promiseWithAsyncIterator = Object.assign(
      fetchPagePromise,
      asyncIterator,
    );

    return promiseWithAsyncIterator;
  }
}
