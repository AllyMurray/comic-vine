import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { VideoTypeDetails, VideoTypeListItem } from './types/index.js';

export class VideoType extends BaseResource<
  VideoTypeDetails,
  VideoTypeListItem
> {
  protected resourceType: ResourceType = ResourceType.VideoType;
}
