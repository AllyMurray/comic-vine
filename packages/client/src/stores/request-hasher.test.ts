import { describe, it, expect } from 'vitest';
import { hashRequest } from './request-hasher.js';

describe('hashRequest', () => {
  it('should generate consistent hashes for identical inputs', () => {
    const endpoint = 'issues/retrieve';
    const params = { id: 1, fieldList: ['id', 'name'] };

    const hash1 = hashRequest(endpoint, params);
    const hash2 = hashRequest(endpoint, params);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different endpoints', () => {
    const params = { id: 1 };

    const hash1 = hashRequest('issues/retrieve', params);
    const hash2 = hashRequest('characters/retrieve', params);

    expect(hash1).not.toBe(hash2);
  });

  it('should generate different hashes for different parameters', () => {
    const endpoint = 'issues/retrieve';

    const hash1 = hashRequest(endpoint, { id: 1 });
    const hash2 = hashRequest(endpoint, { id: 2 });

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty parameters', () => {
    const endpoint = 'issues/list';

    const hash1 = hashRequest(endpoint, {});
    const hash2 = hashRequest(endpoint, {});

    expect(hash1).toBe(hash2);
    expect(hash1).toBeTruthy();
  });

  it('should handle null and undefined parameters', () => {
    const endpoint = 'issues/retrieve';

    const hash1 = hashRequest(endpoint, { id: 1, name: null });
    const hash2 = hashRequest(endpoint, { id: 1, name: undefined });
    const hash3 = hashRequest(endpoint, { id: 1 }); // undefined omitted

    // null and undefined should produce different hashes
    expect(hash1).not.toBe(hash2);

    // undefined and omitted should produce the same hash
    expect(hash2).toBe(hash3);
  });

  it('should handle complex nested objects', () => {
    const endpoint = 'issues/list';
    const params = {
      filter: { name: 'Batman' },
      sort: { field: 'date_added', direction: 'desc' },
      pagination: { limit: 10, offset: 0 },
    };

    const hash1 = hashRequest(endpoint, params);
    const hash2 = hashRequest(endpoint, params);

    expect(hash1).toBe(hash2);
  });

  it('should handle parameter order independence', () => {
    const endpoint = 'issues/retrieve';

    const hash1 = hashRequest(endpoint, { id: 1, name: 'test' });
    const hash2 = hashRequest(endpoint, { name: 'test', id: 1 });

    expect(hash1).toBe(hash2);
  });

  it('should generate SHA-256 length hashes', () => {
    const hash = hashRequest('test/endpoint', { id: 1 });

    // SHA-256 hex string should be 64 characters
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should handle array parameters consistently', () => {
    const endpoint = 'issues/list';

    const hash1 = hashRequest(endpoint, { fieldList: ['id', 'name'] });
    const hash2 = hashRequest(endpoint, { fieldList: ['id', 'name'] });

    expect(hash1).toBe(hash2);
  });

  it('should handle special characters in parameters', () => {
    const endpoint = 'issues/search';
    const params = { query: 'Spider-Man: Into the Spider-Verse' };

    const hash1 = hashRequest(endpoint, params);
    const hash2 = hashRequest(endpoint, params);

    expect(hash1).toBe(hash2);
  });
});
