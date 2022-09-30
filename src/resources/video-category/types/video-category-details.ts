import { Image } from '../../common-types';

export interface VideoCategoryDetails {
  /**
   * URL pointing to the video_category detail resource.
   */
  apiDetailUrl: string;
  /**
   * Brief summary of the video_category.
   */
  deck: null | string;
  /**
   * Unique ID of the video_category.
   */
  id: number;
  image: Image;
  /**
   * Name of the video_category.
   */
  name: string;
  /**
   * URL pointing to the video_category on Giant Bomb.
   */
  siteDetailUrl: string;
}
