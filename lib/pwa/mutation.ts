export type MutationAttempt<T> = { received: true; result: T } | { received: false };

export async function attemptMutation<T>(operation: () => Promise<T>): Promise<MutationAttempt<T>> {
  try {
    return { received: true, result: await operation() };
  } catch {
    // The server may have committed before the response was lost. Never replay.
    return { received: false };
  }
}
