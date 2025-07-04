import {
  SiteResourceWithCount,
  EpisodeSiteResource,
  EpisodeApiResource,
  ApiResource,
  Image,
} from '../../common-types.js';

export interface SeriesDetails {
  /**
   * List of aliases the series is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the series detail resource.
   */
  apiDetailUrl: string;
  /**
   * A list of characters that appear in this series.
   */
  characters: Array<SiteResourceWithCount>;
  /**
   * Number of episodes included in this series.
   */
  countOfEpisodes: number;
  /**
   * Date the series was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the series was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the series.
   */
  deck: null | string;
  /**
   * Description of the series.
   */
  description: string;
  episodes: Array<EpisodeSiteResource>;
  /**
   * The first episode in this series.
   */
  firstEpisode: EpisodeApiResource;
  /**
   * Unique ID of the series.
   */
  id: number;
  /**
   * Main image of the series.
   */
  image: Image;
  /**
   * The last episode in this series.
   */
  lastEpisode: EpisodeApiResource;
  /**
   * Name of the series.
   */
  name: string;
  /**
   * The primary publisher a series is attached to.
   */
  publisher: ApiResource;
  /**
   * URL pointing to the series on Giant Bomb.
   */
  siteDetailUrl: string;
  /**
   * The first year this series appeared in comics.
   */
  startYear: string;
}
