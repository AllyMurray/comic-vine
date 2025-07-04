import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { SeriesDetails, SeriesListItem } from './types/index.js';

export class Series extends BaseResource<SeriesDetails, SeriesListItem> {
  protected resourceType: ResourceType = ResourceType.Series;
}
