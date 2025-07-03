import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { MovieDetails, MovieListItem } from './types/index.js';

export class Movie extends BaseResource<MovieDetails, MovieListItem> {
  protected resourceType: ResourceType = ResourceType.Movie;
}
