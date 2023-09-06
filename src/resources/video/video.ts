import { VideoDetails, VideoListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Video extends BaseResource<VideoDetails, VideoListItem> {
  protected resourceType: ResourceType = ResourceType.Video;
}
