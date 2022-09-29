import { RetrieveOptions, ListOptions } from '.';
import { ResourceType } from '../resources';

export interface UrlBuilder {
  retrieve<Key>(
    resourceType: ResourceType,
    id: number,
    requestOptions?: RetrieveOptions<Key> | undefined
  ): string;

  list<Resource, FilterType>(
    resourceType: ResourceType,
    requestOptions?: ListOptions<Resource, FilterType> | undefined
  ): string;
}
