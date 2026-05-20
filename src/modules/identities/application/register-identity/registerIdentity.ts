import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { RegisterIdentityPort } from '../ports/registerIdentityPort';

import { RegisterIdentityMessage } from './messages/registerIdentityMessage';

export class RegisterIdentity {
  public constructor(private readonly identities: RegisterIdentityPort) {}

  public async register(
    message: RegisterIdentityMessage,
  ): Promise<LoginResult> {
    return await this.identities.register(
      message.getName(),
      message.getPassword(),
      message.getNetworks(),
      message.getHandle(),
    );
  }
}
