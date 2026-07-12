import type { CreateNetworkPort } from './CreateNetworkPort';

import { CreateNetworkMessage } from './messages/CreateNetworkMessage';

export class CreateNetwork {
  public constructor(private readonly networks: CreateNetworkPort) {}

  public async create(message: CreateNetworkMessage): Promise<void> {
    await this.networks.create(message.getName());
  }
}
