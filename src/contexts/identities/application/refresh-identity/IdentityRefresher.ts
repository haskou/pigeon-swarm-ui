import type { Identity } from '../../domain/Identity';
import type { IdentityRepository } from '../../domain/repositories/IdentityRepository';

import { RefreshIdentityMessage } from './messages/RefreshIdentityMessage';

export class IdentityRefresher {
  public constructor(private readonly identityRepository: IdentityRepository) {}

  public async refresh(message: RefreshIdentityMessage): Promise<Identity> {
    return await this.identityRepository.refresh(message.getIdentityId());
  }
}
