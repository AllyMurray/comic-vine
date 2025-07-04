import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { VolumeDetails, VolumeListItem } from './types/index.js';

export class Volume extends BaseResource<VolumeDetails, VolumeListItem> {
  protected resourceType: ResourceType = ResourceType.Volume;
}
