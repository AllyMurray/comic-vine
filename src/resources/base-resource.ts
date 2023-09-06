import { ResourceType } from './resource-type.js';
import type {
  RetrieveOptions,
  ListOptions,
  HttpClient,
  UrlBuilder,
  PickFilters,
} from '../types/index.js';

export abstract class BaseResource<Resource, ResourceListItem> {
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
    const fieldList = options?.fieldList;
    const response =
      await this.httpClient.get<ReturnType<typeof fieldList>>(url);

    return response.results;
  }

  private async fetchPage<FieldKey extends keyof ResourceListItem>(
    options?: ListOptions<FieldKey, PickFilters<ResourceListItem>>,
  ) {
    type ReturnType<T> = T extends object
      ? Pick<ResourceListItem, FieldKey>
      : ResourceListItem;

    const url = this.urlBuilder.list(this.resourceType, options);
    const fieldList = options?.fieldList;
    const response =
      await this.httpClient.get<ReturnType<typeof fieldList>[]>(url);

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
    const fetchPage = (options?: Parameters<typeof this.fetchPage>[0]) =>
      this.fetchPage.call(this, options);
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
