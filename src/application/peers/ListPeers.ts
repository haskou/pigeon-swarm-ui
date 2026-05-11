import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export type PeerNetwork = {
  id: string;
  name: string;
};

export type Peer = {
  id: string;
  lastSeenAt: number;
  networks: PeerNetwork[];
  owner?: string;
};

export class ListPeers {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(): Promise<Peer[]> {
    return await this.gateway.getPeers();
  }
}
