import { ThingDetails, ThingListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Thing extends BaseResource<ThingDetails, ThingListItem> {
  protected resourceType: ResourceType = ResourceType.Thing;
}
