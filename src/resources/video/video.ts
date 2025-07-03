import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { VideoDetails, VideoListItem } from './types/index.js';

export class Video extends BaseResource<VideoDetails, VideoListItem> {
  protected resourceType: ResourceType = ResourceType.Video;
}
