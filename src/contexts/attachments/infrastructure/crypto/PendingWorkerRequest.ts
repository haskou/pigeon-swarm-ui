import type { AttachmentProgressHandler } from './AttachmentProgressHandler';
import type { WorkerResponse } from './WorkerResponse';

export type PendingWorkerRequest = {
  onProgress?: AttachmentProgressHandler;
  reject: (reason?: unknown) => void;
  resolve: (response: WorkerResponse) => void;
};
