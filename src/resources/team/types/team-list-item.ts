import { IssueApiResource, ApiResource, Image } from '../../common-types';

export interface TeamListItem {
    /**
     * List of aliases the team is known by. A \n (newline) seperates each alias.
     */
    aliases: null | string;
    /**
     * URL pointing to the team detail resource.
     */
    apiDetailUrl:             string;
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
    description: null | string;
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
    image: Image;
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
    siteDetailUrl: string;
}