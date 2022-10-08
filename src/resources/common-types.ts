export interface ApiResource {
  apiDetailUrl: string;
  id: number;
  name: string | null;
}

export interface SiteResource extends ApiResource {
  siteDetailUrl: string;
}

export interface IssueApiResource extends ApiResource {
  issueNumber: string;
}

export interface IssueSiteResource extends SiteResource {
  issueNumber: string;
}

export interface SiteResourceWithCount extends SiteResource {
  count: string;
}

export interface EpisodeApiResource extends ApiResource {
  episodeNumber: string;
}

export interface EpisodeSiteResource extends SiteResource {
  episodeNumber: string;
}

export interface PersonCreditSiteResource extends SiteResource {
  role: string;
}

export interface Death {
  date: IsoString;
  timezoneType: number;
  timezone: string;
}

export interface AssociatedImage {
  caption: null;
  id: number;
  imageTags: string;
  originalUrl: string;
}

export interface Image {
  iconUrl: string;
  mediumUrl: string;
  screenUrl: string;
  screenLargeUrl: string;
  smallUrl: string;
  superUrl: string;
  thumbUrl: string;
  tinyUrl: string;
  originalUrl: string;
  imageTags: string;
}

export type IsoString = string;

export interface DateRange {
  start: IsoString;
  end?: IsoString;
}

export interface DateTimeRange {
  start: IsoString;
  end?: IsoString;
}
