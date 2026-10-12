import type { Dispatch, SetStateAction } from 'react';

import type {
  AttachmentUploadOptions,
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { ConversationThread } from './ConversationThread';

export type UseConversationThreadResult = {
  cancelEditing: () => void;
  cancelReplying: () => void;
  close: () => void;
  edit: (content: string) => Promise<void>;
  open: (message: ChatMessage) => Promise<void>;
  remove: (message: ChatMessage) => Promise<void>;
  send: (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => Promise<void>;
  sendSticker: (sticker: StickerMessageReference) => Promise<void>;
  setThread: Dispatch<SetStateAction<ConversationThread | null>>;
  startEditing: (message: ChatMessage) => void;
  startReplying: (message: ChatMessage) => void;
  thread: ConversationThread | null;
  updateDraft: (draft: string) => void;
};
