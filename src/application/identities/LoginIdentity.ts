import type { LoginResult } from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class LoginIdentity {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    identityId: string,
    password: string,
  ): Promise<LoginResult> {
    return await this.gateway.login(identityId, password);
  }
}
