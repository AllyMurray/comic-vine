import { SiteResource, Image } from '../../common-types';

export interface MovieListItem {
    /**
     * URL pointing to the movie detail resource.
     */
    apiDetailUrl: string;
    /**
     * The total revenue made in the box offices for this movie.
     */
    boxOfficeRevenue: null | string;
    /**
     * The cost of making this movie.
     */
    budget: null | string;
    /**
     * Date the movie was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the movie was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the movie.
     */
    deck: null | string;
    /**
     * Description of the movie.
     */
    description:    null | string;
    distributor:    null;
    hasStaffReview: null;
    /**
     * Unique ID of the movie.
     */
    id: number;
    /**
     * Main image of the movie.
     */
    image: Image;
    /**
     * Name of the movie.
     */
    name: string;
    /**
     * The producers of this movie.
     */
    producers: Array<SiteResource>;
    /**
     * The rating of this movie.
     */
    rating: null | string;
    /**
     * Date of the movie.
     */
    releaseDate: Date;
    /**
     * The length of this movie.
     */
    runtime: string;
    /**
     * URL pointing to the movie on Giant Bomb.
     */
    siteDetailUrl: string;
    studios: Array<SiteResource>;
    /**
     * Total revenue generated by this movie.
     */
    totalRevenue: null | string;
    /**
     * Writers for this movie.
     */
    writers: Array<SiteResource>;
}