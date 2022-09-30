import { IssueApiResource, SiteResource, Image } from '../../common-types';

export interface ThingDetails {
  /**
   * List of aliases the thing is known by. A \n (newline) seperates each alias.
   */
  aliases: null;
  /**
   * URL pointing to the thing detail resource.
   */
  apiDetailUrl: string;
  /**
   * Number of issues this thing appears in.
   */
  countOfIssueAppearances: number;
  /**
   * Date the thing was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the thing was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the thing.
   */
  deck: string;
  /**
   * Description of the thing.
   */
  description: null | string;
  /**
   * Issue where the thing made its first appearance.
   */
  firstAppearedInIssue: IssueApiResource;
  /**
   * Unique ID of the thing.
   */
  id: number;
  /**
   * Main image of the thing.
   */
  image: Image;
  issueCredits: Array<SiteResource>;
  /**
   * Movies the thing was in.
   */
  movies: Array<SiteResource>;
  /**
   * Name of the thing.
   */
  name: string;
  /**
   * URL pointing to the thing on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * The first year this thing appeared in comics.
   */
  startYear: null | string;
  storyArcCredits: Array<SiteResource>;
  volumeCredits: Array<SiteResource>;
}
