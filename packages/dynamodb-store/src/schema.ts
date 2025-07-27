/**
 * DynamoDB table schema definitions and utilities
 *
 * This file defines the structure and access patterns for the single DynamoDB table
 * used by all store implementations. The table uses a single-table design pattern
 * with different entity types sharing the same table structure.
 */

/**
 * Primary table attributes
 */
export const TableAttributes = {
  PK: 'PK', // Partition Key
  SK: 'SK', // Sort Key
  TTL: 'TTL', // Time To Live attribute
  Data: 'Data', // Entity data
  GSI1PK: 'GSI1PK', // GSI1 Partition Key
  GSI1SK: 'GSI1SK', // GSI1 Sort Key
} as const;

/**
 * Global Secondary Index names
 */
export const Indexes = {
  GSI1: 'GSI1',
} as const;

/**
 * Entity type prefixes for the partition key
 */
export const EntityTypes = {
  CACHE: 'CACHE',
  DEDUPE: 'DEDUPE',
  RATELIMIT: 'RATELIMIT',
  ADAPTIVE: 'ADAPTIVE',
  EXPIRES: 'EXPIRES',
} as const;

/**
 * Sort key patterns for different entity types
 */
export const SortKeys = {
  DATA: 'DATA',
  JOB: 'JOB',
  REQ: 'REQ',
  META: 'META',
} as const;

/**
 * Cache entity key builder
 */
export function buildCacheKey(hash: string): { PK: string; SK: string } {
  return {
    PK: `${EntityTypes.CACHE}#${hash}`,
    SK: SortKeys.DATA,
  };
}

/**
 * Dedupe entity key builder
 */
export function buildDedupeKey(
  hash: string,
  jobId: string,
): { PK: string; SK: string } {
  return {
    PK: `${EntityTypes.DEDUPE}#${hash}`,
    SK: `${SortKeys.JOB}#${jobId}`,
  };
}

/**
 * Rate limit entity key builder
 */
export function buildRateLimitKey(
  resource: string,
  timestamp: number,
  uuid: string,
): { PK: string; SK: string } {
  return {
    PK: `${EntityTypes.RATELIMIT}#${resource}`,
    SK: `${SortKeys.REQ}#${timestamp}#${uuid}`,
  };
}

/**
 * Adaptive rate limit metadata key builder
 */
export function buildAdaptiveMetaKey(resource: string): {
  PK: string;
  SK: string;
} {
  return {
    PK: `${EntityTypes.ADAPTIVE}#${resource}`,
    SK: SortKeys.META,
  };
}

/**
 * GSI1 key builder for expiration queries
 */
export function buildExpirationGSI1Key(
  entityType: string,
  ttl: number,
  pk: string,
): { GSI1PK: string; GSI1SK: string } {
  return {
    GSI1PK: `${EntityTypes.EXPIRES}#${entityType}`,
    GSI1SK: `${ttl}#${pk}`,
  };
}

/**
 * Extract hash from cache partition key
 */
export function extractHashFromCacheKey(pk: string): string {
  return pk.replace(`${EntityTypes.CACHE}#`, '');
}

/**
 * Extract resource from rate limit partition key
 */
export function extractResourceFromRateLimitKey(pk: string): string {
  return pk.replace(`${EntityTypes.RATELIMIT}#`, '');
}

/**
 * Extract job ID from dedupe sort key
 */
export function extractJobIdFromDedupeKey(sk: string): string {
  return sk.replace(`${SortKeys.JOB}#`, '');
}

/**
 * Extract timestamp and UUID from rate limit sort key
 */
export function extractTimestampAndUuidFromRateLimitKey(sk: string): {
  timestamp: number;
  uuid: string;
} {
  const parts = sk.replace(`${SortKeys.REQ}#`, '').split('#');
  return {
    timestamp: parseInt(parts[0] || '0', 10),
    uuid: parts[1] || '',
  };
}

/**
 * Cache item structure
 */
export interface CacheItem {
  PK: string;
  SK: string;
  TTL: number;
  Data: {
    value: unknown;
    createdAt: number;
  };
  GSI1PK?: string;
  GSI1SK?: string;
}

/**
 * Dedupe item structure
 */
export interface DedupeItem {
  PK: string;
  SK: string;
  TTL: number;
  Data: {
    status: 'pending' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    createdAt: number;
    updatedAt: number;
  };
  GSI1PK?: string;
  GSI1SK?: string;
}

/**
 * Rate limit item structure
 */
export interface RateLimitItem {
  PK: string;
  SK: string;
  TTL: number;
  Data: {
    priority?: 'user' | 'background';
    createdAt: number;
  };
  GSI1PK?: string;
  GSI1SK?: string;
}

/**
 * Adaptive rate limit metadata item structure
 */
export interface AdaptiveMetaItem {
  PK: string;
  SK: string;
  Data: {
    userRequestCount: number;
    backgroundRequestCount: number;
    lastCalculation: number;
    backgroundPaused: boolean;
    activityLevel: 'low' | 'moderate' | 'high';
    reason: string;
  };
}
