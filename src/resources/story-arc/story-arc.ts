import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { StoryArcDetails, StoryArcListItem } from './types/index.js';

export class StoryArc extends BaseResource<StoryArcDetails, StoryArcListItem> {
  protected resourceType: ResourceType = ResourceType.StoryArc;
}
