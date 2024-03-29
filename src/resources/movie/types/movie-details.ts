import { SiteResource, Image } from '../../common-types.js';

export interface MovieDetails {
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
  budget: string;
  /**
   * Characters related to the movie.
   */
  characters: Array<SiteResource>;
  /**
   * Concepts related to the movie.
   */
  concepts: Array<SiteResource>;
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
  deck: string;
  /**
   * Description of the movie.
   */
  description: null | string;
  distributor: null;
  hasStaffReview: null | false | SiteResource;
  /**
   * Unique ID of the movie.
   */
  id: number;
  /**
   * Main image of the movie.
   */
  image: Image;
  /**
   * Locations related to the movie.
   */
  locations: Array<SiteResource>;
  /**
   * Name of the movie.
   */
  name: string;
  objects: Array<SiteResource>;
  /**
   * The producers of this movie.
   */
  producers: Array<SiteResource>;
  /**
   * The rating of this movie.
   */
  rating: string;
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
   * List of teams this movie is a member of.
   */
  teams: Array<SiteResource>;
  /**
   * Total revenue generated by this movie.
   */
  totalRevenue: string;
  /**
   * Writers for this movie.
   */
  writers: Array<SiteResource>;
}
