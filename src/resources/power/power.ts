import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { PowerDetails, PowerListItem } from './types/index.js';

export class Power extends BaseResource<PowerDetails, PowerListItem> {
  protected resourceType: ResourceType = ResourceType.Power;
}
