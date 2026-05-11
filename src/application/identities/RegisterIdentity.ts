import type { LoginResult } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

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
