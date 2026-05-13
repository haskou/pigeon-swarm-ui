import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { Community, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

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

  const reload = useCallback(async () => {
    if (!session) {
      setCommunities([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setCommunities(await pigeonApplication.listCommunities(session));
    } catch (caught) {
      setError(
        new Error(toUserErrorMessage(caught, copy.communities.loadError)),
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { communities, error, loading, reload, setCommunities };
}
