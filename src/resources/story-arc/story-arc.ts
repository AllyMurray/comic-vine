import { ResourceType } from '..';
import { StoryArcDetails, StoryArcListItem } from './types';
import { BaseResource } from '../base-resource';

export class StoryArc extends BaseResource<StoryArcDetails, StoryArcListItem> {
  protected resourceType: ResourceType = ResourceType.StoryArc;
}
