import { OriginDetails, OriginListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Origin extends BaseResource<OriginDetails, OriginListItem> {
  protected resourceType: ResourceType = ResourceType.Origin;
}
