import { ConceptDetails, ConceptListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Concept extends BaseResource<ConceptDetails, ConceptListItem> {
  protected resourceType: ResourceType = ResourceType.Concept;
}
