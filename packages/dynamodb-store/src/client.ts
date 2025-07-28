import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CircuitBreaker } from './circuit-breaker.js';
import type { DynamoDBStoreConfig, DynamoDBClientWrapper } from './types.js';

/**
 * Creates a DynamoDB client wrapper with proper lifecycle management
 */
export function createDynamoDBClient(
  config: DynamoDBStoreConfig,
): DynamoDBClientWrapper {
  // If a client is already provided, use it without managing its lifecycle
  if (config.client) {
    return {
      client: config.client,
      isManaged: false,
    };
  }

  // Create a new client with the provided configuration
  const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
    maxAttempts: config.maxRetries + 1, // AWS SDK uses attempts, not retries
  };

  if (config.region) {
    clientConfig.region = config.region;
  }

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  const client = new DynamoDBClient(clientConfig);

  return {
    client,
    isManaged: true,
  };
}

/**
 * Creates a circuit breaker for DynamoDB operations
 */
export function createCircuitBreaker(
  config: DynamoDBStoreConfig,
): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * Safely destroys a DynamoDB client if it's managed by this store
 */
export function destroyDynamoDBClient(wrapper: DynamoDBClientWrapper): void {
  if (wrapper.isManaged && wrapper.client.destroy) {
    wrapper.client.destroy();
  }
}
