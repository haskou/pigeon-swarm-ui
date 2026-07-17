import type { AttachmentProgressHandler } from './AttachmentProgressHandler';
import type { AttachmentWorkerFactory } from './AttachmentWorkerFactory';
import type { PendingWorkerRequest } from './PendingWorkerRequest';
import type { WorkerRequest } from './WorkerRequest';
import type { WorkerResponse } from './WorkerResponse';

export class AttachmentWorkerDispatcher {
  private nextRequestId = 0;

  private readonly requests = new Map<string, PendingWorkerRequest>();

  private worker?: Worker;

  public constructor(
    private readonly workerFactory?: AttachmentWorkerFactory,
  ) {}

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    this.worker = this.workerFactory!();
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event) => {
      this.rejectAll(new Error(event.message));
    };

    return this.worker;
  }

  private handleMessage(response: WorkerResponse): void {
    const pending = this.requests.get(response.id);

    if (!pending) return;

    if (response.type === 'progress') {
      pending.onProgress?.(response.progress);

      return;
    }

    this.requests.delete(response.id);

    if (response.type === 'error') {
      pending.reject(new Error(response.error));

      return;
    }

    pending.resolve(response);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.requests.values()) pending.reject(error);

    this.requests.clear();
    this.worker?.terminate();
    this.worker = undefined;
  }

  public run<T extends WorkerResponse>(
    request: WorkerRequest,
    onProgress?: AttachmentProgressHandler,
  ): Promise<T> {
    if (typeof Worker === 'undefined' || !this.workerFactory) {
      return Promise.reject(new Error('Attachment workers are not available'));
    }

    const worker = this.getWorker();
    const id = String(++this.nextRequestId);

    return new Promise<T>((resolve, reject) => {
      this.requests.set(id, {
        onProgress,
        reject,
        resolve: (response) => resolve(response as T),
      });

      try {
        worker.postMessage({ ...request, id });
      } catch (caught) {
        this.requests.delete(id);
        reject(caught);
      }
    });
  }
}
