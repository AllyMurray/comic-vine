import { IssueApiResource, SiteResource, Image } from '../../common-types.js';

export interface LocationDetails {
  /**
   * List of aliases the location is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the location detail resource.
   */
  apiDetailUrl: string;
  /**
   * Number of issues this location appears in.
   */
  countOfIssueAppearances: number;
  /**
   * Date the location was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the location was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the location.
   */
  deck: string;
  /**
   * Description of the location.
   */
  description: string;
  /**
   * Issue where the location made its first appearance.
   */
  firstAppearedInIssue: IssueApiResource;
  /**
   * Unique ID of the location.
   */
  id: number;
  /**
   * Main image of the location.
   */
  image: Image;
  issueCredits: Array<SiteResource>;
  /**
   * Movies the location was in.
   */
  movies: Array<SiteResource>;
  /**
   * Name of the location.
   */
  name: string;
  /**
   * URL pointing to the location on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * The first year this location appeared in comics.
   */
  startYear: string;
  storyArcCredits: Array<unknown>;
  volumeCredits: Array<SiteResource>;
}
