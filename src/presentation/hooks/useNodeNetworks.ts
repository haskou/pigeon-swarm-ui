import { useCallback, useEffect, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';

import { pigeonApplication } from '../../application/applicationContainer';

type NodeNetworksState = {
  error: Error | null;
  loading: boolean;
  networks: NodeNetwork[];
  reload: () => Promise<void>;
};

export function useNodeNetworks(): NodeNetworksState {
  const [networks, setNetworks] = useState<NodeNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setNetworks(await pigeonApplication.listNodeNetworks());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught
          : new Error('Unable to load node networks'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { error, loading, networks, reload };
}
