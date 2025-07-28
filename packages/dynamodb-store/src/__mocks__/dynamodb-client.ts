// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from 'vitest';

/**
 * Mock implementation of DynamoDB Document Client
 * Provides in-memory storage for testing without actual DynamoDB
 */
export class MockDynamoDBDocumentClient {
  private data = new Map<string, Record<string, unknown>>();
  private batchFailures = new Set<string>();
  private shouldThrottle = false;
  private shouldTimeout = false;
  private timeoutMs = 100;

  async send(command: {
    constructor: { name: string };
    input?: unknown;
  }): Promise<unknown> {
    // Simulate timeouts
    if (this.shouldTimeout) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TimeoutError')), this.timeoutMs),
      );
    }

    // Simulate throttling
    if (this.shouldThrottle) {
      const error = new Error('ThrottlingException');
      (error as Error & { name: string }).name = 'ThrottlingException';
      throw error;
    }

    const commandName = command.constructor.name;

    switch (commandName) {
      case 'GetCommand':
        return this.handleGetCommand(command);
      case 'PutCommand':
        return this.handlePutCommand(command);
      case 'UpdateCommand':
        return this.handleUpdateCommand(command);
      case 'DeleteCommand':
        return this.handleDeleteCommand(command);
      case 'QueryCommand':
        return this.handleQueryCommand(command);
      case 'ScanCommand':
        return this.handleScanCommand(command);
      case 'BatchWriteCommand':
        return this.handleBatchWriteCommand(command);
      default:
        throw new Error(`Unsupported command: ${commandName}`);
    }
  }

  private handleGetCommand(command: {
    input?: { Key: Record<string, unknown> };
  }) {
    const input = command.input || command;
    const key = this.buildKey(input.Key);
    const item = this.data.get(key);

    if (!item) {
      return { Item: undefined };
    }

    // Check TTL expiration
    if (item.TTL && item.TTL <= Math.floor(Date.now() / 1000)) {
      this.data.delete(key);
      return { Item: undefined };
    }

    return { Item: item };
  }

  private handlePutCommand(command: {
    input?: { Item: Record<string, unknown>; ConditionExpression?: string };
  }) {
    const input = command.input || command;
    const item = input.Item;
    const key = this.buildKey({
      PK: item.PK,
      SK: item.SK,
    });

    // Handle conditional expressions
    if (input.ConditionExpression) {
      // For dedupe store, we need to check if ANY job with the same hash exists
      // This means checking for any item with the same PK (which contains the hash)
      if (input.ConditionExpression.includes('attribute_not_exists')) {
        // Check if any PENDING item with this PK already exists
        // Completed/failed jobs should be allowed to be overwritten
        for (const [_existingKey, existingItem] of this.data.entries()) {
          if (existingItem.PK === item.PK) {
            // Allow overwriting if the existing job is completed, failed, or expired
            const isExpired =
              existingItem.TTL &&
              existingItem.TTL <= Math.floor(Date.now() / 1000);
            const isPending = existingItem.Data?.status === 'pending';

            if (!isExpired && isPending) {
              const error = new Error('ConditionalCheckFailedException');
              (error as Error & { name: string }).name =
                'ConditionalCheckFailedException';
              throw error;
            }
          }
        }
      }
    }

    this.data.set(key, item);

    return {};
  }

  private handleUpdateCommand(command: {
    input?: {
      Key: Record<string, unknown>;
      ConditionExpression?: string;
      UpdateExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, unknown>;
    };
  }) {
    const input = command.input || command;
    const key = this.buildKey(input.Key);
    const item = this.data.get(key);

    if (!item) {
      if (input.ConditionExpression) {
        const error = new Error('ConditionalCheckFailedException');
        (error as Error & { name: string }).name =
          'ConditionalCheckFailedException';
        throw error;
      }
      // Create new item for update
      this.data.set(key, { ...input.Key });
    }

    // Check condition expression before update
    if (input.ConditionExpression && item) {
      const isValid = this.evaluateConditionExpression(
        input.ConditionExpression,
        item,
        input.ExpressionAttributeNames || {},
        input.ExpressionAttributeValues || {},
      );
      if (!isValid) {
        const error = new Error('ConditionalCheckFailedException');
        (error as Error & { name: string }).name =
          'ConditionalCheckFailedException';
        throw error;
      }
    }

    // Simple implementation - just merge the update values
    const currentItem = this.data.get(key) || { ...input.Key };

    // Handle ADD operations
    if (input.UpdateExpression?.includes('ADD')) {
      for (const [attrName, value] of Object.entries(
        input.ExpressionAttributeValues || {},
      )) {
        const path = this.resolveAttributePath(
          input.UpdateExpression,
          attrName,
          input.ExpressionAttributeNames,
        );
        this.setNestedValue(
          currentItem,
          path,
          (this.getNestedValue(currentItem, path) || 0) + value,
        );
      }
    }

    // Handle SET operations
    if (input.UpdateExpression?.includes('SET')) {
      for (const [attrName, value] of Object.entries(
        input.ExpressionAttributeValues || {},
      )) {
        const path = this.resolveAttributePath(
          input.UpdateExpression,
          attrName,
          input.ExpressionAttributeNames,
        );
        this.setNestedValue(currentItem, path, value);
      }
    }

    this.data.set(key, currentItem);
    return {};
  }

  private handleDeleteCommand(command: {
    input?: { Key: Record<string, unknown> };
  }) {
    const input = command.input || command;
    const key = this.buildKey(input.Key);
    this.data.delete(key);
    return {};
  }

  private handleQueryCommand(command: {
    input?: {
      ExpressionAttributeValues?: Record<string, unknown>;
      Limit?: number;
      KeyConditionExpression?: string;
      FilterExpression?: string;
      Select?: string;
    };
  }) {
    const input = command.input || command;
    const items: Array<Record<string, unknown>> = [];
    const pk = input.ExpressionAttributeValues?.[':pk'];
    const limit = input.Limit || Number.MAX_SAFE_INTEGER;

    // Get all items that match the PK
    const candidateItems = Array.from(this.data.values()).filter(
      (item) => item.PK === pk,
    );

    for (const item of candidateItems) {
      if (items.length >= limit) break;

      // Check TTL expiration first
      if (item.TTL && item.TTL <= Math.floor(Date.now() / 1000)) {
        const key = this.buildKey({ PK: item.PK, SK: item.SK });
        this.data.delete(key);
        continue;
      }

      // Check SK conditions if present
      if (input.KeyConditionExpression?.includes('>=')) {
        const skValue = input.ExpressionAttributeValues?.[':windowStart'];
        if (skValue && item.SK < skValue) continue;
      }

      // Check filter expression
      if (input.FilterExpression) {
        const priority = input.ExpressionAttributeValues?.[':priority'];
        if (priority && item.Data?.priority !== priority) continue;
      }

      items.push(item);
    }

    return {
      Items: input.Select === 'COUNT' ? undefined : items,
      Count: input.Select === 'COUNT' ? items.length : undefined,
    };
  }

  private handleScanCommand(command: {
    input?: {
      ExpressionAttributeValues?: Record<string, unknown>;
      ExpressionAttributeNames?: Record<string, string>;
    };
  }) {
    const input = command.input || command;
    const items: Array<Record<string, unknown>> = [];
    const prefix =
      input.ExpressionAttributeValues?.[':cachePrefix'] ||
      input.ExpressionAttributeValues?.[':dedupePrefix'] ||
      input.ExpressionAttributeValues?.[':rateLimitPrefix'] ||
      input.ExpressionAttributeValues?.[':adaptivePrefix'];

    const _now = Math.floor(Date.now() / 1000);
    const expiredBefore = input.ExpressionAttributeValues?.[':now'];

    for (const [_key, item] of this.data.entries()) {
      // Check prefix filter
      if (prefix && !item.PK.startsWith(prefix)) continue;

      // Check TTL filter for cleanup operations
      if (expiredBefore !== undefined) {
        if (!item.TTL || item.TTL > expiredBefore) continue;
      } else {
        // For non-cleanup scans, include expired items (don't delete them)
        // Statistics methods need to count expired items
      }

      items.push(item);
    }

    return { Items: items };
  }

  private handleBatchWriteCommand(command: {
    input?: {
      RequestItems: Record<
        string,
        Array<{ DeleteRequest?: { Key: Record<string, unknown> } }>
      >;
    };
  }) {
    const input = command.input || command;
    const tableName = Object.keys(input.RequestItems)[0];
    const requests = input.RequestItems[tableName];

    for (const request of requests) {
      if (request.DeleteRequest) {
        const key = this.buildKey(request.DeleteRequest.Key);
        this.data.delete(key);
      }
    }

    return {};
  }

  private buildKey(keyObj: Record<string, unknown>): string {
    return `${keyObj.PK}#${keyObj.SK}`;
  }

  private resolveAttributePath(
    expression: string,
    placeholder: string,
    attributeNames?: Record<string, string>,
  ): string {
    // Find the attribute path for this placeholder in the expression
    const regex = new RegExp(
      `([\\w\\.#]+)\\s*=\\s*${placeholder.replace(':', '\\:')}`,
    );
    const match = expression.match(regex);

    if (!match) {
      return '';
    }

    let path = match[1];

    // Replace attribute name placeholders
    if (attributeNames) {
      for (const [name, value] of Object.entries(attributeNames)) {
        path = path.replace(new RegExp(name.replace('#', '\\#'), 'g'), value);
      }
    }

    return path;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  private evaluateConditionExpression(
    expression: string,
    item: Record<string, unknown>,
    attributeNames: Record<string, string>,
    attributeValues: Record<string, unknown>,
  ): boolean {
    // Simple condition expression evaluator for mock purposes
    let processedExpression = expression;

    // Replace attribute names
    for (const [placeholder, realName] of Object.entries(attributeNames)) {
      processedExpression = processedExpression.replace(
        new RegExp(placeholder.replace('#', '\\#'), 'g'),
        realName,
      );
    }

    // Replace attribute values
    for (const [placeholder, value] of Object.entries(attributeValues)) {
      processedExpression = processedExpression.replace(
        new RegExp(placeholder.replace(':', '\\:'), 'g'),
        JSON.stringify(value),
      );
    }

    // Handle common patterns used in the dedupe store
    if (processedExpression.includes('Data.status = "pending"')) {
      return item.Data?.status === 'pending';
    }

    if (processedExpression.includes('Data.status =')) {
      // Extract expected value from expression
      const match = processedExpression.match(/Data\.status\s*=\s*"([^"]+)"/);
      if (match) {
        const expectedStatus = match[1];
        return item.Data?.status === expectedStatus;
      }
    }

    // Default to true for other expressions
    return true;
  }

  // Test helper methods
  enableThrottling(): void {
    this.shouldThrottle = true;
  }

  disableThrottling(): void {
    this.shouldThrottle = false;
  }

  enableTimeout(timeoutMs = 100): void {
    this.shouldTimeout = true;
    this.timeoutMs = timeoutMs;
  }

  disableTimeout(): void {
    this.shouldTimeout = false;
  }

  clear(): void {
    this.data.clear();
  }

  getItemCount(): number {
    return this.data.size;
  }

  getAllItems(): Array<Record<string, unknown>> {
    return Array.from(this.data.values());
  }
}

/**
 * Mock DynamoDB Client
 */
export class MockDynamoDBClient {
  destroy = vi.fn();
}

/**
 * Mock DynamoDBDocumentClient.from factory
 */
export const mockDynamoDBDocumentClient = new MockDynamoDBDocumentClient();

export const DynamoDBDocumentClient = {
  from: vi.fn(() => mockDynamoDBDocumentClient),
};

export const DynamoDBClient = MockDynamoDBClient;
