import type { Identity } from '../../domain/Identity';
import type { IdentityRepository } from '../../domain/repositories/IdentityRepository';

import { FindIdentityMessage } from './messages/FindIdentityMessage';

export class IdentityFinder {
  public constructor(private readonly identityRepository: IdentityRepository) {}

  public async find(message: FindIdentityMessage): Promise<Identity> {
    return await this.identityRepository.find(message.getIdentityId());
  }
}
