import type {
  ChatMessage,
  ConversationDraft,
  EditMessageOptions,
  MessageLinkPreview,
  MessagePin,
  MessageResource,
  SendMessageOptions,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface MessagesGateway {
  addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;

  createLinkPreview(session: Session, url: string): Promise<MessageLinkPreview>;

  deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;

  decryptMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage>;

  deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void>;

  editMessage(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options?: EditMessageOptions,
  ): Promise<ChatMessage>;

  listConversationDrafts(session: Session): Promise<ConversationDraft[]>;

  listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]>;

  loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null>;

  loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options?: { limit?: number },
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }>;

  loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }>;

  loadMessagesAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }>;

  pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;

  removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void>;

  saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt?: number,
  ): Promise<ConversationDraft>;

  sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options?: SendMessageOptions,
  ): Promise<ChatMessage>;

  unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;
}
