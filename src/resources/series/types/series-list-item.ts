import { EpisodeApiResource, ApiResource, Image } from '../../common-types';

export interface SeriesListItem {
  aliases: null | string;
  apiDetailUrl: string;
  countOfEpisodes: number;
  dateAdded: Date;
  dateLastUpdated: Date;
  deck: null | string;
  description: null | string;
  firstEpisode: EpisodeApiResource;
  id: number;
  image: Image;
  lastEpisode: EpisodeApiResource;
  name: string;
  publisher: ApiResource;
  siteDetailUrl: string;
  startYear: string;
}
