import { useEffect } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../composition/applicationContainer';

const PREWARM_RETRY_MS = 60_000;

type DirectMessageInboxPrewarmInput = {
  conversations: ConversationResource[];
  session: Session;
};

/**
 * Opens the recipient inbox of every one-to-one conversation, not only the
 * active one, so a sender can deliver before this device has read it. Runs on
 * session start and whenever the conversation list changes. A pass that leaves
 * an inbox unopened, or rejects, is retried after PREWARM_RETRY_MS. A cleanup
 * aborts the running pass and cancels the pending retry. Silent: no user error.
 */
export function useDirectMessageInboxPrewarm({
  conversations,
  session,
}: DirectMessageInboxPrewarmInput): void {
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    const pass = async (): Promise<void> => {
      const complete = await applicationContainer.directMessages
        .openInboxes(session, conversations, controller.signal)
        .catch(() => false);

      if (!complete && !controller.signal.aborted) {
        timer = window.setTimeout(() => void pass(), PREWARM_RETRY_MS);
      }
    };

    void pass();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [conversations, session]);
}
