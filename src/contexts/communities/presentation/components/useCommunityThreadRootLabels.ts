import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ChatMessage,
  CommunityTextChannel,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityChannelThreadCache } from '../view-models/CommunityChannelThreadCache';
import { CommunityThreadRootLabelLoader } from '../view-models/CommunityThreadRootLabelLoader';
import { CommunityThreadRootLabels } from '../view-models/CommunityThreadRootLabels';
import { threadRootLabelKey } from './communityThreadState';

type UseCommunityThreadRootLabelsOptions = {
  channels: CommunityTextChannel[];
  communityId: string;
  projectMessages: (
    channelId: string,
    messages: MessageResource[],
  ) => Promise<ChatMessage[]>;
  session: Session;
};

export function useCommunityThreadRootLabels({
  channels,
  communityId,
  projectMessages,
  session,
}: UseCommunityThreadRootLabelsOptions): {
  add: (labels: Record<string, string>) => void;
  hiddenKeys: Set<string>;
  hide: (keys: string[]) => void;
  labels: Record<string, string>;
  reveal: (channelId: string, rootMessageId: string) => void;
} {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const unresolvedKeysRef = useRef(new Set<string>());
  const applyLoadedRoots = useCallback(
    (result: Awaited<ReturnType<CommunityThreadRootLabelLoader['load']>>) => {
      for (const key of result.unresolvedKeys) {
        unresolvedKeysRef.current.add(key);
      }

      if (result.hiddenKeys.length > 0) {
        setHiddenKeys((current) =>
          CommunityChannelThreadCache.addLabelKeys(current, result.hiddenKeys),
        );
      }

      if (Object.keys(result.labels).length > 0) {
        setLabels((current) =>
          CommunityThreadRootLabels.merge(current, result.labels),
        );
      }
    },
    [],
  );

  useEffect(() => {
    setHiddenKeys(new Set());
    setLabels({});
    unresolvedKeysRef.current.clear();
  }, [communityId]);

  useEffect(() => {
    const unresolvedKeys = unresolvedKeysRef.current;
    const missingRoots = CommunityThreadRootLabels.missing(
      channels,
      labels,
      unresolvedKeys,
    );

    if (missingRoots.length === 0) return undefined;

    let cancelled = false;

    const loader = new CommunityThreadRootLabelLoader(
      communityId,
      session,
      projectMessages,
    );

    void loader
      .load(missingRoots, () => cancelled)
      .then((result) => {
        if (!cancelled) applyLoadedRoots(result);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    applyLoadedRoots,
    channels,
    communityId,
    labels,
    projectMessages,
    session,
  ]);

  const reveal = useCallback((channelId: string, rootMessageId: string) => {
    const key = threadRootLabelKey(channelId, rootMessageId);

    setHiddenKeys((current) => {
      if (!current.has(key)) return current;

      const next = new Set(current);

      next.delete(key);

      return next;
    });
  }, []);

  const hide = useCallback((keys: string[]) => {
    setHiddenKeys((current) =>
      CommunityChannelThreadCache.addLabelKeys(current, keys),
    );
  }, []);

  const add = useCallback((nextLabels: Record<string, string>) => {
    setLabels((current) =>
      CommunityThreadRootLabels.merge(current, nextLabels),
    );
  }, []);

  return { add, hiddenKeys, hide, labels, reveal };
}
