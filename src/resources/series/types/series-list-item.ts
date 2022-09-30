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

export enum ImageTags {
  AllImages = 'All Images',
  AllImagesDVDCoverSeason1 = 'All Images,DVD Cover,Season 1',
  AllImagesOfficialSeriesArt = 'All Images,Official Series Art',
  AllImagesOthers = 'All Images,Others',
  AllImagesSilverSurferAnimated1998 = 'All Images,Silver Surfer Animated (1998)',
  AllImagesStarWars = 'All Images,Star Wars',
  AllImagesTheFamily = 'All Images,The Family',
  AllImagesWiki = 'All Images,Wiki',
  AllImagesWikiXMenEvolutionTitleCards = 'All Images,Wiki - X-Men Evolution Title Cards',
}
