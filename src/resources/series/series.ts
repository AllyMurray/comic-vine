import { SeriesDetails, SeriesListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Series extends BaseResource<SeriesDetails, SeriesListItem> {
  protected resourceType: ResourceType = ResourceType.Series;
}
