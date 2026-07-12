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
import type { AddMessageReactionPort } from './add-message-reaction/AddMessageReactionPort';
import type { CreateLinkPreviewPort } from './create-link-preview/CreateLinkPreviewPort';
import type { DecryptMessagePort } from './decrypt-message/DecryptMessagePort';
import type { DeleteConversationDraftPort } from './delete-conversation-draft/DeleteConversationDraftPort';
import type { DeleteMessagePort } from './delete-message/DeleteMessagePort';
import type { EditMessagePort } from './edit-message/EditMessagePort';
import type { ListConversationDraftsPort } from './list-conversation-drafts/ListConversationDraftsPort';
import type { ListMessagePinsPort } from './list-message-pins/ListMessagePinsPort';
import type { LoadMessageThreadPort } from './load-message-thread/LoadMessageThreadPort';
import type { LoadMessagePort } from './load-message/LoadMessagePort';
import type { LoadMessagesAroundPort } from './load-messages-around/LoadMessagesAroundPort';
import type { LoadMessagesPort } from './load-messages/LoadMessagesPort';
import type { PinMessagePort } from './pin-message/PinMessagePort';
import type { RemoveMessageReactionPort } from './remove-message-reaction/RemoveMessageReactionPort';
import type { SaveConversationDraftPort } from './save-conversation-draft/SaveConversationDraftPort';
import type { SendMessagePort } from './send-message/SendMessagePort';
import type { UnpinMessagePort } from './unpin-message/UnpinMessagePort';

import { AddMessageReaction } from './add-message-reaction/AddMessageReaction';
import { AddMessageReactionMessage } from './add-message-reaction/messages/AddMessageReactionMessage';
import { CreateLinkPreview } from './create-link-preview/CreateLinkPreview';
import { CreateLinkPreviewMessage } from './create-link-preview/messages/CreateLinkPreviewMessage';
import { DecryptMessage } from './decrypt-message/DecryptMessage';
import { DecryptMessageMessage } from './decrypt-message/messages/DecryptMessageMessage';
import { DeleteConversationDraft } from './delete-conversation-draft/DeleteConversationDraft';
import { DeleteConversationDraftMessage } from './delete-conversation-draft/messages/DeleteConversationDraftMessage';
import { DeleteMessage } from './delete-message/DeleteMessage';
import { DeleteMessageMessage } from './delete-message/messages/DeleteMessageMessage';
import { EditMessage } from './edit-message/EditMessage';
import { EditMessageMessage } from './edit-message/messages/EditMessageMessage';
import { ListConversationDrafts } from './list-conversation-drafts/ListConversationDrafts';
import { ListConversationDraftsMessage } from './list-conversation-drafts/messages/ListConversationDraftsMessage';
import { ListMessagePins } from './list-message-pins/ListMessagePins';
import { ListMessagePinsMessage } from './list-message-pins/messages/ListMessagePinsMessage';
import { LoadMessageThread } from './load-message-thread/LoadMessageThread';
import { LoadMessageThreadMessage } from './load-message-thread/messages/LoadMessageThreadMessage';
import { LoadMessage } from './load-message/LoadMessage';
import { LoadMessageMessage } from './load-message/messages/LoadMessageMessage';
import { LoadMessagesAround } from './load-messages-around/LoadMessagesAround';
import { LoadMessagesAroundMessage } from './load-messages-around/messages/LoadMessagesAroundMessage';
import { LoadMessages } from './load-messages/LoadMessages';
import { LoadMessagesMessage } from './load-messages/messages/LoadMessagesMessage';
import { PinMessageMessage } from './pin-message/messages/PinMessageMessage';
import { PinMessage } from './pin-message/PinMessage';
import { RemoveMessageReactionMessage } from './remove-message-reaction/messages/RemoveMessageReactionMessage';
import { RemoveMessageReaction } from './remove-message-reaction/RemoveMessageReaction';
import { SaveConversationDraftMessage } from './save-conversation-draft/messages/SaveConversationDraftMessage';
import { SaveConversationDraft } from './save-conversation-draft/SaveConversationDraft';
import { SendMessageMessage } from './send-message/messages/SendMessageMessage';
import { SendMessage } from './send-message/SendMessage';
import { UnpinMessageMessage } from './unpin-message/messages/UnpinMessageMessage';
import { UnpinMessage } from './unpin-message/UnpinMessage';

export class PigeonMessagesApplication {
  private readonly addReaction: AddMessageReaction;

  private readonly createLinkPreviewUseCase: CreateLinkPreview;

  private readonly decryptMessage: DecryptMessage;

  private readonly deleteConversationDraft: DeleteConversationDraft;

  private readonly deleteMessage: DeleteMessage;

  private readonly editMessage: EditMessage;

  private readonly listConversationDrafts: ListConversationDrafts;

  private readonly listMessagePins: ListMessagePins;

  private readonly loadMessage: LoadMessage;

  private readonly loadMessageThread: LoadMessageThread;

  private readonly loadMessages: LoadMessages;

  private readonly loadMessagesAround: LoadMessagesAround;

  private readonly pinMessage: PinMessage;

  private readonly removeReaction: RemoveMessageReaction;

  private readonly saveConversationDraft: SaveConversationDraft;

  private readonly sendMessage: SendMessage;

  private readonly unpinMessage: UnpinMessage;

  public constructor(dependencies: {
    addMessageReaction: AddMessageReactionPort;
    createLinkPreview: CreateLinkPreviewPort;
    decryptMessage: DecryptMessagePort;
    deleteConversationDraft: DeleteConversationDraftPort;
    deleteMessage: DeleteMessagePort;
    editMessage: EditMessagePort;
    listConversationDrafts: ListConversationDraftsPort;
    listMessagePins: ListMessagePinsPort;
    loadMessage: LoadMessagePort;
    loadMessageThread: LoadMessageThreadPort;
    loadMessages: LoadMessagesPort;
    loadMessagesAround: LoadMessagesAroundPort;
    pinMessage: PinMessagePort;
    removeMessageReaction: RemoveMessageReactionPort;
    saveConversationDraft: SaveConversationDraftPort;
    sendMessage: SendMessagePort;
    unpinMessage: UnpinMessagePort;
  }) {
    this.addReaction = new AddMessageReaction(dependencies.addMessageReaction);
    this.createLinkPreviewUseCase = new CreateLinkPreview(
      dependencies.createLinkPreview,
    );
    this.decryptMessage = new DecryptMessage(dependencies.decryptMessage);
    this.deleteConversationDraft = new DeleteConversationDraft(
      dependencies.deleteConversationDraft,
    );
    this.deleteMessage = new DeleteMessage(dependencies.deleteMessage);
    this.editMessage = new EditMessage(dependencies.editMessage);
    this.listConversationDrafts = new ListConversationDrafts(
      dependencies.listConversationDrafts,
    );
    this.listMessagePins = new ListMessagePins(dependencies.listMessagePins);
    this.loadMessage = new LoadMessage(dependencies.loadMessage);
    this.loadMessageThread = new LoadMessageThread(
      dependencies.loadMessageThread,
    );
    this.loadMessages = new LoadMessages(dependencies.loadMessages);
    this.loadMessagesAround = new LoadMessagesAround(
      dependencies.loadMessagesAround,
    );
    this.pinMessage = new PinMessage(dependencies.pinMessage);
    this.removeReaction = new RemoveMessageReaction(
      dependencies.removeMessageReaction,
    );
    this.saveConversationDraft = new SaveConversationDraft(
      dependencies.saveConversationDraft,
    );
    this.sendMessage = new SendMessage(dependencies.sendMessage);
    this.unpinMessage = new UnpinMessage(dependencies.unpinMessage);
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
    return await this.createLinkPreviewUseCase.create(
      new CreateLinkPreviewMessage({ session, url }),
    );
  }

  public async decrypt(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.decryptMessage.decrypt(
      new DecryptMessageMessage({ conversationId, message, session }),
    );
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
    await this.deleteConversationDraft.delete(
      new DeleteConversationDraftMessage({ conversationId, session }),
    );
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
    return await this.listConversationDrafts.list(
      new ListConversationDraftsMessage(session),
    );
  }

  public async listPins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    return await this.listMessagePins.list(
      new ListMessagePinsMessage({ conversationId, session }),
    );
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
    return await this.loadMessageThread.load(
      new LoadMessageThreadMessage({
        conversationId,
        messageId,
        options,
        session,
      }),
    );
  }

  public async pin(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.pinMessage.pin(
      new PinMessageMessage({ conversationId, messageId, session }),
    );
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
    return await this.saveConversationDraft.save(
      new SaveConversationDraftMessage({
        content,
        conversationId,
        session,
        updatedAt,
      }),
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
    await this.unpinMessage.unpin(
      new UnpinMessageMessage({ conversationId, messageId, session }),
    );
  }
}
