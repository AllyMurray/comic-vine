import type {
  RetrieveOptions,
  ListOptions,
  HttpClient,
  UrlBuilder,
  PickFilters,
} from '../types';
import { ResourceType } from './resource-type';

export abstract class BaseResource<Resource, ResourceListItem> {
  protected abstract resourceType: ResourceType;

  constructor(private httpClient: HttpClient, private urlBuilder: UrlBuilder) {}

  async retrieve<FieldKey extends keyof Resource>(
    id: number,
    options?: RetrieveOptions<FieldKey>,
  ) {
    type ReturnType<T> = T extends object ? Pick<Resource, FieldKey> : Resource;

    const url = this.urlBuilder.retrieve(this.resourceType, id, options);
    const fieldList = options?.fieldList;
    const response = await this.httpClient.get<ReturnType<typeof fieldList>>(
      url,
    );

    return response.results;
  }

  async list<FieldKey extends keyof ResourceListItem>(
    options?: ListOptions<FieldKey, PickFilters<ResourceListItem>>,
  ) {
    type ReturnType<T> = T extends object
      ? Pick<ResourceListItem, FieldKey>
      : ResourceListItem;

    const url = this.urlBuilder.list(this.resourceType, options);
    const fieldList = options?.fieldList;
    const response = await this.httpClient.get<ReturnType<typeof fieldList>[]>(
      url,
    );

    return {
      limit: response.limit,
      numberOfPageResults: response.numberOfPageResults,
      numberOfTotalResults: response.numberOfTotalResults,
      offset: response.offset,
      data: response.results,
    };
  }
}
