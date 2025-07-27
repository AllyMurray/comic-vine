import { vi } from 'vitest';

/**
 * Mock implementation of DynamoDB Document Client
 * Provides in-memory storage for testing without actual DynamoDB
 */
export class MockDynamoDBDocumentClient {
  private data = new Map<string, any>();
  private batchFailures = new Set<string>();
  private shouldThrottle = false;
  private shouldTimeout = false;
  private timeoutMs = 100;

  async send(command: any): Promise<any> {
    // Simulate timeouts
    if (this.shouldTimeout) {
      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TimeoutError')), this.timeoutMs)
      );
    }

    // Simulate throttling
    if (this.shouldThrottle) {
      const error = new Error('ThrottlingException');
      (error as any).name = 'ThrottlingException';
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

  private handleGetCommand(command: any) {
    const key = this.buildKey(command.Key);
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

  private handlePutCommand(command: any) {
    const key = this.buildKey({
      PK: command.Item.PK,
      SK: command.Item.SK,
    });

    // Handle conditional expressions
    if (command.ConditionExpression) {
      const exists = this.data.has(key);
      if (command.ConditionExpression.includes('attribute_not_exists') && exists) {
        const error = new Error('ConditionalCheckFailedException');
        (error as any).name = 'ConditionalCheckFailedException';
        throw error;
      }
    }

    this.data.set(key, command.Item);
    return {};
  }

  private handleUpdateCommand(command: any) {
    const key = this.buildKey(command.Key);
    const item = this.data.get(key);

    if (!item) {
      if (command.ConditionExpression) {
        const error = new Error('ConditionalCheckFailedException');
        (error as any).name = 'ConditionalCheckFailedException';
        throw error;
      }
      // Create new item for update
      this.data.set(key, { ...command.Key });
    }

    // Simple implementation - just merge the update values
    const currentItem = this.data.get(key) || { ...command.Key };
    
    // Handle ADD operations
    if (command.UpdateExpression?.includes('ADD')) {
      for (const [attrName, value] of Object.entries(command.ExpressionAttributeValues || {})) {
        const path = this.resolveAttributePath(command.UpdateExpression, attrName, command.ExpressionAttributeNames);
        this.setNestedValue(currentItem, path, (this.getNestedValue(currentItem, path) || 0) + value);
      }
    }

    // Handle SET operations
    if (command.UpdateExpression?.includes('SET')) {
      for (const [attrName, value] of Object.entries(command.ExpressionAttributeValues || {})) {
        const path = this.resolveAttributePath(command.UpdateExpression, attrName, command.ExpressionAttributeNames);
        this.setNestedValue(currentItem, path, value);
      }
    }

    this.data.set(key, currentItem);
    return {};
  }

  private handleDeleteCommand(command: any) {
    const key = this.buildKey(command.Key);
    this.data.delete(key);
    return {};
  }

  private handleQueryCommand(command: any) {
    const items: any[] = [];
    const pk = command.ExpressionAttributeValues[':pk'];
    
    for (const [key, item] of this.data.entries()) {
      if (item.PK === pk) {
        // Check SK conditions if present
        if (command.KeyConditionExpression?.includes('>=')) {
          const skValue = command.ExpressionAttributeValues[':windowStart'];
          if (item.SK < skValue) continue;
        }

        // Check filter expression
        if (command.FilterExpression) {
          const priority = command.ExpressionAttributeValues[':priority'];
          if (priority && item.Data?.priority !== priority) continue;
        }

        // Check TTL expiration
        if (item.TTL && item.TTL <= Math.floor(Date.now() / 1000)) {
          this.data.delete(key);
          continue;
        }

        items.push(item);
      }
    }

    return {
      Items: command.Select === 'COUNT' ? undefined : items,
      Count: command.Select === 'COUNT' ? items.length : undefined,
    };
  }

  private handleScanCommand(command: any) {
    const items: any[] = [];
    const prefix = command.ExpressionAttributeValues?.[':cachePrefix'] || 
                  command.ExpressionAttributeValues?.[':dedupePrefix'] ||
                  command.ExpressionAttributeValues?.[':rateLimitPrefix'] ||
                  command.ExpressionAttributeValues?.[':adaptivePrefix'];

    const now = Math.floor(Date.now() / 1000);
    const expiredBefore = command.ExpressionAttributeValues?.[':now'];

    for (const [key, item] of this.data.entries()) {
      // Check prefix filter
      if (prefix && !item.PK.startsWith(prefix)) continue;

      // Check TTL filter for cleanup operations
      if (expiredBefore !== undefined) {
        if (!item.TTL || item.TTL > expiredBefore) continue;
      } else {
        // For non-cleanup scans, exclude expired items
        if (item.TTL && item.TTL <= now) {
          this.data.delete(key);
          continue;
        }
      }

      items.push(item);
    }

    return { Items: items };
  }

  private handleBatchWriteCommand(command: any) {
    const tableName = Object.keys(command.RequestItems)[0];
    const requests = command.RequestItems[tableName];

    for (const request of requests) {
      if (request.DeleteRequest) {
        const key = this.buildKey(request.DeleteRequest.Key);
        this.data.delete(key);
      }
    }

    return {};
  }

  private buildKey(keyObj: any): string {
    return `${keyObj.PK}#${keyObj.SK}`;
  }

  private resolveAttributePath(expression: string, placeholder: string, attributeNames?: Record<string, string>): string {
    // Simple resolution - in real implementation this would be more complex
    if (placeholder === ':zero') return '';
    if (placeholder === ':inc') return '';
    if (attributeNames) {
      for (const [name, value] of Object.entries(attributeNames)) {
        expression = expression.replace(new RegExp(name, 'g'), value);
      }
    }
    return expression.split('=')[0].trim().replace(/^SET\s+/, '').replace(/^ADD\s+/, '');
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
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

  getAllItems(): any[] {
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