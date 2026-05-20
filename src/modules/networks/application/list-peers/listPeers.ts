import type { ListPeersPort } from '../ports/listPeersPort';
import type { Peer } from './listPeers.types';

import { ListPeersMessage } from './messages/listPeersMessage';

export class ListPeers {
  public constructor(private readonly peers: ListPeersPort) {}

  public async list(message: ListPeersMessage): Promise<Peer[]> {
    void message;

    return await this.peers.getPeers();
  }
}

export type { Peer };
