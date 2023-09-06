import { TeamDetails, TeamListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Team extends BaseResource<TeamDetails, TeamListItem> {
  protected resourceType: ResourceType = ResourceType.Team;
}
