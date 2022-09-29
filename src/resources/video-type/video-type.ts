import { ResourceType } from '..';
import { VideoTypeDetails, VideoTypeListItem } from './types';
import { BaseResource } from '../base-resource';

export class VideoType extends BaseResource<VideoTypeDetails, VideoTypeListItem> {
  protected resourceType: ResourceType = ResourceType.VideoType;
}
