import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { MessageDecryptWorkerRequest } from './MessageDecryptWorkerRequest';
import type { MessageDecryptWorkerResponse } from './MessageDecryptWorkerResponse';
import type { PendingRequest } from './PendingRequest';

function abortError(): Error {
  const error = new Error('Message decrypt aborted');

  error.name = 'AbortError';

  return error;
}

export class MessageDecryptWorkerClient {
  private nextRequestId = 0;

  private readonly pending = new Map<number, PendingRequest>();

  private readonly worker: Worker;

  public constructor() {
    this.worker = new Worker(
      new URL('./messageDecryptWorker.ts', import.meta.url),
      {
        type: 'module',
      },
    );
    this.worker.onmessage = (
      event: MessageEvent<MessageDecryptWorkerResponse>,
    ) => this.handleMessage(event.data);
    this.worker.onerror = (event) => {
      this.rejectAll(new Error(event.message));
    };
  }

  private handleMessage(response: MessageDecryptWorkerResponse): void {
    const pendingRequest = this.pending.get(response.requestId);

    if (!pendingRequest) return;

    this.pending.delete(response.requestId);

    if (response.type === 'success') {
      pendingRequest.resolve(response.messages);

      return;
    }

    pendingRequest.reject(new Error(response.message));
  }

  private rejectAll(error: Error): void {
    for (const pendingRequest of this.pending.values()) {
      pendingRequest.reject(error);
    }

    this.pending.clear();
  }

  public async decrypt(
    request: Omit<MessageDecryptWorkerRequest, 'requestId'>,
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    if (signal?.aborted) throw abortError();

    const requestId = this.nextRequestId + 1;

    this.nextRequestId = requestId;

    const promise = new Promise<ChatMessage[]>((resolve, reject) => {
      this.pending.set(requestId, { reject, resolve });
    });
    const abort = () => {
      const pendingRequest = this.pending.get(requestId);

      if (!pendingRequest) return;

      this.pending.delete(requestId);
      pendingRequest.reject(abortError());
      this.worker.postMessage({ requestId, type: 'cancel' });
    };

    signal?.addEventListener('abort', abort, { once: true });
    this.worker.postMessage({ ...request, requestId });

    try {
      return await promise;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }
}
