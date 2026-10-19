import { useCallback, useEffect, useState } from 'react';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NodeInfo } from '../../infrastructure/http/NodeInfo';
import type { NodeNetwork } from '../../presentation/view-models/NodeNetwork';

import { loadApplicationContainer } from '../../../../app/composition/loadApplicationContainer';
import { nodeBootstrapApi } from '../../../../app/composition/nodeBootstrapApi';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { loadNodeNetworkList } from '../../presentation/view-models/nodeNetworksLoad';

type NodeNetworksState = {
  error: Error | null;
  loading: boolean;
  networks: NodeNetwork[];
  networksError: boolean;
  node: (NodeInfo & { owner: string | null }) | null;
  reload: () => Promise<void>;
};

export function useNodeNetworks(session?: Session | null): NodeNetworksState {
  const [networks, setNetworks] = useState<NodeNetwork[]>([]);
  const [networksError, setNetworksError] = useState(false);
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

      const list = await loadNodeNetworkList(async () => {
        if (session) {
          const applicationContainer = await loadApplicationContainer();

          return applicationContainer.networks.list(session);
        }

        return nodeBootstrapApi.getNetworks();
      });

      setNetworks(list.networks);
      setNetworksError(list.failed);
    } catch (caught) {
      setNetworks([]);
      setNetworksError(true);
      setError(new Error(toUserErrorMessage(caught, copy.nodeSettings.error)));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { error, loading, networks, networksError, node, reload };
}
