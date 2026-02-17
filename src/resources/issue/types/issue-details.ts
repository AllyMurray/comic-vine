import {
  AssociatedImage,
  Image,
  PersonCreditSiteResource,
  SiteResource,
} from '../../common-types.js';

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
  /**
   * A list of characters that appear in this issue.
   */
  characterCredits: Array<SiteResource>;
  characterDiedIn: Array<SiteResource>;
  /**
   * A list of concepts that appear in this issue.
   */
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
  firstAppearanceCharacters: unknown;
  /**
   * A list of concepts in which this issue is the first appearance of the concept.
   */
  firstAppearanceConcepts: unknown;
  /**
   * A list of locations in which this issue is the first appearance of the location.
   */
  firstAppearanceLocations: unknown;
  /**
   * A list of things in which this issue is the first appearance of the object.
   */
  firstAppearanceObjects: unknown;
  /**
   * A list of storyarcs in which this issue is the first appearance of the story arc.
   */
  firstAppearanceStoryarcs: unknown;
  /**
   * A list of teams in which this issue is the first appearance of the team.
   */
  firstAppearanceTeams: unknown;
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
  /**
   * List of locations that appeared in this issue.
   */
  locationCredits: Array<SiteResource>;
  /**
   * Name of the issue.
   */
  name: null | string;
  /**
   * List of things that appeared in this issue.
   */
  objectCredits: Array<SiteResource>;
  /**
   * List of people that worked on this issue.
   */
  personCredits: Array<PersonCreditSiteResource>;
  /**
   * URL pointing to the issue on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * The date the issue was first sold in stores.
   */
  storeDate: Date | null;
  /**
   * List of story arcs this issue appears in.
   */
  storyArcCredits: Array<SiteResource>;
  /**
   * List of teams that appear in this issue.
   */
  teamCredits: Array<SiteResource>;
  teamDisbandedIn: Array<SiteResource>;
  /**
   * The volume this issue is a part of.
   */
  volume: SiteResource;
}
