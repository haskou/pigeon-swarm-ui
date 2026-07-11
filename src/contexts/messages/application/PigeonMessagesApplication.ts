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
import type { MessagesGateway } from './ports/MessagesGateway';

import { AddMessageReaction } from './add-message-reaction/AddMessageReaction';
import { AddMessageReactionMessage } from './add-message-reaction/messages/AddMessageReactionMessage';
import { DeleteMessage } from './delete-message/DeleteMessage';
import { DeleteMessageMessage } from './delete-message/messages/DeleteMessageMessage';
import { EditMessage } from './edit-message/EditMessage';
import { EditMessageMessage } from './edit-message/messages/EditMessageMessage';
import { LoadMessage } from './load-message/LoadMessage';
import { LoadMessageMessage } from './load-message/messages/LoadMessageMessage';
import { LoadMessagesAround } from './load-messages-around/LoadMessagesAround';
import { LoadMessagesAroundMessage } from './load-messages-around/messages/LoadMessagesAroundMessage';
import { LoadMessages } from './load-messages/LoadMessages';
import { LoadMessagesMessage } from './load-messages/messages/LoadMessagesMessage';
import { RemoveMessageReactionMessage } from './remove-message-reaction/messages/RemoveMessageReactionMessage';
import { RemoveMessageReaction } from './remove-message-reaction/RemoveMessageReaction';
import { SendMessageMessage } from './send-message/messages/SendMessageMessage';
import { SendMessage } from './send-message/SendMessage';

export class PigeonMessagesApplication {
  private readonly addReaction: AddMessageReaction;

  private readonly deleteMessage: DeleteMessage;

  private readonly editMessage: EditMessage;

  private readonly loadMessage: LoadMessage;

  private readonly loadMessages: LoadMessages;

  private readonly loadMessagesAround: LoadMessagesAround;

  private readonly removeReaction: RemoveMessageReaction;

  private readonly sendMessage: SendMessage;

  public constructor(private readonly gateway: MessagesGateway) {
    this.addReaction = new AddMessageReaction(gateway);
    this.deleteMessage = new DeleteMessage(gateway);
    this.editMessage = new EditMessage(gateway);
    this.loadMessage = new LoadMessage(gateway);
    this.loadMessages = new LoadMessages(gateway);
    this.loadMessagesAround = new LoadMessagesAround(gateway);
    this.removeReaction = new RemoveMessageReaction(gateway);
    this.sendMessage = new SendMessage(gateway);
  }

  public async addReactionTo(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.addReaction.add(
      new AddMessageReactionMessage({
        conversationId,
        emoji,
        messageId,
        session,
      }),
    );
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
    await this.deleteMessage.delete(
      new DeleteMessageMessage({ conversationId, messageId, session }),
    );
  }

  public async deleteDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.gateway.deleteConversationDraft(session, conversationId);
  }

  public async edit(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.editMessage.edit(
      new EditMessageMessage({
        content,
        conversationId,
        messageId,
        options,
        session,
      }),
    );
  }

  public async listDrafts(session: Session): Promise<ConversationDraft[]> {
    return await this.gateway.listConversationDrafts(session);
  }

  public async listPins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    return await this.gateway.listMessagePins(session, conversationId);
  }

  public async load(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.loadMessages.load(
      new LoadMessagesMessage({
        before,
        conversationId,
        options,
        session,
      }),
    );
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
    return await this.loadMessagesAround.loadAround(
      new LoadMessagesAroundMessage({ conversationId, messageId, session }),
    );
  }

  public async loadOne(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.loadMessage.load(
      new LoadMessageMessage({ conversationId, messageId, session }),
    );
  }

  public async loadThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    return await this.gateway.loadMessageThread(
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
    await this.gateway.pinMessage(session, conversationId, messageId);
  }

  public async removeReactionFrom(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.removeReaction.remove(
      new RemoveMessageReactionMessage({
        conversationId,
        emoji,
        messageId,
        session,
      }),
    );
  }

  public async saveDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.gateway.saveConversationDraft(
      session,
      conversationId,
      content,
      updatedAt,
    );
  }

  public async send(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.sendMessage.send(
      new SendMessageMessage({
        content,
        conversationId,
        options,
        session,
      }),
    );
  }

  public async unpin(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.gateway.unpinMessage(session, conversationId, messageId);
  }
}
