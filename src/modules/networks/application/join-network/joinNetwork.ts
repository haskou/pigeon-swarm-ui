import type { JoinNetworkPort } from '../ports/joinNetworkPort';

import { JoinNetworkMessage } from './messages/joinNetworkMessage';

export class JoinNetwork {
  public constructor(private readonly networks: JoinNetworkPort) {}

  public async join(message: JoinNetworkMessage): Promise<void> {
    await this.networks.joinNetwork(
      message.getId(),
      message.getName(),
      message.getKey(),
    );
  }
}
