import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { StandardRetryStrategy } from '@smithy/util-retry';
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

  // Create a new client with Smithy StandardRetryStrategy
  const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
    retryStrategy: new StandardRetryStrategy(config.maxRetries + 1), // Smithy counts total attempts, not retries
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
 * Safely destroys a DynamoDB client if it's managed by this store
 */
export function destroyDynamoDBClient(wrapper: DynamoDBClientWrapper): void {
  if (wrapper.isManaged && wrapper.client.destroy) {
    wrapper.client.destroy();
  }
}
