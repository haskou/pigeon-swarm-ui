import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export type NodeNetwork = {
  id: string;
  key?: string | null;
  name: string;
};

export class ListNodeNetworks {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(session?: Session): Promise<NodeNetwork[]> {
    return await this.gateway.getNodeNetworks(session);
  }
}
