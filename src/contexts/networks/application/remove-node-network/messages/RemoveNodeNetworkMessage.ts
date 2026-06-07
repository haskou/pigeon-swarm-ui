import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { NetworkId } from '../../../domain/value-objects/NetworkId';

export class RemoveNodeNetworkMessage {
  private readonly networkId: NetworkId;

  private readonly session?: Session;

  public constructor(input: { networkId: string; session?: Session }) {
    this.networkId = NetworkId.fromString(input.networkId);
    this.session = input.session;
  }

  public getNetworkId(): NetworkId {
    return this.networkId;
  }

  public getSession(): Session | undefined {
    return this.session;
  }
}
