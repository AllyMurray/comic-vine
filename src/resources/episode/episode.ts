import { ResourceType } from '..';
import { EpisodeDetails, EpisodeListItem } from './types';
import { BaseResource } from '../base-resource';

export class Episode extends BaseResource<EpisodeDetails, EpisodeListItem> {
  protected resourceType: ResourceType = ResourceType.Episode;
}
