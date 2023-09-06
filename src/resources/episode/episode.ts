import { EpisodeDetails, EpisodeListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Episode extends BaseResource<EpisodeDetails, EpisodeListItem> {
  protected resourceType: ResourceType = ResourceType.Episode;
}
