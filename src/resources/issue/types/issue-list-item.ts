import { SiteResource, Image } from '../../common-types';

export interface IssueListItem {
    /**
     * List of aliases the issue is known by. A \n (newline) seperates each alias.
     */
    aliases: null;
    /**
     * URL pointing to the issue detail resource.
     */
    apiDetailUrl:     string;
    associatedImages: AssociatedImage[];
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
    deck: null;
    /**
     * Description of the issue.
     */
    description:    null | string;
    hasStaffReview: boolean;
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
     * Name of the issue.
     */
    name: null | string;
    /**
     * URL pointing to the issue on Giant Bomb.
     */
    siteDetailUrl: string;
    /**
     * The date the issue was first sold in stores.
     */
    storeDate: Date | null;
    /**
     * The volume this issue is a part of.
     */
    volume: SiteResource;
}

export interface AssociatedImage {
    caption:     null;
    id:          number;
    imageTags:   ImageTags;
    originalUrl: string;
}

export enum ImageTags {
    AllImages = "All Images",
}