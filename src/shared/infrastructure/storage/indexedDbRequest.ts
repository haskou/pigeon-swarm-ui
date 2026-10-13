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

/** Resolves when the transaction commits; rejects on error or abort. */
export function indexedDbTransaction(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), {
      once: true,
    });
    transaction.addEventListener('abort', () => reject(transaction.error), {
      once: true,
    });
  });
}
