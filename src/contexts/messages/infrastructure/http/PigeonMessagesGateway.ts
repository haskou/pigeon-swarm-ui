import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessagePin } from '../../presentation/view-models/MessagePin';
import type { MessageLoadOptions } from './MessageLoadOptions';
import type { ConversationDraftProjection as ConversationDraft } from './resources/ConversationDraftProjection';
import type { EditMessageOptions } from './resources/EditMessageOptions';
import type { MessageLinkPreview } from './resources/MessageLinkPreview';
import type { SendMessageOptions } from './resources/SendMessageOptions';

import { PigeonMessageCommandsApi } from './PigeonMessageCommandsApi';
import { PigeonMessagesApi } from './PigeonMessagesApi';

export class PigeonMessagesGateway {
  public constructor(
    private readonly messages: PigeonMessagesApi,
    private readonly commands: PigeonMessageCommandsApi,
  ) {}

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.messages.addMessageReaction(
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
    return await this.messages.createLinkPreview(session, url);
  }

  public async deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.messages.deleteConversationDraft(session, conversationId);
  }

  public async deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.commands.delete(session, conversationId, messageId);
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
    return await this.messages.listConversationDrafts(session);
  }

  public async listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    return await this.messages.listMessagePins(session, conversationId);
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.messages.loadMessage(session, conversationId, messageId);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limitOrOptions: MessageLoadOptions | number = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.messages.loadMessages(
      session,
      conversationId,
      before,
      limitOrOptions,
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
    return await this.messages.loadMessagesAround(
      session,
      conversationId,
      messageId,
    );
  }

  public async loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    return await this.messages.loadMessageThread(
      session,
      conversationId,
      messageId,
      options,
    );
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.messages.pinMessage(session, conversationId, messageId);
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.messages.removeMessageReaction(
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
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.messages.saveConversationDraft(
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
    await this.messages.unpinMessage(session, conversationId, messageId);
  }
}
