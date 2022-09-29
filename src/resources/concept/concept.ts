import { ResourceType } from '..';
import { ConceptDetails, ConceptListItem } from './types';
import { BaseResource } from '../base-resource';

export class Concept extends BaseResource<ConceptDetails, ConceptListItem> {
  protected resourceType: ResourceType = ResourceType.Concept;
}
