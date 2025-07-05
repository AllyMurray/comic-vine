import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

// Cache table for storing cached API responses
export const cacheTable = sqliteTable('cache', {
  hash: text('hash').primaryKey(),
  value: blob('value', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

// Dedupe table for tracking in-progress requests
export const dedupeTable = sqliteTable('dedupe_jobs', {
  hash: text('hash').primaryKey(),
  jobId: text('job_id').notNull(),
  status: text('status').notNull(), // 'pending', 'completed', 'failed'
  result: blob('result', { mode: 'json' }),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Rate limit table for tracking API request limits
export const rateLimitTable = sqliteTable('rate_limits', {
  resource: text('resource').notNull(),
  timestamp: integer('timestamp').notNull(),
  id: integer('id').primaryKey({ autoIncrement: true }),
});

export type CacheRow = typeof cacheTable.$inferSelect;
export type DedupeRow = typeof dedupeTable.$inferSelect;
export type RateLimitRow = typeof rateLimitTable.$inferSelect;
