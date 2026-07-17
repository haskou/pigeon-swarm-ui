import type { IdentityIdFactory } from '../../domain/IdentityIdFactory';
import type { IdentityRepository } from '../../domain/repositories/IdentityRepository';

import { Identity } from '../../domain/Identity';
import { RegisterIdentityMessage } from './messages/RegisterIdentityMessage';

export class RegisterIdentity {
  public constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly identityIdFactory: IdentityIdFactory,
  ) {}

  public async register(message: RegisterIdentityMessage): Promise<Identity> {
    const protection = message.getProtection();

    protection.assertRegistrationReady();
    const identity = Identity.create(
      await this.identityIdFactory.create(),
      message.getProfile(),
      message.getNetworkMemberships(),
      message.getOccurredAt(),
    );

    return await this.identityRepository.create(identity, protection);
  }
}
