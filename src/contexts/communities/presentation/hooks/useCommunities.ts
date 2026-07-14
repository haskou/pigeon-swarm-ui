import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { loadApplicationContainer } from '../../../../app/composition/loadApplicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { CommunityList } from '../view-models/CommunityList';

type CommunitiesState = {
  communities: Community[];
  error: Error | null;
  loading: boolean;
  reload: () => Promise<void>;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
};

type CommunityCacheEntry = {
  communities: Community[];
  storedAt: number;
};

const COMMUNITY_CACHE_TTL_MS = 15_000;
const communityCacheByIdentityId = new Map<string, CommunityCacheEntry>();

export function useCommunities(session?: null | Session): CommunitiesState {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadedIdentityId, setLoadedIdentityId] = useState<string | null>(null);

  const sessionIdentityId = session?.identity.id ?? null;
  const rememberCommunities = useCallback(
    (next: SetStateAction<Community[]>) => {
      setCommunities((current) => {
        const resolved =
          typeof next === 'function'
            ? (next as (current: Community[]) => Community[])(current)
            : next;
        const uniqueCommunities = CommunityList.withUniqueIds(resolved);

        if (sessionIdentityId) {
          communityCacheByIdentityId.set(sessionIdentityId, {
            communities: uniqueCommunities,
            storedAt: Date.now(),
          });
        }

        return uniqueCommunities;
      });
    },
    [sessionIdentityId],
  );

  const reload = useCallback(async () => {
    if (!session) {
      setCommunities([]);
      setLoadedIdentityId(null);
      setLoading(false);

      return;
    }

    const identityId = session.identity.id;
    const cached = cachedCommunitiesFor(identityId);

    if (cached) {
      setCommunities(CommunityList.withUniqueIds(cached));
      setLoadedIdentityId(identityId);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const applicationContainer = await loadApplicationContainer();
      const nextCommunities =
        await applicationContainer.communities.list(session);

      rememberCommunities((current) =>
        CommunityList.preservingVoicePresence(nextCommunities, current),
      );
      setLoadedIdentityId(identityId);
    } catch (caught) {
      if (!cached) {
        setError(
          new Error(toUserErrorMessage(caught, copy.communities.loadError)),
        );
      }

      setLoadedIdentityId(identityId);
    } finally {
      setLoading(false);
    }
  }, [rememberCommunities, session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    communities,
    error,
    loading:
      loading ||
      (!!sessionIdentityId && loadedIdentityId !== sessionIdentityId && !error),
    reload,
    setCommunities: rememberCommunities,
  };
}

function cachedCommunitiesFor(identityId: string): Community[] | null {
  const entry = communityCacheByIdentityId.get(identityId);

  if (!entry) return null;

  if (Date.now() - entry.storedAt > COMMUNITY_CACHE_TTL_MS) {
    communityCacheByIdentityId.delete(identityId);

    return null;
  }

  const communities = CommunityList.withUniqueIds(entry.communities);

  if (communities !== entry.communities) {
    communityCacheByIdentityId.set(identityId, {
      communities,
      storedAt: entry.storedAt,
    });
  }

  return communities;
}
