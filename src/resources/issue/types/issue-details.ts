import {
  SiteResource,
  PersonCreditSiteResource,
  AssociatedImage,
  Image,
} from '../../common-types';

export interface IssueDetails {
  /**
   * List of aliases the issue is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the issue detail resource.
   */
  apiDetailUrl: string;
  associatedImages: Array<AssociatedImage>;
  characterCredits: Array<SiteResource>;
  characterDiedIn: Array<SiteResource>;
  conceptCredits: Array<SiteResource>;
  /**
   * The publish date printed on the cover of an issue.
   */
  coverDate: Date;
  /**
   * Date the issue was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the issue was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the issue.
   */
  deck: null | string;
  /**
   * Description of the issue.
   */
  description: null | string;
  /**
   * A list of characters in which this issue is the first appearance of the character.
   */
  firstAppearanceCharacters: null | unknown;
  /**
   * A list of concepts in which this issue is the first appearance of the concept.
   */
  firstAppearanceConcepts: null | unknown;
  /**
   * A list of locations in which this issue is the first appearance of the location.
   */
  firstAppearanceLocations: null | unknown;
  /**
   * A list of things in which this issue is the first appearance of the object.
   */
  firstAppearanceObjects: null | unknown;
  /**
   * A list of storyarcs in which this issue is the first appearance of the story arc.
   */
  firstAppearanceStoryarcs: null | unknown;
  /**
   * A list of teams in which this issue is the first appearance of the team.
   */
  firstAppearanceTeams: null | unknown;
  hasStaffReview: null | false | SiteResource;
  /**
   * Unique ID of the issue.
   */
  id: number;
  /**
   * Main image of the issue.
   */
  image: Image;
  /**
   * The number assigned to the issue within the volume set.
   */
  issueNumber: string;
  locationCredits: Array<SiteResource>;
  /**
   * Name of the issue.
   */
  name: null | string;
  objectCredits: Array<SiteResource>;
  personCredits: Array<PersonCreditSiteResource>;
  /**
   * URL pointing to the issue on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * The date the issue was first sold in stores.
   */
  storeDate: Date | null;
  storyArcCredits: Array<SiteResource>;
  teamCredits: Array<SiteResource>;
  teamDisbandedIn: Array<SiteResource>;
  /**
   * The volume this issue is a part of.
   */
  volume: SiteResource;
}
