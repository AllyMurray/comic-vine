import {  } from '../../common-types.js';

export interface VideoTypeListItem {
    /**
     * URL pointing to the video_type detail resource.
     */
    apiDetailUrl: string;
    /**
     * Brief summary of the video_type.
     */
    deck: null | string;
    /**
     * Unique ID of the video_type.
     */
    id: number;
    /**
     * Name of the video_type.
     */
    name: string;
    /**
     * URL pointing to the video_type on Giant Bomb.
     */
    siteDetailUrl: string;
}