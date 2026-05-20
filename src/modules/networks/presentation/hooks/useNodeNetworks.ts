import { useCallback, useEffect, useState } from 'react';

import type { NodeNetwork } from '../../application/list-node-networks/listNodeNetworks';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { pigeonApplication } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/en';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

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
      const nodeInfo = await pigeonApplication.getNodeInfo();

      setNode(nodeInfo);
      try {
        setNetworks(
          await pigeonApplication.listNodeNetworks(session ?? undefined),
        );
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
