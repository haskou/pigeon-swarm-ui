import type { PigeonMessagesGateway } from '../../../contexts/messages/infrastructure/http/PigeonMessagesGateway';
import type {
  ChatMessage,
  ConversationDraft,
  EditMessageOptions,
  MessageLinkPreview,
  MessagePin,
  MessageResource,
  SendMessageOptions,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonConversationDrafts } from './PigeonConversationDrafts';
import { PigeonMessagePins } from './PigeonMessagePins';
import { PigeonMessageReactions } from './PigeonMessageReactions';
import { PigeonMessageReader } from './PigeonMessageReader';
import { PigeonMessageWriter } from './PigeonMessageWriter';

export class PigeonMessagesFacade {
  public constructor(
    private readonly reader: PigeonMessageReader,
    private readonly writer: PigeonMessageWriter,
    private readonly drafts: PigeonConversationDrafts,
    private readonly reactions: PigeonMessageReactions,
    private readonly pins: PigeonMessagePins,
    private readonly gateway: PigeonMessagesGateway,
  ) {}

  public async addReactionTo(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.reactions.add(session, conversationId, messageId, emoji);
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.gateway.createLinkPreview(session, url);
  }

  public async decrypt(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.gateway.decryptMessage(session, conversationId, message);
  }

  public async delete(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.writer.delete(session, conversationId, messageId);
  }

  public async deleteDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.drafts.delete(session, conversationId);
  }

  public async edit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.writer.edit(
      session,
      conversationId,
      messageId,
      content,
      options,
    );
  }

  public async listDrafts(session: Session): Promise<ConversationDraft[]> {
    return await this.drafts.list(session);
  }

  public async listPins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    return await this.pins.list(session, conversationId);
  }

  public async load(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.reader.load(session, conversationId, before, options);
  }

  public async loadAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    return await this.reader.loadAround(session, conversationId, messageId);
  }

  public async loadOne(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.reader.loadOne(session, conversationId, messageId);
  }

  public async loadThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{
    messages: ChatMessage[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.reader.loadThread(
      session,
      conversationId,
      messageId,
      options,
    );
  }

  public async pin(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.pins.pin(session, conversationId, messageId);
  }

  public async removeReactionFrom(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.reactions.remove(session, conversationId, messageId, emoji);
  }

  public async saveDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.drafts.save(session, conversationId, content, updatedAt);
  }

  public async send(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.writer.send(session, conversationId, content, options);
  }

  public async unpin(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.pins.unpin(session, conversationId, messageId);
  }
}
