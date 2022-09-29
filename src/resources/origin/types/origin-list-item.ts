import {  } from '../../common-types';

export interface OriginListItem {
    /**
     * URL pointing to the origin detail resource.
     */
    apiDetailUrl: string;
    /**
     * Unique ID of the origin.
     */
    id: number;
    /**
     * Name of the origin.
     */
    name: string;
    /**
     * URL pointing to the origin on Giant Bomb.
     */
    siteDetailUrl: string;
}