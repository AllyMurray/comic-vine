import { SeriesDetails, SeriesListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Series extends BaseResource<SeriesDetails, SeriesListItem> {
  protected resourceType: ResourceType = ResourceType.Series;
}
