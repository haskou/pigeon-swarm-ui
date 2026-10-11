import type { Dispatch, SetStateAction } from 'react';

import { useEffect } from 'react';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

const SYNC_INTERVAL_MS = 5000;

type DirectMessageMailboxSyncInput = {
  activeConversation: ConversationResource | undefined;
  onErrorChange: (error: string | null) => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  session: Session;
};

/**
 * Polls the recipient inbox of the active one-to-one conversation. A pass
 * never overlaps the next one: the next pass is scheduled after the current
 * one settles. The first failure of a streak shows a notice; the next
 * successful pass clears it.
 */
export function useDirectMessageMailboxSync({
  activeConversation,
  onErrorChange,
  onMessagesChange,
  session,
}: DirectMessageMailboxSyncInput): void {
  const conversationId =
    activeConversation?.type === 'one-to-one'
      ? activeConversation.id
      : undefined;

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const controller = new AbortController();
    let failing = false;
    let timer: number | undefined;

    const pass = async (): Promise<void> => {
      try {
        await applicationContainer.directMessages.sync(
          session,
          conversationId,
          controller.signal,
          (messages) => {
            if (messages.length > 0) {
              onMessagesChange((current) =>
                MessageCollection.merge(current, messages),
              );
            }
          },
        );

        if (failing) {
          failing = false;
          onErrorChange(null);
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (!failing) {
          failing = true;
          onErrorChange(
            toUserErrorMessage(caught, copy.workspace.directMailboxSyncError),
          );
        }
      }

      if (!controller.signal.aborted) {
        timer = window.setTimeout(() => void pass(), SYNC_INTERVAL_MS);
      }
    };

    void pass();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [conversationId, onErrorChange, onMessagesChange, session]);
}
