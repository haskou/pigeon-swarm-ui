import type { ListNodeNetworksPort } from '../ports/listNodeNetworksPort';
import type { NodeNetwork } from './listNodeNetworks.types';

import { ListNodeNetworksMessage } from './messages/listNodeNetworksMessage';

export class ListNodeNetworks {
  public constructor(private readonly networks: ListNodeNetworksPort) {}

  public async list(message: ListNodeNetworksMessage): Promise<NodeNetwork[]> {
    return await this.networks.getNodeNetworks(message.getSession());
  }
}

export type { NodeNetwork };
