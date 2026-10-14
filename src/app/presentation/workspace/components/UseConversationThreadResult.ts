import type { Dispatch, SetStateAction } from 'react';

import type { AttachmentUploadOptions } from '../../../../contexts/attachments/application/contracts/AttachmentUploadOptions';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';
import type { ConversationThread } from './ConversationThread';

export type UseConversationThreadResult = {
  cancelEditing: () => void;
  cancelReplying: () => void;
  close: () => void;
  edit: (content: string) => Promise<void>;
  open: (message: ChatMessage) => void;
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
