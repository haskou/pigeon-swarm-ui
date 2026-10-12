import type { ChatMessage } from '../../../../messages/presentation/view-models/ChatMessage';

export type CommunityMessageDecryptResponse =
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
