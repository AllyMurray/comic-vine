import { isObject } from './is-object.js';

describe('isObject', () => {
  test('should return true when the input is an object', () => {
    expect(isObject({})).toBe(true);
  });
  test('should return false when the input is a array', () => {
    expect(isObject([])).toBe(false);
  });
  test('should return false when the input is a function', () => {
    expect(isObject(() => {})).toBe(false);
  });
  test('should return false when the input is undefined', () => {
    expect(isObject(undefined)).toBe(false);
  });
});
