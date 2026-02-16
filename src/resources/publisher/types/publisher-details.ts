import { SiteResource, Image } from '../../common-types.js';

export interface PublisherDetails {
  /**
   * List of aliases the publisher is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the publisher detail resource.
   */
  apiDetailUrl: string;
  /**
   * Characters related to the publisher.
   */
  characters: Array<SiteResource>;
  /**
   * Date the publisher was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the publisher was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the publisher.
   */
  deck: null | string;
  /**
   * Description of the publisher.
   */
  description: null | string;
  /**
   * Unique ID of the publisher.
   */
  id: number;
  /**
   * Main image of the publisher.
   */
  image: Image;
  /**
   * Street address of the publisher.
   */
  locationAddress: null | string;
  /**
   * City the publisher resides in.
   */
  locationCity: null | string;
  /**
   * State the publisher resides in.
   */
  locationState: null | string;
  /**
   * Name of the publisher.
   */
  name: string;
  /**
   * URL pointing to the publisher on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * List of story arcs tied to this publisher.
   */
  storyArcs: Array<SiteResource>;
  /**
   * List of teams this publisher is a member of.
   */
  teams: Array<SiteResource>;
  /**
   * List of volumes this publisher has put out.
   */
  volumes: Array<SiteResource>;
}
