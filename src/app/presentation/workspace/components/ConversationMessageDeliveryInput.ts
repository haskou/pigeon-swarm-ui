import type { Dispatch, RefObject, SetStateAction } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type ConversationMessageDeliveryInput = {
  activeConversation: ConversationResource | undefined;
  messagesRef: RefObject<ChatMessage[]>;
  onAttachmentProgressChange: (progress: AttachmentProgress | null) => void;
  onConversationsChange: Dispatch<SetStateAction<ConversationResource[]>>;
  onErrorChange: (error: string | null) => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  onReplyTargetChange: (message: ChatMessage | null) => void;
  replyTarget: ChatMessage | null;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  session: Session;
};
