import { PowerDetails, PowerListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Power extends BaseResource<PowerDetails, PowerListItem> {
  protected resourceType: ResourceType = ResourceType.Power;
}
