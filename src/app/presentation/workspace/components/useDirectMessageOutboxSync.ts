import type { Dispatch, SetStateAction } from 'react';

import { useEffect } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageOutboxItem } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxItem';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { applicationContainer } from '../../../composition/applicationContainer';
import { patchMessageById } from './patchMessageById';

type DirectMessageOutboxSyncInput = {
  activeConversation: ConversationResource | undefined;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  session: Session;
};

/**
 * Pairs each queued send with its outbox state. A send the outbox no longer
 * holds is delivered, so it is left out.
 */
function withQueuedState(
  queued: ChatMessage[],
  items: DirectMessageOutboxItem[],
): ChatMessage[] {
  return queued.flatMap((message) => {
    const item = items.find((candidate) => candidate.id === message.id);

    return item ? [{ ...message, deliveryStatus: item.state }] : [];
  });
}

function mergeQueued(visible: ChatMessage[]): SetStateAction<ChatMessage[]> {
  return (current) => MessageCollection.merge(current, visible);
}

/**
 * Shows the queued one-to-one sends of the active conversation, each with its
 * state. A `delivered` event clears the state of its message. A refresh reads
 * the states once its queued messages arrive, so a send delivered meanwhile
 * does not come back.
 */
export function useDirectMessageOutboxSync({
  activeConversation,
  onMessagesChange,
  session,
}: DirectMessageOutboxSyncInput): void {
  const conversationId = activeConversation?.id;
  const oneToOne = activeConversation?.type === 'one-to-one';

  useEffect(() => {
    if (!conversationId || !oneToOne) return undefined;

    const { directMessages } = applicationContainer;
    const identityId = session.identity.id;
    let live = true;

    const showQueued = (): void => {
      directMessages
        .queuedMessages(session, conversationId)
        .then((queued) => {
          if (!live) return;

          const items = directMessages.outboxItems(identityId, conversationId);
          const visible = withQueuedState(queued, items);

          if (visible.length > 0) onMessagesChange(mergeQueued(visible));
        })
        // The next outbox change refreshes the view again.
        .catch(() => undefined);
    };

    showQueued();

    const unsubscribe = directMessages.subscribeOutbox((event) => {
      if (event.kind === 'changed') {
        showQueued();

        return;
      }

      if (event.conversationId !== conversationId) return;

      onMessagesChange(
        patchMessageById(event.id, { deliveryStatus: undefined }),
      );
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, [conversationId, oneToOne, onMessagesChange, session]);
}
