import { IssueDetails, IssueListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Issue extends BaseResource<IssueDetails, IssueListItem> {
  protected resourceType: ResourceType = ResourceType.Issue;
}
