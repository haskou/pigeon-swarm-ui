import type { JoinNetworkPort } from '../ports/JoinNetworkPort';

import { JoinNetworkMessage } from './messages/JoinNetworkMessage';

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
