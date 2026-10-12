import type { ChatMessage } from '../../presentation/view-models/ChatMessage';

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
