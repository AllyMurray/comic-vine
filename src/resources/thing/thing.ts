import { ResourceType } from '..';
import { ThingDetails, ThingListItem } from './types';
import { BaseResource } from '../base-resource';

export class Thing extends BaseResource<ThingDetails, ThingListItem> {
  protected resourceType: ResourceType = ResourceType.Thing;
}
