import type { ContactDirectoryRepository } from '../../domain/repositories/ContactDirectoryRepository';
import type { DeviceMailboxRepository } from '../../domain/repositories/DeviceMailboxRepository';
import type { IdentityUnlockRepository } from '../../domain/repositories/IdentityUnlockRepository';
import type { OwnDeviceRepository } from '../../domain/repositories/OwnDeviceRepository';
import type { DeviceRetirement } from '../../domain/value-objects/DeviceRetirement';
import type { ForgetCurrentDeviceOutcome } from './ForgetCurrentDeviceOutcome';
import type { ForgetCurrentDeviceMessage } from './messages/ForgetCurrentDeviceMessage';

/**
 * Revokes this device's own credential first, so local state is removed only
 * after the node confirms the revocation. The node never revokes the only
 * credential of an identity: that case returns 'only-device' with nothing
 * changed, unless the user already confirmed. A confirmed forget of the only
 * device removes the local state alone, and keeps the device authorized and
 * its reader in place.
 * Local direct history, queued one-to-one sends and the contact directory are
 * wiped once the gate passes, even when the unlock removal fails.
 */
export class CurrentDeviceForgetter {
  public constructor(
    private readonly ownDeviceRepository: OwnDeviceRepository,
    private readonly deviceMailboxRepository: DeviceMailboxRepository,
    private readonly contactDirectoryRepository: ContactDirectoryRepository,
    private readonly identityUnlockRepository: IdentityUnlockRepository,
  ) {}

  public async forget(
    message: ForgetCurrentDeviceMessage,
  ): Promise<ForgetCurrentDeviceOutcome> {
    const identityId = message.getIdentityId();
    let retirement: DeviceRetirement;

    try {
      retirement = await this.ownDeviceRepository.retire(identityId);
    } catch {
      return 'revoke-failed';
    }

    if (retirement.isLastDevice()) {
      if (!message.getAllowOnlyDevice()) return 'only-device';
    } else {
      await this.deviceMailboxRepository.releaseReaders(identityId);
    }

    await this.deviceMailboxRepository.forgetHistory(identityId);
    await this.deviceMailboxRepository.forgetGroups(identityId);
    await this.deviceMailboxRepository.cancelOutbox(identityId);
    await this.contactDirectoryRepository.forget(identityId);

    try {
      await this.identityUnlockRepository.forget(identityId);
    } catch {
      return 'unlock-failed';
    }

    return 'forgotten';
  }
}
