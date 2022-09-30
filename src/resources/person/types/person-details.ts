import { SiteResource, Image } from '../../common-types';

export interface PersonDetails {
  /**
   * List of aliases the person is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the person detail resource.
   */
  apiDetailUrl: string;
  /**
   * A date, if one exists, that the person was born on. Not an origin date.
   */
  birth: Date | null;
  countOfIsssueAppearances: null;
  /**
   * Country the person resides in.
   */
  country: null | string;
  /**
   * Comic characters this person created.
   */
  createdCharacters: Array<SiteResource>;
  /**
   * Date the person was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the person was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Date this person died on.
   */
  death: null;
  /**
   * Brief summary of the person.
   */
  deck: null | string;
  /**
   * Description of the person.
   */
  description: null | string;
  /**
   * The email of this person.
   */
  email: null;
  /**
   * Gender of the person. Available options are: Male, Female, Other
   */
  gender: number;
  /**
   * City or town the person resides in.
   */
  hometown: null;
  /**
   * Unique ID of the person.
   */
  id: number;
  /**
   * Main image of the person.
   */
  image: Image;
  /**
   * List of issues this person appears in.
   */
  issues: Array<SiteResource>;
  /**
   * Name of the person.
   */
  name: string;
  /**
   * URL pointing to the person on Giant Bomb.
   */
  siteDetailUrl: string;
  storyArcCredits: Array<SiteResource>;
  volumeCredits: Array<SiteResource>;
  /**
   * URL to the person website.
   */
  website: null | string;
}
