import { ResourceType } from '..';
import { PromoDetails, PromoListItem } from './types';
import { BaseResource } from '../base-resource';

export class Promo extends BaseResource<PromoDetails, PromoListItem> {
  protected resourceType: ResourceType = ResourceType.Promo;
}
