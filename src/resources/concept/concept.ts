import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { ConceptDetails, ConceptListItem } from './types/index.js';

export class Concept extends BaseResource<ConceptDetails, ConceptListItem> {
  protected resourceType: ResourceType = ResourceType.Concept;
}
