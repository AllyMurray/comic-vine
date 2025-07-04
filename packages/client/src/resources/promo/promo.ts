import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { PromoDetails, PromoListItem } from './types/index.js';

export class Promo extends BaseResource<PromoDetails, PromoListItem> {
  protected resourceType: ResourceType = ResourceType.Promo;
}
