import { ResourceType } from '..';
import { IssueDetails, IssueListItem } from './types';
import { BaseResource } from '../base-resource';

export class Issue extends BaseResource<IssueDetails, IssueListItem> {
  protected resourceType: ResourceType = ResourceType.Issue;
}
