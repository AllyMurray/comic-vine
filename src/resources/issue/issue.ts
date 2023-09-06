import { IssueDetails, IssueListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Issue extends BaseResource<IssueDetails, IssueListItem> {
  protected resourceType: ResourceType = ResourceType.Issue;
}
