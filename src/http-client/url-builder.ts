import { getResource, ResourceType } from '../resources';
import { RetrieveOptions, ListOptions, Sort } from '../types';
import { toSnakeCase, convertCamelCaseToSnakeCase } from '../utils';

const isDefined = <T>(value: T): value is NonNullable<T> => {
  return value != null;
};

interface QueryParam {
  name: string;
  value: string | number;
}

export class UrlBuilder {
  private baseUrl = 'https://comicvine.gamespot.com/api/';

  constructor(private apiKey: string) {}

  private getParam(key: string, value: string | number | undefined) {
    if (value) {
      return { name: toSnakeCase(key), value };
    }
  }

  private getFormatParm() {
    return { name: 'format', value: `json` };
  }

  private getApiKeyParm() {
    return { name: 'api_key', value: this.apiKey };
  }

  private getSortParam(sort?: Sort) {
    if (sort) {
      return { name: 'sort', value: `${sort.field}:${sort.direction}` };
    }
  }

  private getLimitParam(limit?: number) {
    if (limit) {
      return this.getParam('limit', limit);
    }
  }

  private getOffsetParam(offset?: number) {
    if (offset) {
      return this.getParam('offset', offset);
    }
  }

  private getFieldListParams<Key>(fieldList: Key[] | undefined) {
    if (fieldList) {
      return {
        name: 'field_list',
        value: fieldList
          .map((field) => toSnakeCase(field as unknown as string))
          .join(','),
      };
    }
  }

  private getFilterParams<FilterType>(filter: FilterType | undefined) {
    if (filter) {
      const snakeCaseFilter = convertCamelCaseToSnakeCase<any>(filter);
      const filterParams = Object.entries<any>(snakeCaseFilter).map(
        ([key, value]) => `${key}:${encodeURIComponent(value)}`
      );

      return { name: 'filter', value: filterParams.join(',') };
    }
  }

  private buildUrl(
    urlInput: string,
    queryParams: Array<QueryParam | undefined>
  ) {
    const url = new URL(urlInput, this.baseUrl);
    const urlSearchParams = new URLSearchParams(
      queryParams
        .filter(isDefined)
        .map<[string, string]>((param) => [param.name, param.value.toString()])
    );

    url.search = urlSearchParams.toString();

    return url.toString();
  }

  /**
   * @param resourceType A unique identifier for the resource type
   * @param id A unique identifier for the resource
   * @returns A url for requesting the resource
   * @example https://comicvine.gamespot.com/api/issue/4000-719442?format=json&api_key=123abc
   */
  retrieve<Key>(
    resourceType: ResourceType,
    id: number,
    options?: RetrieveOptions<Key>
  ) {
    const resource = getResource(resourceType);
    const urlInput = `${resource.detailName}/${resourceType}-${id}`;
    const queryParams = [
      this.getFormatParm(),
      this.getApiKeyParm(),
      this.getFieldListParams(options?.fieldList),
    ];
    return this.buildUrl(urlInput, queryParams);
  }

  /**
   * @param resourceType A unique identifier for the resource type
   * @returns A url for requesting a list of resources
   * @example https://comicvine.gamespot.com/api/issues?format=json&api_key=123abc
   */
  list<Resource, FilterType>(
    resourceType: ResourceType,
    options?: ListOptions<Resource, FilterType>
  ) {
    const urlInput = getResource(resourceType).listName;
    const queryParams = [
      this.getFormatParm(),
      this.getApiKeyParm(),
      this.getLimitParam(options?.limit),
      this.getOffsetParam(options?.offset),
      this.getSortParam(options?.sort),
      this.getFieldListParams(options?.fieldList),
      this.getFilterParams(options?.filter),
    ];
    return this.buildUrl(urlInput, queryParams);
  }
}
