import { PromoDetails, PromoListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Promo extends BaseResource<PromoDetails, PromoListItem> {
  protected resourceType: ResourceType = ResourceType.Promo;
}
