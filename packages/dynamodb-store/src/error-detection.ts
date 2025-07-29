/**
 * Check if an error is a throttling error from DynamoDB
 */
export function isThrottlingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; code?: string };
  return (
    err.name === 'ThrottlingException' ||
    err.name === 'ProvisionedThroughputExceededException' ||
    err.name === 'ThrottlingError' ||
    err.code === 'ThrottlingException' ||
    err.code === 'ProvisionedThroughputExceededException'
  );
}

/**
 * Check if an error is a conditional check failed error
 */
export function isConditionalCheckFailedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; code?: string };
  return (
    err.name === 'ConditionalCheckFailedException' ||
    err.code === 'ConditionalCheckFailedException'
  );
}

/**
 * Check if error should trigger circuit breaker
 */
export function isSevereError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { name?: string; code?: string; statusCode?: number };

  // Service unavailable errors
  if (
    err.name === 'ServiceUnavailable' ||
    err.code === 'ServiceUnavailable' ||
    err.statusCode === 503
  ) {
    return true;
  }

  // Internal server errors
  if (
    err.name === 'InternalServerError' ||
    err.code === 'InternalServerError' ||
    err.statusCode === 500
  ) {
    return true;
  }

  // Connection timeout errors
  if (
    err.name === 'TimeoutError' ||
    err.name === 'ConnectTimeoutError' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ENOTFOUND'
  ) {
    return true;
  }

  // Throttling errors should trigger circuit breaker
  if (isThrottlingError(err)) {
    return true;
  }

  return false;
}
