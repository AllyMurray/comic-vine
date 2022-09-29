import { SiteResource, IssueApiResource, ApiResource, Image } from '../../common-types';

export interface TeamDetails {
    /**
     * List of aliases the team is known by. A \n (newline) seperates each alias.
     */
    aliases: null | string;
    /**
     * URL pointing to the team detail resource.
     */
    apiDetailUrl: string;
    /**
     * List of characters that are enemies with this team.
     */
    characterEnemies: Array<SiteResource>;
    /**
     * List of characters that are friends with this team.
     */
    characterFriends: Array<SiteResource>;
    /**
     * Characters related to the team.
     */
    characters: Array<SiteResource>;
    countOfIsssueAppearances: number;
    /**
     * Number of team members in this team.
     */
    countOfTeamMembers: number;
    /**
     * Date the team was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the team was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the team.
     */
    deck: string;
    /**
     * Description of the team.
     */
    description: string;
    /**
     * List of issues this team disbanded in.
     */
    disbandedInIssues: Array<SiteResource>;
    /**
     * Issue where the team made its first appearance.
     */
    firstAppearedInIssue: IssueApiResource;
    /**
     * Unique ID of the team.
     */
    id: number;
    /**
     * Main image of the team.
     */
    image:              Image;
    isssuesDisbandedIn: Array<SiteResource>;
    issueCredits: Array<SiteResource>;
    /**
     * Movies the team was in.
     */
    movies: Array<SiteResource>;
    /**
     * Name of the team.
     */
    name: string;
    /**
     * The primary publisher a team is attached to.
     */
    publisher: ApiResource;
    /**
     * URL pointing to the team on Giant Bomb.
     */
    siteDetailUrl:   string;
    storyArcCredits: Array<SiteResource>;
    volumeCredits: Array<SiteResource>;
}