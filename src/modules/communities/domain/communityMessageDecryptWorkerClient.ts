import type {
  ChatMessage,
  ConversationKeyEntry,
  MessageResource,
} from '../../../shared/domain/pigeonResources.types';

type CommunityMessageDecryptWorkerRequest = {
  communityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  requestId: number;
};

type CommunityMessageDecryptWorkerResponse =
  | {
      messages: ChatMessage[];
      requestId: number;
      type: 'success';
    }
  | {
      message: string;
      requestId: number;
      type: 'error';
    };

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (messages: ChatMessage[]) => void;
};

function abortError(): Error {
  const error = new Error('Community message decrypt aborted');

  error.name = 'AbortError';

  return error;
}

export class CommunityMessageDecryptWorkerClient {
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly worker: Worker;

  public constructor() {
    this.worker = new Worker(
      new URL('./communityMessageDecryptWorker.ts', import.meta.url),
      {
        type: 'module',
      },
    );
    this.worker.onmessage = (
      event: MessageEvent<CommunityMessageDecryptWorkerResponse>,
    ) => this.handleMessage(event.data);
    this.worker.onerror = (event) => {
      this.rejectAll(new Error(event.message));
    };
  }

  public async decrypt(
    request: Omit<CommunityMessageDecryptWorkerRequest, 'requestId'>,
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

  public terminate(): void {
    this.rejectAll(abortError());
    this.worker.terminate();
  }

  private handleMessage(response: CommunityMessageDecryptWorkerResponse): void {
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
}
