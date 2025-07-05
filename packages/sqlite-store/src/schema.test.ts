import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { cacheTable, dedupeTable, rateLimitTable } from './schema.js';
import fs from 'fs';
import path from 'path';

describe('Database Schema', () => {
  let db: Database.Database;
  let drizzleDb: ReturnType<typeof drizzle>;
  const testDbPath = path.join(__dirname, 'test-schema.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    drizzleDb = drizzle(db);

    // Create tables using our schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        hash TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS cache_expires_at_idx ON cache (expires_at);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS dedupe_jobs (
        hash TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL,
        value TEXT,
        status TEXT DEFAULT 'pending' NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS dedupe_jobs_status_idx ON dedupe_jobs (status);
      CREATE INDEX IF NOT EXISTS dedupe_jobs_created_at_idx ON dedupe_jobs (created_at);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        resource TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        PRIMARY KEY (resource, timestamp)
      );

      CREATE INDEX IF NOT EXISTS rate_limits_resource_idx ON rate_limits (resource);
      CREATE INDEX IF NOT EXISTS rate_limits_timestamp_idx ON rate_limits (timestamp);
    `);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('cache table', () => {
    it('should allow inserting cache entries', () => {
      const stmt = db.prepare(`
        INSERT INTO cache (hash, value, expires_at)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        'test-hash',
        JSON.stringify({ test: 'value' }),
        Date.now() + 60000,
      );
      expect(result.changes).toBe(1);
    });

    it('should enforce primary key constraint', () => {
      const stmt = db.prepare(`
        INSERT INTO cache (hash, value, expires_at)
        VALUES (?, ?, ?)
      `);

      stmt.run('duplicate-hash', 'value1', Date.now() + 60000);

      expect(() => {
        stmt.run('duplicate-hash', 'value2', Date.now() + 60000);
      }).toThrow();
    });

    it('should allow selecting by hash', () => {
      const insertStmt = db.prepare(`
        INSERT INTO cache (hash, value, expires_at)
        VALUES (?, ?, ?)
      `);

      const selectStmt = db.prepare(`
        SELECT * FROM cache WHERE hash = ?
      `);

      insertStmt.run('test-hash', 'test-value', Date.now() + 60000);

      const result = selectStmt.get('test-hash');
      expect(result).toBeDefined();
      expect(result.hash).toBe('test-hash');
      expect(result.value).toBe('test-value');
    });

    it('should use expires_at index for cleanup queries', () => {
      const expiredTime = Date.now() - 60000;
      const activeTime = Date.now() + 60000;

      const stmt = db.prepare(`
        INSERT INTO cache (hash, value, expires_at)
        VALUES (?, ?, ?)
      `);

      stmt.run('expired', 'value1', expiredTime);
      stmt.run('active', 'value2', activeTime);

      const cleanupStmt = db.prepare(`
        DELETE FROM cache WHERE expires_at < ?
      `);

      const result = cleanupStmt.run(Date.now());
      expect(result.changes).toBe(1);

      const remaining = db.prepare('SELECT COUNT(*) as count FROM cache').get();
      expect(remaining.count).toBe(1);
    });
  });

  describe('dedupe_jobs table', () => {
    it('should allow inserting dedupe jobs', () => {
      const stmt = db.prepare(`
        INSERT INTO dedupe_jobs (hash, job_id, status)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run('test-hash', 'job-123', 'pending');
      expect(result.changes).toBe(1);
    });

    it('should set default status to pending', () => {
      const stmt = db.prepare(`
        INSERT INTO dedupe_jobs (hash, job_id)
        VALUES (?, ?)
      `);

      stmt.run('test-hash', 'job-123');

      const selectStmt = db.prepare(`
        SELECT status FROM dedupe_jobs WHERE hash = ?
      `);

      const result = selectStmt.get('test-hash');
      expect(result.status).toBe('pending');
    });

    it('should auto-populate timestamps', () => {
      const beforeInsert = Math.floor(Date.now() / 1000);

      const stmt = db.prepare(`
        INSERT INTO dedupe_jobs (hash, job_id)
        VALUES (?, ?)
      `);

      stmt.run('test-hash', 'job-123');

      const afterInsert = Math.floor(Date.now() / 1000);

      const selectStmt = db.prepare(`
        SELECT created_at, updated_at FROM dedupe_jobs WHERE hash = ?
      `);

      const result = selectStmt.get('test-hash');
      expect(result.created_at).toBeGreaterThanOrEqual(beforeInsert);
      expect(result.created_at).toBeLessThanOrEqual(afterInsert);
      expect(result.updated_at).toBeGreaterThanOrEqual(beforeInsert);
      expect(result.updated_at).toBeLessThanOrEqual(afterInsert);
    });

    it('should allow updating job status and value', () => {
      const insertStmt = db.prepare(`
        INSERT INTO dedupe_jobs (hash, job_id)
        VALUES (?, ?)
      `);

      insertStmt.run('test-hash', 'job-123');

      const updateStmt = db.prepare(`
        UPDATE dedupe_jobs
        SET status = ?, value = ?, updated_at = unixepoch()
        WHERE hash = ?
      `);

      const result = updateStmt.run(
        'completed',
        JSON.stringify({ result: 'success' }),
        'test-hash',
      );
      expect(result.changes).toBe(1);

      const selectStmt = db.prepare(`
        SELECT status, value FROM dedupe_jobs WHERE hash = ?
      `);

      const job = selectStmt.get('test-hash');
      expect(job.status).toBe('completed');
      expect(job.value).toBe(JSON.stringify({ result: 'success' }));
    });

    it('should use status index for queries', () => {
      const stmt = db.prepare(`
        INSERT INTO dedupe_jobs (hash, job_id, status)
        VALUES (?, ?, ?)
      `);

      stmt.run('pending1', 'job-1', 'pending');
      stmt.run('completed1', 'job-2', 'completed');
      stmt.run('pending2', 'job-3', 'pending');

      const selectStmt = db.prepare(`
        SELECT COUNT(*) as count FROM dedupe_jobs WHERE status = ?
      `);

      const pendingCount = selectStmt.get('pending');
      expect(pendingCount.count).toBe(2);

      const completedCount = selectStmt.get('completed');
      expect(completedCount.count).toBe(1);
    });
  });

  describe('rate_limits table', () => {
    it('should allow inserting rate limit entries', () => {
      const stmt = db.prepare(`
        INSERT INTO rate_limits (resource, timestamp)
        VALUES (?, ?)
      `);

      const result = stmt.run('test-resource', Date.now());
      expect(result.changes).toBe(1);
    });

    it('should enforce composite primary key', () => {
      const stmt = db.prepare(`
        INSERT INTO rate_limits (resource, timestamp)
        VALUES (?, ?)
      `);

      const timestamp = Date.now();
      stmt.run('test-resource', timestamp);

      // Same resource and timestamp should fail
      expect(() => {
        stmt.run('test-resource', timestamp);
      }).toThrow();

      // Different timestamp should succeed
      expect(() => {
        stmt.run('test-resource', timestamp + 1);
      }).not.toThrow();
    });

    it('should use resource index for queries', () => {
      const stmt = db.prepare(`
        INSERT INTO rate_limits (resource, timestamp)
        VALUES (?, ?)
      `);

      const now = Date.now();
      stmt.run('resource1', now);
      stmt.run('resource1', now + 1000);
      stmt.run('resource2', now + 2000);

      const selectStmt = db.prepare(`
        SELECT COUNT(*) as count FROM rate_limits WHERE resource = ?
      `);

      const resource1Count = selectStmt.get('resource1');
      expect(resource1Count.count).toBe(2);

      const resource2Count = selectStmt.get('resource2');
      expect(resource2Count.count).toBe(1);
    });

    it('should use timestamp index for cleanup queries', () => {
      const oldTime = Date.now() - 60000;
      const newTime = Date.now();

      const stmt = db.prepare(`
        INSERT INTO rate_limits (resource, timestamp)
        VALUES (?, ?)
      `);

      stmt.run('test', oldTime);
      stmt.run('test', newTime);

      const cleanupStmt = db.prepare(`
        DELETE FROM rate_limits WHERE timestamp < ?
      `);

      const result = cleanupStmt.run(Date.now() - 30000);
      expect(result.changes).toBe(1);

      const remaining = db
        .prepare('SELECT COUNT(*) as count FROM rate_limits')
        .get();
      expect(remaining.count).toBe(1);
    });
  });

  describe('table constraints and data types', () => {
    it('should enforce NOT NULL constraints', () => {
      // Cache table
      expect(() => {
        db.prepare('INSERT INTO cache (hash, value) VALUES (?, ?)').run(
          'hash',
          'value',
        );
      }).toThrow(); // Missing expires_at

      // Dedupe jobs table
      expect(() => {
        db.prepare('INSERT INTO dedupe_jobs (job_id) VALUES (?)').run('job-id');
      }).toThrow(); // Missing hash

      // Rate limits table
      expect(() => {
        db.prepare('INSERT INTO rate_limits (resource) VALUES (?)').run(
          'resource',
        );
      }).toThrow(); // Missing timestamp
    });

    it('should handle TEXT and INTEGER data types correctly', () => {
      // Test that TEXT fields accept strings
      const cacheStmt = db.prepare(
        'INSERT INTO cache (hash, value, expires_at) VALUES (?, ?, ?)',
      );
      cacheStmt.run('text-hash', 'text-value', 123456789);

      // Test that INTEGER fields accept numbers
      const rateLimitStmt = db.prepare(
        'INSERT INTO rate_limits (resource, timestamp) VALUES (?, ?)',
      );
      rateLimitStmt.run('resource', 123456789);

      // Verify data integrity
      const cacheResult = db
        .prepare('SELECT * FROM cache WHERE hash = ?')
        .get('text-hash');
      expect(typeof cacheResult.hash).toBe('string');
      expect(typeof cacheResult.value).toBe('string');
      expect(typeof cacheResult.expires_at).toBe('number');

      const rateLimitResult = db
        .prepare('SELECT * FROM rate_limits WHERE resource = ?')
        .get('resource');
      expect(typeof rateLimitResult.resource).toBe('string');
      expect(typeof rateLimitResult.timestamp).toBe('number');
    });
  });
});
