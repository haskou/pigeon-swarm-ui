import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

export type MessageDecryptWorkerResponse =
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
