import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';

import { DeviceAuthorization } from '../../../identities/domain/DeviceAuthorization';
import { DeviceCredential } from '../../../identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { RecoveryAuthority } from '../../../identities/domain/value-objects/RecoveryAuthority';
import { IdentityMailboxHomeVerifier } from '../../../identities/infrastructure/http/IdentityMailboxHomeVerifier';
import { CallSignalRefusedError } from './CallSignalRefusedError';

/**
 * The genesis authorization of a signal's sender: the device credential its
 * identity commitment binds and its recovery authority, read from the
 * identity record only once that record is proven to be the requested
 * identity's, signed by its own key.
 */
export class PigeonCallSignalGenesisReader {
  public constructor(
    private readonly identities: {
      get(identityId: string): Promise<IdentityResource>;
    },
  ) {}

  public async genesis(identityId: string): Promise<DeviceAuthorization> {
    const identity = await this.identities.get(identityId);

    if (!IdentityMailboxHomeVerifier.isTrusted(identityId, identity)) {
      throw new CallSignalRefusedError('chain-unverified');
    }

    return DeviceAuthorization.genesis(
      IdentityId.fromString(identityId),
      DeviceCredential.fromString(identity.deviceCredential),
      RecoveryAuthority.fromString(identity.recoveryAuthority),
    );
  }
}
