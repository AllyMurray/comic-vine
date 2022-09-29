import { ResourceType } from '..';
import { MovieDetails, MovieListItem } from './types';
import { BaseResource } from '../base-resource';

export class Movie extends BaseResource<MovieDetails, MovieListItem> {
  protected resourceType: ResourceType = ResourceType.Movie;
}
