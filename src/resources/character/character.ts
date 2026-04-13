import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { CharacterDetails, CharacterListItem } from './types/index.js';

export class Character extends BaseResource<
  CharacterDetails,
  CharacterListItem
> {
  protected resourceType: ResourceType = ResourceType.Character;
}
