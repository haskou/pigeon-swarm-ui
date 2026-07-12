import type { CreatePublicNetworkPort } from './CreatePublicNetworkPort';

import { CreatePublicNetworkMessage } from './messages/CreatePublicNetworkMessage';

export class CreatePublicNetwork {
  public constructor(private readonly networks: CreatePublicNetworkPort) {}

  public async create(message: CreatePublicNetworkMessage): Promise<void> {
    await this.networks.createPublic(message.getSession());
  }
}
