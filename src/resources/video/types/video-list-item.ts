import { SiteResource } from '../../common-types.js';

export interface VideoListItem {
  /**
   * URL pointing to the video detail resource.
   */
  apiDetailUrl: string;
  crew: Crew | null;
  /**
   * Brief summary of the video.
   */
  deck: string;
  embedPlayer: string;
  guid: string;
  /**
   * URL to the High Res version of the video.
   */
  highUrl: string;
  hosts: Hosts | null;
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
  name: string;
  premium: boolean;
  /**
   * Date the video was published on Comic Vine.
   */
  publishDate: Date;
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
  user: User | null;
  videoCategories: Array<SiteResource>;
  videoType: VideoType | null;
  youtubeId: null | string;
}

export enum Crew {
  Aclarkp = 'aclarkp',
  Buddyhutton = 'buddyhutton',
  Gmanfromheck = 'gmanfromheck',
  GmanfromheckRyanerikp = 'gmanfromheck, ryanerikp',
  GmanfromheckRyanerikpBuddyhutton = 'gmanfromheck, ryanerikp, buddyhutton',
  Ryanerikp = 'ryanerikp',
  RyanerikpBuddyhutton = 'ryanerikp, buddyhutton',
}

export enum Hosts {
  Aclarkp = 'aclarkp',
  Buddyhutton = 'buddyhutton',
  Gmanfromheck = 'gmanfromheck',
  Inferiorego = 'inferiorego',
  Ryanerikp = 'ryanerikp',
}

export enum User {
  Aclarkp = 'aclarkp',
  Buddyhutton = 'buddyhutton',
  Cadamien = 'cadamien',
  Gmanfromheck = 'gmanfromheck',
  Ryanerikp = 'ryanerikp',
}

export enum VideoType {
  Events = 'Events',
  Feature = 'Feature',
  FeatureEvents = 'Feature, Events',
  FeatureMysteryArtChallenge = 'Feature, Mystery Art Challenge',
  FeatureUnboxing = 'Feature, Unboxing',
  MysteryArtChallenge = 'Mystery Art Challenge',
  Review = 'Review',
  Trailer = 'Trailer',
  Unboxing = 'Unboxing',
}
