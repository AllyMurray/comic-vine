import { PublisherDetails, PublisherListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Publisher extends BaseResource<PublisherDetails, PublisherListItem> {
  protected resourceType: ResourceType = ResourceType.Publisher;
}
