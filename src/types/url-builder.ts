import { RetrieveOptions, ListOptions } from './index.js';
import { ResourceType } from '../resources/resource-type.js';

export interface UrlBuilder {
  retrieve<Key>(
    resourceType: ResourceType,
    id: number,
    requestOptions?: RetrieveOptions<Key>,
  ): string;

  list<Resource, FilterType>(
    resourceType: ResourceType,
    requestOptions?: ListOptions<Resource, FilterType>,
  ): string;
}
