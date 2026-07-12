import { useCallback, useEffect, useState } from 'react';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NodeNetwork } from '../../application/list-node-networks/ListNodeNetworks';
import type { NodeInfo } from '../../infrastructure/http/NodeInfo';

import { loadApplicationContainer } from '../../../../app/composition/loadApplicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { NodeBootstrapApi } from '../../infrastructure/http/NodeBootstrapApi';

const nodeBootstrapApi = new NodeBootstrapApi();

type NodeNetworksState = {
  error: Error | null;
  loading: boolean;
  node: (NodeInfo & { owner: string | null }) | null;
  networks: NodeNetwork[];
  reload: () => Promise<void>;
};

export function useNodeNetworks(session?: Session | null): NodeNetworksState {
  const [networks, setNetworks] = useState<NodeNetwork[]>([]);
  const [node, setNode] = useState<
    (NodeInfo & { owner: string | null }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nodeInfo = await nodeBootstrapApi.getInfo();

      setNode(nodeInfo);
      try {
        if (session) {
          const applicationContainer = await loadApplicationContainer();

          setNetworks(await applicationContainer.networks.list(session));

          return;
        }

        setNetworks(await nodeBootstrapApi.getNetworks());
      } catch {
        setNetworks([]);
      }
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
