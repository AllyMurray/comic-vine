import { IssueApiResource, Image } from '../../common-types.js';

export interface ThingListItem {
    /**
     * List of aliases the thing is known by. A \n (newline) seperates each alias.
     */
aliases: null | string;
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
    deck: null | string;
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
}