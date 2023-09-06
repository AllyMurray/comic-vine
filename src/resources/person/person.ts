import { PersonDetails, PersonListItem } from './types/index.js';
import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';

export class Person extends BaseResource<PersonDetails, PersonListItem> {
  protected resourceType: ResourceType = ResourceType.Person;
}
