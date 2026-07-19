import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { ConversationDraftCollection } from './ConversationDraftCollection';

type ConversationDraftsInput = {
  activeConversationId: null | string;
  drafts: Record<string, string>;
  onDraftsChange: Dispatch<SetStateAction<Record<string, string>>>;
  session: Session;
};

type ConversationDrafts = {
  activeDraft: string;
  updateActiveDraft: (value: string) => void;
};

export function useConversationDrafts({
  activeConversationId,
  drafts,
  onDraftsChange,
  session,
}: ConversationDraftsInput): ConversationDrafts {
  const syncTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;

    void applicationContainer.messages
      .listDrafts(session)
      .then((remoteDrafts) => {
        if (cancelled) return;

        onDraftsChange((current) =>
          ConversationDraftCollection.mergeMissing(current, remoteDrafts),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [onDraftsChange, session]);

  useEffect(
    () => () => {
      for (const timer of syncTimersRef.current.values()) {
        window.clearTimeout(timer);
      }

      syncTimersRef.current.clear();
    },
    [],
  );

  const scheduleSync = useCallback(
    (conversationId: string, value: string) => {
      const currentTimer = syncTimersRef.current.get(conversationId);

      if (currentTimer) window.clearTimeout(currentTimer);

      const timer = window.setTimeout(() => {
        syncTimersRef.current.delete(conversationId);

        if (value.trim()) {
          void applicationContainer.messages
            .saveDraft(session, conversationId, value)
            .catch(() => undefined);

          return;
        }

        void applicationContainer.messages
          .deleteDraft(session, conversationId)
          .catch(() => undefined);
      }, 700);

      syncTimersRef.current.set(conversationId, timer);
    },
    [session],
  );

  const updateActiveDraft = useCallback(
    (value: string) => {
      if (!activeConversationId) return;

      scheduleSync(activeConversationId, value);
      onDraftsChange((current) => ({
        ...current,
        [activeConversationId]: value,
      }));
    },
    [activeConversationId, onDraftsChange, scheduleSync],
  );

  return {
    activeDraft: activeConversationId
      ? (drafts[activeConversationId] ?? '')
      : '',
    updateActiveDraft,
  };
}
