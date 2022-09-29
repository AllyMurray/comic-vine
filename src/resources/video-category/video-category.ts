import { ResourceType } from '..';
import { VideoCategoryDetails, VideoCategoryListItem } from './types';
import { BaseResource } from '../base-resource';

export class VideoCategory extends BaseResource<VideoCategoryDetails, VideoCategoryListItem> {
  protected resourceType: ResourceType = ResourceType.VideoCategory;
}
