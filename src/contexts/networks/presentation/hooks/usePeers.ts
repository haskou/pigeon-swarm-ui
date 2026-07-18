import { useCallback, useEffect, useState } from 'react';

import type { Peer } from '../../application/list-peers/Peer';
import type { NodePeersSnapshot } from '../../infrastructure/http/NodePeersSnapshot';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { NodeBootstrapApi } from '../../infrastructure/http/NodeBootstrapApi';

const nodeBootstrapApi = new NodeBootstrapApi();

type PeersState = {
  error: Error | null;
  ipfsPeerCount: number;
  loading: boolean;
  networkSynchronizationStatus: NodePeersSnapshot['networkSynchronization'];
  peers: Peer[];
  reload: () => Promise<void>;
};

type UsePeersInput = {
  autoLoad?: boolean;
  deferAutoLoad?: boolean;
};

export function usePeers({
  autoLoad = true,
  deferAutoLoad = false,
}: UsePeersInput = {}): PeersState {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [ipfsPeerCount, setIpfsPeerCount] = useState(0);
  const [networkSynchronizationStatus, setNetworkSynchronizationStatus] =
    useState<NodePeersSnapshot['networkSynchronization']>(null);
  const [loading, setLoading] = useState(autoLoad && !deferAutoLoad);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const snapshot = await nodeBootstrapApi.getPeerSnapshot();

      setIpfsPeerCount(snapshot.ipfsPeers.length);
      setNetworkSynchronizationStatus(snapshot.networkSynchronization);
      setPeers(snapshot.peers);
    } catch (caught) {
      setError(new Error(toUserErrorMessage(caught, copy.peers.error)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) return;

    if (!deferAutoLoad) {
      void reload();

      return;
    }

    return runWhenBrowserIdle(() => void reload());
  }, [autoLoad, deferAutoLoad, reload]);

  return {
    error,
    ipfsPeerCount,
    loading,
    networkSynchronizationStatus,
    peers,
    reload,
  };
}
