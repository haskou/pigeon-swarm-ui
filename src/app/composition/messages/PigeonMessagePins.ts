import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { PinnedMessagesSearcher } from '../../../contexts/messages/application/list-message-pins/PinnedMessagesSearcher';
import type { MessagePinner } from '../../../contexts/messages/application/pin-message/MessagePinner';
import type { MessageUnpinner } from '../../../contexts/messages/application/unpin-message/MessageUnpinner';
import type { MessageMapper } from '../../../contexts/messages/infrastructure/http/MessageMapper';
import type {
  MessagePin,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { ListMessagePinsMessage } from '../../../contexts/messages/application/list-message-pins/messages/ListMessagePinsMessage';
import { PinMessageMessage } from '../../../contexts/messages/application/pin-message/messages/PinMessageMessage';
import { UnpinMessageMessage } from '../../../contexts/messages/application/unpin-message/messages/UnpinMessageMessage';

export class PigeonMessagePins {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly mapper: MessageMapper,
    private readonly searcher: PinnedMessagesSearcher,
    private readonly pinner: MessagePinner,
    private readonly unpinner: MessageUnpinner,
  ) {}

  private mutationInput(
    session: Session,
    conversationId: string,
    messageId: string,
  ) {
    return {
      authorIdentityId: session.identity.id,
      conversationId,
      messageId,
      occurredAt: Date.now(),
    };
  }

  public async list(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    this.identityContexts.register(session);
    const pins = await this.searcher.search(
      new ListMessagePinsMessage({
        actorIdentityId: session.identity.id,
        conversationId,
      }),
    );

    return pins.map((pin) => {
      const metadata = pin.toPrimitives();

      return {
        createdAt: metadata.createdAt,
        message: this.mapper.toChatMessage(pin.getMessage()),
        messageId: metadata.messageId,
        pinnedByIdentityId: metadata.pinnedByIdentityId,
      };
    });
  }

  public async pin(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    this.identityContexts.register(session);
    await this.pinner.pin(
      new PinMessageMessage(
        this.mutationInput(session, conversationId, messageId),
      ),
    );
  }

  public async unpin(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    this.identityContexts.register(session);
    await this.unpinner.unpin(
      new UnpinMessageMessage(
        this.mutationInput(session, conversationId, messageId),
      ),
    );
  }
}
