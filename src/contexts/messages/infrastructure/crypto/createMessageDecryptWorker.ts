export function createMessageDecryptWorker(): Worker {
  return new Worker(new URL('./messageDecryptWorker.ts', import.meta.url), {
    type: 'module',
  });
}
