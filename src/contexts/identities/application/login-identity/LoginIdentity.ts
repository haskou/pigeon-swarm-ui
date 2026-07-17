import type { Identity } from '../../domain/Identity';
import type { IdentityUnlockRepository } from '../../domain/repositories/IdentityUnlockRepository';

import { LoginIdentityMessage } from './messages/LoginIdentityMessage';

export class LoginIdentity {
  public constructor(
    private readonly identityUnlockRepository: IdentityUnlockRepository,
  ) {}

  public async login(message: LoginIdentityMessage): Promise<Identity> {
    return await this.identityUnlockRepository.unlock(
      message.getIdentityId(),
      message.getProtection(),
    );
  }
}
