import type {
  IpfsReplicationStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NodeRelayConfiguration } from '../configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from '../configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from '../configure-node-relay/NodeRelayPortCheckTarget';
import type { NodeNetwork } from '../list-node-networks/NodeNetwork';
import type { Peer } from '../list-peers/Peer';

export interface NodeApplicationPort {
  getInfo(): Promise<{ id: string; owner: string | null }>;
  claim(session: Session): Promise<void>;
  getNetworks(session?: Session): Promise<NodeNetwork[]>;
  getPeers(): Promise<Peer[]>;
  getIpfsReplicationStatus(session: Session): Promise<IpfsReplicationStatus>;
  getRelayConfiguration(session: Session): Promise<NodeRelayConfiguration>;
  updateRelayConfiguration(
    configuration: NodeRelayConfiguration,
    session?: Session,
  ): Promise<NodeRelayConfiguration>;
  checkRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource>;
  createNetwork(name: string, session?: Session): Promise<void>;
  createPublicNetwork(session?: Session): Promise<void>;
  joinNetwork(
    id: string,
    name: string,
    key: string,
    session?: Session,
  ): Promise<void>;
  removeNetwork(networkId: string, session?: Session): Promise<NodeNetwork[]>;
}
