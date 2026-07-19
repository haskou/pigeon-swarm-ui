import type { SetStateAction } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { mergeCommunityDrafts } from './mergeCommunityDrafts';

export interface CommunityDraftsController {
  draft: string;
  setDraft: (next: SetStateAction<string>) => void;
}

export function useCommunityDrafts({
  communityId,
  selectedChannelId,
  session,
}: {
  communityId: string;
  selectedChannelId: null | string;
  session: Session;
}): CommunityDraftsController {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const syncTimers = useRef(new Map<string, number>());

  const scheduleSync = useCallback(
    (channelId: string, value: string) => {
      const currentTimer = syncTimers.current.get(channelId);

      if (currentTimer) window.clearTimeout(currentTimer);

      const timer = window.setTimeout(() => {
        syncTimers.current.delete(channelId);

        const synchronization = value.trim()
          ? applicationContainer.communities.saveChannelDraft(
              session,
              communityId,
              channelId,
              value,
            )
          : applicationContainer.communities.deleteChannelDraft(
              session,
              communityId,
              channelId,
            );

        void synchronization.catch(() => undefined);
      }, 700);

      syncTimers.current.set(channelId, timer);
    },
    [communityId, session],
  );

  const setDraft = useCallback(
    (next: SetStateAction<string>) => {
      if (!selectedChannelId) return;

      setDrafts((current) => {
        const currentValue = current[selectedChannelId] ?? '';
        const value = typeof next === 'function' ? next(currentValue) : next;

        scheduleSync(selectedChannelId, value);

        return { ...current, [selectedChannelId]: value };
      });
    },
    [scheduleSync, selectedChannelId],
  );

  useEffect(() => {
    let cancelled = false;

    void applicationContainer.communities
      .listDrafts(session)
      .then((remoteDrafts) => {
        if (!cancelled) {
          setDrafts((current) =>
            mergeCommunityDrafts(current, remoteDrafts, communityId),
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [communityId, session]);

  useEffect(
    () => () => {
      for (const timer of syncTimers.current.values()) {
        window.clearTimeout(timer);
      }

      syncTimers.current.clear();
    },
    [],
  );

  return {
    draft: selectedChannelId ? (drafts[selectedChannelId] ?? '') : '',
    setDraft,
  };
}
