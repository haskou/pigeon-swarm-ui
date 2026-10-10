import type { IdentityUnlockRepository } from '../../domain/repositories/IdentityUnlockRepository';

import { ForgetDeviceUnlockMessage } from './messages/ForgetDeviceUnlockMessage';

export class DeviceUnlockForgetter {
  public constructor(
    private readonly identityUnlockRepository: IdentityUnlockRepository,
  ) {}

  public async forget(message: ForgetDeviceUnlockMessage): Promise<void> {
    await this.identityUnlockRepository.forget(message.getIdentityId());
  }
}
