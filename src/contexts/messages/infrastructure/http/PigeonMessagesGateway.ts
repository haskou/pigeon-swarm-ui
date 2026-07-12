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
import type { MessagesGateway } from '../../application/ports/MessagesGateway';
import type { PigeonMessageCommandsApi } from './PigeonMessageCommandsApi';
import type { PigeonMessagesApi } from './PigeonMessagesApi';

export class PigeonMessagesGateway implements MessagesGateway {
  public constructor(
    private readonly reads: PigeonMessagesApi,
    private readonly commands: PigeonMessageCommandsApi,
  ) {}

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.reads.addMessageReaction(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.reads.createLinkPreview(session, url);
  }

  public async deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.reads.deleteConversationDraft(session, conversationId);
  }

  public async deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.commands.delete(session, conversationId, messageId);
  }

  public async decryptMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.reads.decryptMessage(session, conversationId, message);
  }

  public async editMessage(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.commands.edit(
      session,
      conversationId,
      messageId,
      content,
      options,
    );
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraft[]> {
    return await this.reads.listConversationDrafts(session);
  }

  public async listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    return await this.reads.listMessagePins(session, conversationId);
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.reads.loadMessage(session, conversationId, messageId);
  }

  public async loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    return await this.reads.loadMessageThread(
      session,
      conversationId,
      messageId,
      options,
    );
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.reads.loadMessages(
      session,
      conversationId,
      before,
      options ?? {},
    );
  }

  public async loadMessagesAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    return await this.reads.loadMessagesAround(
      session,
      conversationId,
      messageId,
    );
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.reads.pinMessage(session, conversationId, messageId);
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.reads.removeMessageReaction(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }

  public async saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt?: number,
  ): Promise<ConversationDraft> {
    return await this.reads.saveConversationDraft(
      session,
      conversationId,
      content,
      updatedAt,
    );
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.commands.send(session, conversationId, content, options);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.reads.unpinMessage(session, conversationId, messageId);
  }
}
