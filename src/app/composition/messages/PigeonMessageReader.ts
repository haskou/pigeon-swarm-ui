import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { MessageThreadSearcher } from '../../../contexts/messages/application/load-message-thread/MessageThreadSearcher';
import type { MessageFinder } from '../../../contexts/messages/application/load-message/MessageFinder';
import type { MessagesAroundSearcher } from '../../../contexts/messages/application/load-messages-around/MessagesAroundSearcher';
import type { MessagesSearcher } from '../../../contexts/messages/application/load-messages/MessagesSearcher';
import type { MessageMapper } from '../../../contexts/messages/infrastructure/http/MessageMapper';
import type { MessageOperationContexts } from '../../../contexts/messages/infrastructure/http/MessageOperationContexts';
import type {
  ChatMessage,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { LoadMessageThreadMessage } from '../../../contexts/messages/application/load-message-thread/messages/LoadMessageThreadMessage';
import { LoadMessageMessage } from '../../../contexts/messages/application/load-message/messages/LoadMessageMessage';
import { LoadMessagesAroundMessage } from '../../../contexts/messages/application/load-messages-around/messages/LoadMessagesAroundMessage';
import { LoadMessagesMessage } from '../../../contexts/messages/application/load-messages/messages/LoadMessagesMessage';
import { MessageNotFoundError } from '../../../contexts/messages/domain/errors/MessageNotFoundError';

export class PigeonMessageReader {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly operationContexts: MessageOperationContexts,
    private readonly mapper: MessageMapper,
    private readonly finder: MessageFinder,
    private readonly searcher: MessagesSearcher,
    private readonly aroundSearcher: MessagesAroundSearcher,
    private readonly threadSearcher: MessageThreadSearcher,
  ) {}

  private register(session: Session): void {
    this.identityContexts.register(session);
  }

  public async load(
    session: Session,
    conversationId: string,
    before?: null | string,
    options: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    this.register(session);
    this.operationContexts.registerLoadSignal(
      session.identity.id,
      conversationId,
      options.signal,
    );
    const page = await this.searcher.search(
      new LoadMessagesMessage({
        actorIdentityId: session.identity.id,
        before: before ?? undefined,
        conversationId,
        limit: options.limit,
      }),
    );

    return {
      messages: page.mapMessages((message) =>
        this.mapper.toChatMessage(message),
      ),
      nextCursor: page.getNextCursor()?.toString() ?? null,
    };
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
    this.register(session);
    const page = await this.aroundSearcher.search(
      new LoadMessagesAroundMessage({
        actorIdentityId: session.identity.id,
        conversationId,
        messageId,
      }),
    );

    return {
      messages: page.mapMessages((message) =>
        this.mapper.toChatMessage(message),
      ),
      nextCursor: page.getNextCursor()?.toString() ?? null,
      previousCursor: page.getPreviousCursor()?.toString() ?? null,
    };
  }

  public async loadOne(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    this.register(session);

    try {
      const message = await this.finder.find(
        new LoadMessageMessage({
          actorIdentityId: session.identity.id,
          conversationId,
          messageId,
        }),
      );

      return this.mapper.toChatMessage(message);
    } catch (error) {
      if (error instanceof MessageNotFoundError) return null;

      throw error;
    }
  }

  public async loadThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    this.register(session);
    const page = await this.threadSearcher.search(
      new LoadMessageThreadMessage({
        actorIdentityId: session.identity.id,
        conversationId,
        limit: options.limit,
        messageId,
      }),
    );

    return {
      messages: page.mapMessages((message) =>
        this.mapper.toChatMessage(message),
      ),
      nextBeforeMessageId: page.getNextCursor()?.toString() ?? null,
    };
  }
}
