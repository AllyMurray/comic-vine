import { ResourceType } from '..';
import { LocationDetails, LocationListItem } from './types';
import { BaseResource } from '../base-resource';

export class Location extends BaseResource<LocationDetails, LocationListItem> {
  protected resourceType: ResourceType = ResourceType.Location;
}
