import { ResourceType } from '..';
import { PowerDetails, PowerListItem } from './types';
import { BaseResource } from '../base-resource';

export class Power extends BaseResource<PowerDetails, PowerListItem> {
  protected resourceType: ResourceType = ResourceType.Power;
}
