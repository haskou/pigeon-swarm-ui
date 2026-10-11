import type {
  MailboxCreationWorkerRequest,
  MailboxCreationWorkerResponse,
} from './MailboxCreationWorkerMessages';

type PendingCreation = {
  reject: (error: Error) => void;
  resolve: (creationNonce: string) => void;
};

export class MailboxCreationWorkerClient {
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingCreation>();

  public constructor(private readonly worker: Worker) {
    this.worker.onmessage = (
      event: MessageEvent<MailboxCreationWorkerResponse>,
    ) => {
      const request = this.pending.get(event.data.id);

      if (!request) {
        return;
      }

      this.pending.delete(event.data.id);
      request.resolve(event.data.creationNonce);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      this.rejectAll(new Error(event.message));
    };
  }

  public mine(
    mailboxId: string,
    postTokenHash: string,
    readTokenHash: string,
    difficultyBits: number,
  ): Promise<string> {
    const id = this.nextRequestId;

    this.nextRequestId += 1;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });

      const request: MailboxCreationWorkerRequest = {
        difficultyBits,
        id,
        mailboxId,
        postTokenHash,
        readTokenHash,
      };

      this.worker.postMessage(request);
    });
  }

  public dispose(): void {
    this.worker.terminate();
    this.rejectAll(new Error('Mailbox creation worker was disposed'));
  }

  private rejectAll(error: Error): void {
    for (const request of this.pending.values()) {
      request.reject(error);
    }

    this.pending.clear();
  }
}
