import { ResourceType } from '..';
import { VideoDetails, VideoListItem } from './types';
import { BaseResource } from '../base-resource';

export class Video extends BaseResource<VideoDetails, VideoListItem> {
  protected resourceType: ResourceType = ResourceType.Video;
}
