import { Image, IssueApiResource, SiteResource } from '../../common-types.js';

export interface ConceptDetails {
  /**
   * List of aliases the concept is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the concept detail resource.
   */
  apiDetailUrl: string;
  countOfIsssueAppearances: number;
  /**
   * Date the concept was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the concept was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the concept.
   */
  deck: string;
  /**
   * Description of the concept.
   */
  description: string;
  /**
   * Issue where the concept made its first appearance.
   */
  firstAppearedInIssue: IssueApiResource;
  /**
   * Unique ID of the concept.
   */
  id: number;
  /**
   * Main image of the concept.
   */
  image: Image;
  /**
   * List of issues this concept appears in.
   */
  issueCredits: Array<SiteResource>;
  /**
   * Movies the concept was in.
   */
  movies: Array<SiteResource>;
  /**
   * Name of the concept.
   */
  name: string;
  /**
   * URL pointing to the concept on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * The first year this concept appeared in comics.
   */
  startYear: string;
  /**
   * List of comic volumes this concept appears in.
   */
  volumeCredits: Array<SiteResource>;
}
