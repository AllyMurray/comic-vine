import { ResourceType } from '..';
import { PublisherDetails, PublisherListItem } from './types';
import { BaseResource } from '../base-resource';

export class Publisher extends BaseResource<PublisherDetails, PublisherListItem> {
  protected resourceType: ResourceType = ResourceType.Publisher;
}
