import { Image } from '../../common-types';

export interface PromoListItem {
  /**
   * URL pointing to the promo detail resource.
   */
  apiDetailUrl: string;
  /**
   * Date the promo was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Brief summary of the promo.
   */
  deck: string;
  guid: string;
  /**
   * Unique ID of the promo.
   */
  id: number;
  /**
   * Main image of the promo.
   */
  image: Image;
  /**
   * The link that promo points to.
   */
  link: string;
  /**
   * Name of the promo.
   */
  name: string;
  /**
   * The type of resource the promo is pointing towards.
   */
  resourceType: string;
  /**
   * Author of the promo.
   */
  user: string;
}
