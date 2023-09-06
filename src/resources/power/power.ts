import { PowerDetails, PowerListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Power extends BaseResource<PowerDetails, PowerListItem> {
  protected resourceType: ResourceType = ResourceType.Power;
}
