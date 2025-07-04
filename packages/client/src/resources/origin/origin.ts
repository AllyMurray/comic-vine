import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { OriginDetails, OriginListItem } from './types/index.js';

export class Origin extends BaseResource<OriginDetails, OriginListItem> {
  protected resourceType: ResourceType = ResourceType.Origin;
}
