import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

export class RegisterIdentity {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
  ): Promise<LoginResult> {
    return await this.gateway.register(name, password, networks, handle);
  }
}
