import { ResourceType } from '..';
import { SeriesDetails, SeriesListItem } from './types';
import { BaseResource } from '../base-resource';

export class Series extends BaseResource<SeriesDetails, SeriesListItem> {
  protected resourceType: ResourceType = ResourceType.Series;
}
