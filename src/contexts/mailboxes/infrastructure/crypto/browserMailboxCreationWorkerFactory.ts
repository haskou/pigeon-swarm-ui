import { MailboxCreationWorkerClient } from './MailboxCreationWorkerClient';

export function createBrowserMailboxCreationWorkerClient(): MailboxCreationWorkerClient {
  return new MailboxCreationWorkerClient(
    new Worker(new URL('./mailboxCreationWorker.ts', import.meta.url), {
      type: 'module',
    }),
  );
}
