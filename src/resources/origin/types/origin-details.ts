import { ApiResource } from '../../common-types';

export interface OriginDetails {
  /**
   * URL pointing to the origin detail resource.
   */
  apiDetailUrl: string;
  characters: Array<ApiResource>;
  characterSet: null;
  /**
   * Unique ID of the origin.
   */
  id: number;
  /**
   * Name of the origin.
   */
  name: string;
  profiles: any[];
  /**
   * URL pointing to the origin on Giant Bomb.
   */
  siteDetailUrl: string;
}
