import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class JoinNetwork {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(id: string, name: string, key: string): Promise<void> {
    await this.gateway.joinNetwork(id, name, key);
  }
}
