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

type CommunitiesState = {
  communities: Community[];
  error: Error | null;
  loading: boolean;
  reload: () => Promise<void>;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
};

export function useCommunities(session?: null | Session): CommunitiesState {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadedIdentityId, setLoadedIdentityId] = useState<string | null>(null);

  const sessionIdentityId = session?.identity.id ?? null;

  const reload = useCallback(async () => {
    if (!session) {
      setCommunities([]);
      setLoadedIdentityId(null);
      setLoading(false);

      return;
    }

    const identityId = session.identity.id;

    setLoading(true);
    setError(null);

    try {
      const applicationContainer = await loadApplicationContainer();

      setCommunities(await applicationContainer.listCommunities(session));
      setLoadedIdentityId(identityId);
    } catch (caught) {
      setError(
        new Error(toUserErrorMessage(caught, copy.communities.loadError)),
      );
      setLoadedIdentityId(identityId);
    } finally {
      setLoading(false);
    }
  }, [session]);

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
    setCommunities,
  };
}
