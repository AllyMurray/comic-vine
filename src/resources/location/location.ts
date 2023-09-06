import { LocationDetails, LocationListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Location extends BaseResource<LocationDetails, LocationListItem> {
  protected resourceType: ResourceType = ResourceType.Location;
}
