import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityResource as Community } from '../../infrastructure/http/resources/CommunityResource';

import { loadApplicationContainer } from '../../../../app/composition/loadApplicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import {
  forgetCommunitiesSeen,
  rememberCommunitiesSeen,
} from '../../infrastructure/storage/communitiesSeen';
import { CommunityList } from '../view-models/CommunityList';
import { CommunityListLoads } from './CommunityListLoads';
import { loadCommunityList } from './loadCommunityList';

type CommunitiesState = {
  communities: Community[];
  /**
   * Set while the node keeps answering an empty list for an identity this
   * device listed communities for: forgets that this device saw any and reads
   * the list again, which then settles an empty list.
   */
  continueWithoutCommunities: (() => Promise<void>) | null;
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
  const [notSettled, setNotSettled] = useState(false);
  const [loadedIdentityId, setLoadedIdentityId] = useState<string | null>(null);

  const sessionIdentityId = session?.identity.id ?? null;
  const loads = useRef(new CommunityListLoads());
  const currentIdentityId = useRef<string | null>(null);

  currentIdentityId.current = sessionIdentityId;
  const rememberCommunities = useCallback(
    (next: SetStateAction<Community[]>) => {
      setCommunities((current) => {
        const resolved =
          typeof next === 'function'
            ? (next as (current: Community[]) => Community[])(current)
            : next;
        const uniqueCommunities = CommunityList.withUniqueIds(resolved);

        if (sessionIdentityId) {
          // A change that lands after the session ended must not recreate the
          // flag the device erase just removed.
          if (currentIdentityId.current !== sessionIdentityId) {
            return uniqueCommunities;
          }

          if (uniqueCommunities.length > 0) {
            rememberCommunitiesSeen(sessionIdentityId);
          } else {
            forgetCommunitiesSeen(sessionIdentityId);
          }

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
      loads.current.cancel();
      setCommunities([]);
      setLoadedIdentityId(null);
      setLoading(false);

      return;
    }

    const identityId = session.identity.id;
    const load = loads.current.begin(identityId);
    const cached = cachedCommunitiesFor(identityId);

    if (cached) {
      setCommunities(CommunityList.withUniqueIds(cached));
      setLoadedIdentityId(identityId);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(null);
    setNotSettled(false);

    let applicationContainer: Awaited<
      ReturnType<typeof loadApplicationContainer>
    >;

    try {
      applicationContainer = await loadApplicationContainer();
    } catch (caught) {
      if (load.isCurrent()) {
        if (!cached) {
          setError(
            new Error(toUserErrorMessage(caught, copy.communities.loadError)),
          );
        }
        setLoadedIdentityId(identityId);
        setLoading(false);
      }

      return;
    }

    await loadCommunityList<Community>({
      load,
      onFailed: (caught) => {
        if (!cached) {
          setError(
            new Error(toUserErrorMessage(caught, copy.communities.loadError)),
          );
        }

        setLoadedIdentityId(identityId);
        setLoading(false);
      },
      onSettled: (nextCommunities) => {
        rememberCommunities((current) =>
          CommunityList.preservingVoicePresence(nextCommunities, current),
        );
        setLoadedIdentityId(identityId);
        setLoading(false);
      },
      onUnsettled: () => {
        if (!cached) {
          setError(new Error(copy.communities.notSettled));
          setNotSettled(true);
        }

        setLoadedIdentityId(identityId);
        setLoading(false);
      },
      read: async (signal) =>
        await applicationContainer.communities.list(session, { signal }),
    });
  }, [rememberCommunities, session]);

  const continueWithoutCommunities = useCallback(async () => {
    if (!sessionIdentityId) return;

    forgetCommunitiesSeen(sessionIdentityId);
    await reload();
  }, [reload, sessionIdentityId]);

  useEffect(() => {
    void reload();

    return () => {
      loads.current.cancel();
    };
  }, [reload]);

  return {
    communities,
    continueWithoutCommunities: notSettled ? continueWithoutCommunities : null,
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
