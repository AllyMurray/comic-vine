import { IssueApiResource, ApiResource, Image } from '../../common-types';

export interface CharacterListItem {
    /**
     * List of aliases the character is known by. A \n (newline) seperates each alias.
     */
    aliases: null | string;
    /**
     * URL pointing to the character detail resource.
     */
    apiDetailUrl: string;
    /**
     * A date, if one exists, that the character was born on. Not an origin date.
     */
    birth: null | string;
    /**
     * Number of issues this character appears in.
     */
    countOfIssueAppearances: number;
    /**
     * Date the character was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the character was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the character.
     */
    deck: null | string;
    /**
     * Description of the character.
     */
    description: null | string;
    /**
     * Issue where the character made its first appearance.
     */
    firstAppearedInIssue: IssueApiResource;
    /**
     * Gender of the character. Available options are: Male, Female, Other
     */
    gender: number;
    /**
     * Unique ID of the character.
     */
    id: number;
    /**
     * Main image of the character.
     */
    image: Image;
    /**
     * Name of the character.
     */
    name: string;
    /**
     * The origin of the character. Human, Alien, Robot ...etc
     */
    origin: ApiResource;
    /**
     * The primary publisher a character is attached to.
     */
    publisher: ApiResource;
    /**
     * Real name of the character.
     */
    realName: null | string;
    /**
     * URL pointing to the character on Giant Bomb.
     */
    siteDetailUrl: string;
}