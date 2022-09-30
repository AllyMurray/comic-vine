import { ResourceType } from '..';
import { CharacterDetails, CharacterListItem } from './types';
import { BaseResource } from '../base-resource';

export class Character extends BaseResource<
  CharacterDetails,
  CharacterListItem
> {
  protected resourceType: ResourceType = ResourceType.Character;
}
