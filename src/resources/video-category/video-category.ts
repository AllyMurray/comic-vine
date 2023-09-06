import { VideoCategoryDetails, VideoCategoryListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class VideoCategory extends BaseResource<VideoCategoryDetails, VideoCategoryListItem> {
  protected resourceType: ResourceType = ResourceType.VideoCategory;
}
