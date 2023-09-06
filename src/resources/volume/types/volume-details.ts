import { SiteResourceWithCount, IssueApiResource, IssueSiteResource, ApiResource, Image } from '../../common-types.js';

export interface VolumeDetails {
    /**
     * List of aliases the volume is known by. A \n (newline) seperates each alias.
     */
aliases: null | string;
    /**
     * URL pointing to the volume detail resource.
     */
    apiDetailUrl: string;
    /**
     * A list of characters that appear in this volume.
     */
    characters: Array<SiteResourceWithCount>;
    /**
     * A list of concepts that appear in this volume.
     */
    concepts: Array<SiteResourceWithCount>;
    /**
     * Number of issues included in this volume.
     */
    countOfIssues: number;
    /**
     * Date the volume was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the volume was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the volume.
     */
    deck: null | string;
    /**
     * Description of the volume.
     */
    description: null | string;
    /**
     * The first issue in this volume.
     */
    firstIssue: IssueApiResource;
    /**
     * Unique ID of the volume.
     */
    id: number;
    /**
     * Main image of the volume.
     */
    image:  Image;
    issues: Array<IssueSiteResource>;
    /**
     * The last issue in this volume.
     */
    lastIssue: IssueApiResource;
    /**
     * Name of the volume.
     */
    name: string;
    /**
     * List of things that appeared in this volume.
     */
    objects: Array<SiteResourceWithCount>;
    people: Array<SiteResourceWithCount>;
    /**
     * The primary publisher a volume is attached to.
     */
    publisher: ApiResource;
    /**
     * URL pointing to the volume on Giant Bomb.
     */
    siteDetailUrl: string;
    /**
     * The first year this volume appeared in comics.
     */
    startYear: string;
}