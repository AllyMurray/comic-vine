import { ResourceType } from '..';
import { TeamDetails, TeamListItem } from './types';
import { BaseResource } from '../base-resource';

export class Team extends BaseResource<TeamDetails, TeamListItem> {
  protected resourceType: ResourceType = ResourceType.Team;
}
