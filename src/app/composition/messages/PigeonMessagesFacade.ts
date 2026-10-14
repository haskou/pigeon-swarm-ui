import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { PigeonLinkPreviewsApi } from '../../../contexts/messages/infrastructure/http/PigeonLinkPreviewsApi';
import type { ConversationDraftProjection as ConversationDraft } from '../../../contexts/messages/infrastructure/http/resources/ConversationDraftProjection';
import type { MessageLinkPreview } from '../../../contexts/messages/infrastructure/http/resources/MessageLinkPreview';

import { PigeonConversationDrafts } from './PigeonConversationDrafts';
import { PigeonMessagePins } from './PigeonMessagePins';
import { PigeonMessageReactions } from './PigeonMessageReactions';
import { PigeonMessageWriter } from './PigeonMessageWriter';

export class PigeonMessagesFacade {
  public constructor(
    private readonly writer: PigeonMessageWriter,
    private readonly drafts: PigeonConversationDrafts,
    private readonly reactions: PigeonMessageReactions,
    private readonly pins: PigeonMessagePins,
    private readonly linkPreviews: PigeonLinkPreviewsApi,
  ) {}

  public async addReactionTo(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.reactions.add(session, conversation, messageId, emoji);
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.linkPreviews.create(session, url);
  }

  public async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    await this.writer.delete(session, conversation, messageId);
  }

  public async deleteDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.drafts.delete(session, conversationId);
  }

  public async listDrafts(session: Session): Promise<ConversationDraft[]> {
    return await this.drafts.list(session);
  }

  public async pin(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    await this.pins.pin(session, conversation, messageId);
  }

  public async removeReactionFrom(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.reactions.remove(session, conversation, messageId, emoji);
  }

  public async saveDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.drafts.save(session, conversationId, content, updatedAt);
  }

  public async unpin(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    await this.pins.unpin(session, conversation, messageId);
  }
}
