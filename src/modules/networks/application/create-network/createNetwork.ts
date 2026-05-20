import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export class CreateNetwork {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(name: string): Promise<void> {
    await this.gateway.createNetwork(name);
  }
}
