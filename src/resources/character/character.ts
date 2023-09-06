import { CharacterDetails, CharacterListItem } from './types/index.js';
import { ResourceType } from '../resource-type.js';
import { BaseResource } from '../base-resource.js';

export class Character extends BaseResource<CharacterDetails, CharacterListItem> {
  protected resourceType: ResourceType = ResourceType.Character;
}
