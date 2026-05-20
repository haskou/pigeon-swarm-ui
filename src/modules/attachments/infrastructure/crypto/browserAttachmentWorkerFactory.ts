export function browserAttachmentWorkerFactory(): Worker {
  return new Worker(new URL('./attachmentCipherWorker.ts', import.meta.url), {
    type: 'module',
  });
}
