import type { Identity } from '../../domain/Identity';
import type { IdentityUnlockRepository } from '../../domain/repositories/IdentityUnlockRepository';

import { RestoreRememberedIdentityMessage } from './messages/RestoreRememberedIdentityMessage';

export class RememberedIdentityRestorer {
  public constructor(
    private readonly identityUnlockRepository: IdentityUnlockRepository,
  ) {}

  public async restore(
    message: RestoreRememberedIdentityMessage,
  ): Promise<Identity> {
    return await this.identityUnlockRepository.restore(message.getIdentityId());
  }
}
