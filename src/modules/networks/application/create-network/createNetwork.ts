import type { CreateNetworkPort } from '../ports/createNetworkPort';

import { CreateNetworkMessage } from './messages/createNetworkMessage';

export class CreateNetwork {
  public constructor(private readonly networks: CreateNetworkPort) {}

  public async create(message: CreateNetworkMessage): Promise<void> {
    await this.networks.create(message.getName());
  }
}
