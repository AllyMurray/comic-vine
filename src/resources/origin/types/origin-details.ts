import { ApiResource } from '../../common-types.js';

export interface OriginDetails {
  /**
   * URL pointing to the origin detail resource.
   */
  apiDetailUrl: string;
  characters: Array<ApiResource>;
  characterSet: null | unknown;
  /**
   * Unique ID of the origin.
   */
  id: number;
  /**
   * Name of the origin.
   */
  name: string;
  profiles: Array<unknown>;
  /**
   * URL pointing to the origin on Giant Bomb.
   */
  siteDetailUrl: string;
}
