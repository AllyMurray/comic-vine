import { Death } from '../../common-types';

export interface PersonListItem {
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
  countOfIsssueAppearances: null | unknown;
  /**
   * Country the person resides in.
   */
  country: null | string;
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
  death: Death | null;
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
  email: null | string;
  /**
   * Gender of the person. Available options are: Male, Female, Other
   */
  gender: number;
  /**
   * City or town the person resides in.
   */
  hometown: null | string;
  /**
   * Unique ID of the person.
   */
  id: number;
  /**
   * Main image of the person.
   */
  image: { [key: string]: null | string };
  /**
   * Name of the person.
   */
  name: string;
  /**
   * URL pointing to the person on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * URL to the person website.
   */
  website: null | string;
}

export enum Timezone {
  AmericaLosAngeles = 'America/Los_Angeles',
}
