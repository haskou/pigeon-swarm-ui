import { useCallback, useEffect, useState } from 'react';

import type { Peer } from '../../application/peers/ListPeers';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

type PeersState = {
  error: Error | null;
  loading: boolean;
  peers: Peer[];
  reload: () => Promise<void>;
};

export function usePeers(): PeersState {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPeers(await pigeonApplication.listPeers());
    } catch (caught) {
      setError(new Error(toUserErrorMessage(caught, copy.peers.error)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { error, loading, peers, reload };
}
