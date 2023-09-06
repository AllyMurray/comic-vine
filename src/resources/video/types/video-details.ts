import { SiteResource } from '../../common-types.js';

export interface VideoDetails {
    /**
     * URL pointing to the video detail resource.
     */
    apiDetailUrl: string;
    crew:         null | string;
    /**
     * Brief summary of the video.
     */
    deck:        string;
    embedPlayer: string;
    guid:        string;
    /**
     * URL to the High Res version of the video.
     */
    highUrl: string;
    hosts:   null | string;
    /**
     * Unique ID of the video.
     */
    id: number;
    /**
     * Main image of the video.
     */
    image: { [key: string]: null | string };
    /**
     * Length (in seconds) of the video.
     */
    lengthSeconds: number;
    /**
     * URL to the Low Res version of the video.
     */
    lowUrl: string;
    /**
     * Name of the video.
     */
    name:    string;
    premium: boolean;
    /**
     * Date the video was published on Comic Vine.
     */
    publishDate: Date;
    savedTime:   null;
    /**
     * URL pointing to the video on Giant Bomb.
     */
    siteDetailUrl: string;
    /**
     * The video's filename.
     */
    url: string;
    /**
     * Author of the video.
     */
    user:            null | string;
    videoCategories: Array<SiteResource>;
    videoShow:       null;
    videoType:       string;
    youtubeId:       null | string;
}