import { SiteResource } from '../../common-types.js';

export interface PowerDetails {
    /**
     * List of aliases the power is known by. A \n (newline) seperates each alias.
     */
aliases: null | string;
    /**
     * URL pointing to the power detail resource.
     */
    apiDetailUrl: string;
    /**
     * Characters related to the power.
     */
    characters: Array<SiteResource>;
    /**
     * Date the power was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the power was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Description of the power.
     */
    description: null | string;
    /**
     * Unique ID of the power.
     */
    id: number;
    /**
     * Name of the power.
     */
    name: string;
    /**
     * URL pointing to the power on Giant Bomb.
     */
    siteDetailUrl: string;
}