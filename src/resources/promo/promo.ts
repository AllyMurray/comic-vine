import { PromoDetails, PromoListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Promo extends BaseResource<PromoDetails, PromoListItem> {
  protected resourceType: ResourceType = ResourceType.Promo;
}
