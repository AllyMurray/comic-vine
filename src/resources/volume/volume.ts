import { ResourceType } from '..';
import { VolumeDetails, VolumeListItem } from './types';
import { BaseResource } from '../base-resource';

export class Volume extends BaseResource<VolumeDetails, VolumeListItem> {
  protected resourceType: ResourceType = ResourceType.Volume;
}
