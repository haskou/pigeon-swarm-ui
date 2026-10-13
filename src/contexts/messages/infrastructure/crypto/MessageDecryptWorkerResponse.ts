import type { ProjectedMessage } from './ProjectedMessage';

export type MessageDecryptWorkerResponse =
  | {
      projected: ProjectedMessage[];
      requestId: number;
      type: 'success';
    }
  | {
      message: string;
      requestId: number;
      type: 'error';
    };
