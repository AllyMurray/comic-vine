import { getResource, ResourceType } from '.';

describe('getResource', () => {
  test('should return values for Character', () => {
    const result = getResource(ResourceType.Character);
    expect(result).toStrictEqual({
      detailName: 'character',
      listName: 'characters',
    });
  });

  test('should return values for Issue', () => {
    const result = getResource(ResourceType.Issue);
    expect(result).toStrictEqual({ detailName: 'issue', listName: 'issues' });
  });

  test('should throw error when resource not found', () => {
    const UnknownResource = 9999;
    expect(() => getResource(UnknownResource)).toThrow(
      new Error(`Resource type (${UnknownResource}) not found`)
    );
  });
});
