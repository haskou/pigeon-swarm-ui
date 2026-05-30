import { useCallback, useEffect, useState } from 'react';

import type { Peer } from '../../application/list-peers/ListPeers';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { NodeBootstrapApi } from '../../infrastructure/http/NodeBootstrapApi';

const nodeBootstrapApi = new NodeBootstrapApi();

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
      setPeers(await nodeBootstrapApi.getPeers());
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
