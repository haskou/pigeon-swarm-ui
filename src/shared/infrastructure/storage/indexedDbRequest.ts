/** Resolves with the request result; rejects with its error. */
export function indexedDbRequest<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    source.addEventListener('success', () => resolve(source.result), {
      once: true,
    });
    source.addEventListener('error', () => reject(source.error), {
      once: true,
    });
  });
}

/**
 * Resolves when the transaction commits; rejects on error or abort, always
 * with an error: the failed request's, the transaction's, or one naming the
 * abort, since an explicit `abort()` leaves `transaction.error` null.
 */
export function indexedDbTransaction(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // The target is the failed request on error and the transaction on abort.
    const fail = (event: Event) =>
      reject(
        (event.target as { error?: DOMException | null } | null)?.error ??
          transaction.error ??
          new Error('IndexedDB transaction aborted.'),
      );

    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('error', fail, { once: true });
    transaction.addEventListener('abort', fail, { once: true });
  });
}
