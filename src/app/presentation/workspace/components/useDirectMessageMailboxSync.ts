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
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  session: Session;
};

/**
 * Polls the recipient inbox of the active one-to-one conversation. Within one
 * effect run, the next pass is scheduled only after the current one settles.
 * A cleanup aborts the running pass, but that pass may still be in flight when
 * the next effect run starts (StrictMode mounts twice). `sync` checks the
 * signal at each step, and overlapping passes share one inbox creation. A
 * failing streak shows one notice unless another error is already shown. The
 * next successful pass clears only that notice.
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
    let notice: string | null = null;
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

        if (notice !== null) {
          const shown = notice;
          notice = null;
          onErrorChange((current) => (current === shown ? null : current));
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (notice === null) {
          const message = toUserErrorMessage(
            caught,
            copy.workspace.directMailboxSyncError,
          );
          notice = message;
          onErrorChange((current) => current ?? message);
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
