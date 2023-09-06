import { MovieDetails, MovieListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Movie extends BaseResource<MovieDetails, MovieListItem> {
  protected resourceType: ResourceType = ResourceType.Movie;
}
