import { TeamDetails, TeamListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Team extends BaseResource<TeamDetails, TeamListItem> {
  protected resourceType: ResourceType = ResourceType.Team;
}
