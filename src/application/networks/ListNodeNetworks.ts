import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export type NodeNetwork = {
  id: string;
  key?: string | null;
  name: string;
};

export class ListNodeNetworks {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(): Promise<NodeNetwork[]> {
    return await this.gateway.getNodeNetworks();
  }
}
