import { ResourceType } from '..';
import { OriginDetails, OriginListItem } from './types';
import { BaseResource } from '../base-resource';

export class Origin extends BaseResource<OriginDetails, OriginListItem> {
  protected resourceType: ResourceType = ResourceType.Origin;
}
