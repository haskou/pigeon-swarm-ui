import type { NodeNetwork } from '../list-node-networks/NodeNetwork';
import type { RemoveNodeNetworkPort } from '../ports/RemoveNodeNetworkPort';

import { RemoveNodeNetworkMessage } from './messages/RemoveNodeNetworkMessage';

export class RemoveNodeNetwork {
  public constructor(private readonly networks: RemoveNodeNetworkPort) {}

  public async remove(
    message: RemoveNodeNetworkMessage,
  ): Promise<NodeNetwork[]> {
    return await this.networks.remove(
      message.getNetworkId(),
      message.getSession(),
    );
  }
}
