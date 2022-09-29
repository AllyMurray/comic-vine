import { ResourceType } from '..';
import { PersonDetails, PersonListItem } from './types';
import { BaseResource } from '../base-resource';

export class Person extends BaseResource<PersonDetails, PersonListItem> {
  protected resourceType: ResourceType = ResourceType.Person;
}
