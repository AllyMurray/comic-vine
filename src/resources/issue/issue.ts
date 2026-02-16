import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { IssueDetails, IssueListItem } from './types/index.js';

export class Issue extends BaseResource<IssueDetails, IssueListItem> {
  protected resourceType: ResourceType = ResourceType.Issue;
}
