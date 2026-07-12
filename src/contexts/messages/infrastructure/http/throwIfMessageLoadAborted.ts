export function throwIfMessageLoadAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;

  const error = new Error('Message load aborted');

  error.name = 'AbortError';
  throw error;
}
