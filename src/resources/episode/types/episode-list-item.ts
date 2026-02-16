import { SiteResource, Image } from '../../common-types.js';

export interface EpisodeListItem {
  /**
   * The air date of the episode.
   */
  airDate: Date | null;
  /**
   * List of aliases the episode is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the episode detail resource.
   */
  apiDetailUrl: string;
  /**
   * Date the episode was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the episode was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the episode.
   */
  deck: null | string;
  /**
   * Description of the episode.
   */
  description: null | string;
  episodeNumber: string;
  hasStaffReview: null | false | SiteResource;
  /**
   * Unique ID of the episode.
   */
  id: number;
  /**
   * Main image of the episode.
   */
  image: Image;
  /**
   * Name of the episode.
   */
  name: string;
  /**
   * The series the episode belongs to.
   */
  series: SiteResource;
  /**
   * URL pointing to the episode on Giant Bomb.
   */
  siteDetailUrl: string;
}
