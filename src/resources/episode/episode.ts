import { EpisodeDetails, EpisodeListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Episode extends BaseResource<EpisodeDetails, EpisodeListItem> {
  protected resourceType: ResourceType = ResourceType.Episode;
}
