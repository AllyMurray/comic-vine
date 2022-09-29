import { SiteResource, IssueApiResource, ApiResource, Image } from '../../common-types';

export interface CharacterDetails {
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
    birth: null;
    /**
     * List of characters that are enemies with this character.
     */
    characterEnemies: Array<SiteResource>;
    /**
     * List of characters that are friends with this character.
     */
    characterFriends: Array<SiteResource>;
    /**
     * Number of issues this character appears in.
     */
    countOfIssueAppearances: number;
    /**
     * List of the real life people who created this character.
     */
    creators: any[];
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
    image:        Image;
    issueCredits: Array<SiteResource>;
    /**
     * List of issues this character died in.
     */
    issuesDiedIn: any[];
    /**
     * Movies the character was in.
     */
    movies: Array<SiteResource>;
    /**
     * Name of the character.
     */
    name: string;
    /**
     * The origin of the character. Human, Alien, Robot ...etc
     */
    origin: ApiResource;
    /**
     * List of super powers a character has.
     */
    powers: Array<ApiResource>;
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
    siteDetailUrl:   string;
    storyArcCredits: Array<SiteResource>;
    /**
     * List of teams that are enemies of this character.
     */
    teamEnemies: Array<SiteResource>;
    /**
     * List of teams that are friends with this character.
     */
    teamFriends: any[];
    /**
     * List of teams this character is a member of.
     */
    teams: Array<SiteResource>;
    volumeCredits: Array<SiteResource>;
}