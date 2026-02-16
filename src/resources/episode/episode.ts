import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { EpisodeDetails, EpisodeListItem } from './types/index.js';

export class Episode extends BaseResource<EpisodeDetails, EpisodeListItem> {
  protected resourceType: ResourceType = ResourceType.Episode;
}
