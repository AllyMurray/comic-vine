import { userOptions, loadOptions } from './options';
import { HttpClientFactory } from './http-client';
import { ResourceFactory } from './resources';

export class ComicVine {
  private _character;
  private _concept;
  private _episode;
  private _issue;
  private _location;
  private _movie;
  private _origin;
  private _person;
  private _power;
  private _promo;
  private _publisher;
  private _series;
  private _storyArc;
  private _team;
  private _thing;
  private _video;
  private _videoCategory;
  private _videoType;
  private _volume;

  constructor(key: string, options?: userOptions) {
    const _options = loadOptions(options);
    const httpClient = HttpClientFactory.createClient();
    const urlBuilder = HttpClientFactory.createUrlBuilder(
      key,
      _options.baseUrl
    );
    const resourceFactory = new ResourceFactory(httpClient, urlBuilder);

    this._character = resourceFactory.create('Character');
    this._concept = resourceFactory.create('Concept');
    this._episode = resourceFactory.create('Episode');
    this._issue = resourceFactory.create('Issue');
    this._location = resourceFactory.create('Location');
    this._movie = resourceFactory.create('Movie');
    this._origin = resourceFactory.create('Origin');
    this._person = resourceFactory.create('Person');
    this._power = resourceFactory.create('Power');
    this._promo = resourceFactory.create('Promo');
    this._publisher = resourceFactory.create('Publisher');
    this._series = resourceFactory.create('Series');
    this._storyArc = resourceFactory.create('StoryArc');
    this._team = resourceFactory.create('Team');
    this._thing = resourceFactory.create('Thing');
    this._video = resourceFactory.create('Video');
    this._videoCategory = resourceFactory.create('VideoCategory');
    this._videoType = resourceFactory.create('VideoType');
    this._volume = resourceFactory.create('Volume');
  }

  get character() {
    return this._character;
  }

  get concept() {
    return this._concept;
  }

  get episode() {
    return this._episode;
  }

  get issue() {
    return this._issue;
  }

  get location() {
    return this._location;
  }

  get movie() {
    return this._movie;
  }

  get origin() {
    return this._origin;
  }

  get person() {
    return this._person;
  }

  get power() {
    return this._power;
  }

  get promo() {
    return this._promo;
  }

  get publisher() {
    return this._publisher;
  }

  get series() {
    return this._series;
  }

  get storyArc() {
    return this._storyArc;
  }

  get team() {
    return this._team;
  }

  get thing() {
    return this._thing;
  }

  get video() {
    return this._video;
  }

  get videoCategory() {
    return this._videoCategory;
  }

  get videoType() {
    return this._videoType;
  }

  get volume() {
    return this._volume;
  }
}
