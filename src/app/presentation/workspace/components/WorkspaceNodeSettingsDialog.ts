import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type { NetworkSynchronizationStatus } from '../../../../contexts/networks/presentation/view-models/NetworkSynchronizationStatus';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { Peer } from '../../../../contexts/networks/presentation/view-models/Peer';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceNodeSettingsDialog = {
  networkSynchronizationStatus: NetworkSynchronizationStatus | null;
  networks: NodeNetwork[];
  node: (NodeInfo & { owner: null | string }) | null;
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  open: boolean;
  peers: Peer[];
  peersLoading: boolean;
  session: Session;
};
