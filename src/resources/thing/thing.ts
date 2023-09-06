import { ThingDetails, ThingListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Thing extends BaseResource<ThingDetails, ThingListItem> {
  protected resourceType: ResourceType = ResourceType.Thing;
}
