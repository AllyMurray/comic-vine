/**
 * Sleep for specified milliseconds with optional jitter
 */
export function sleep(ms: number, jitter = 0): Promise<void> {
  const actualMs = jitter > 0 ? ms + Math.random() * jitter : ms;
  return new Promise((resolve) => setTimeout(resolve, actualMs));
}

/**
 * Measure operation execution time
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();

  return {
    result,
    durationMs: endTime - startTime,
  };
}
