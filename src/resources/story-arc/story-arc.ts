import { StoryArcDetails, StoryArcListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class StoryArc extends BaseResource<StoryArcDetails, StoryArcListItem> {
  protected resourceType: ResourceType = ResourceType.StoryArc;
}
