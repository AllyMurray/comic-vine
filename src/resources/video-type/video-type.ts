import { VideoTypeDetails, VideoTypeListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class VideoType extends BaseResource<VideoTypeDetails, VideoTypeListItem> {
  protected resourceType: ResourceType = ResourceType.VideoType;
}
