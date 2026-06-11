/**
 * Runs an async mapper over items with at most `concurrency` tasks in flight.
 * Results keep the original item order. Errors are surfaced as `null` results
 * so one failed item never aborts the whole batch.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        try {
          results[index] = await mapper(items[index], index);
        } catch {
          results[index] = null;
        }
      }
    }
  );

  await Promise.all(workers);
  return results;
}
