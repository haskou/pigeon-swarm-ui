import { useCallback, useEffect, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

type NodeNetworksState = {
  error: Error | null;
  loading: boolean;
  node: { id: string; owner: string | null } | null;
  networks: NodeNetwork[];
  reload: () => Promise<void>;
};

export function useNodeNetworks(session?: Session | null): NodeNetworksState {
  const [networks, setNetworks] = useState<NodeNetwork[]>([]);
  const [node, setNode] = useState<{ id: string; owner: string | null } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nodeInfo, nodeNetworks] = await Promise.all([
        pigeonApplication.getNodeInfo(),
        pigeonApplication.listNodeNetworks(session ?? undefined),
      ]);

      setNode(nodeInfo);
      setNetworks(nodeNetworks);
    } catch (caught) {
      setError(new Error(toUserErrorMessage(caught, copy.nodeSettings.error)));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { error, loading, networks, node, reload };
}
