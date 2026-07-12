import type { ListNodeNetworksPort } from './ListNodeNetworksPort';
import type { NodeNetwork } from './NodeNetwork';

import { ListNodeNetworksMessage } from './messages/ListNodeNetworksMessage';

export class ListNodeNetworks {
  public constructor(private readonly networks: ListNodeNetworksPort) {}

  public async list(message: ListNodeNetworksMessage): Promise<NodeNetwork[]> {
    return await this.networks.getNodeNetworks(message.getSession());
  }
}

export type { NodeNetwork };
