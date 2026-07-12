import type { Peer } from './listPeers.types';
import type { ListPeersPort } from './ListPeersPort';

import { ListPeersMessage } from './messages/ListPeersMessage';

export class ListPeers {
  public constructor(private readonly peers: ListPeersPort) {}

  public async list(message: ListPeersMessage): Promise<Peer[]> {
    void message;

    return await this.peers.getPeers();
  }
}

export type { Peer };
