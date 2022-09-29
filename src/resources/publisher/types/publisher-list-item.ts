import { Image } from '../../common-types';

export interface PublisherListItem {
    /**
     * List of aliases the publisher is known by. A \n (newline) seperates each alias.
     */
    aliases: null | string;
    /**
     * URL pointing to the publisher detail resource.
     */
    apiDetailUrl: string;
    /**
     * Date the publisher was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the publisher was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the publisher.
     */
    deck: null | string;
    /**
     * Description of the publisher.
     */
    description: null | string;
    /**
     * Unique ID of the publisher.
     */
    id: number;
    /**
     * Main image of the publisher.
     */
    image: Image;
    /**
     * Street address of the publisher.
     */
    locationAddress: null | string;
    /**
     * City the publisher resides in.
     */
    locationCity: null | string;
    /**
     * State the publisher resides in.
     */
    locationState: LocationState | null;
    /**
     * Name of the publisher.
     */
    name: string;
    /**
     * URL pointing to the publisher on Giant Bomb.
     */
    siteDetailUrl: string;
}


export enum LocationState {
    California = "California",
    LocationStateNewYork = "New York ",
    NewYork = "New York",
    Pennsylvania = "Pennsylvania",
}