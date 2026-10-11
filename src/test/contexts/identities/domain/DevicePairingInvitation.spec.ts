import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import { DevicePairingInvitation } from '../../../../contexts/identities/domain/DevicePairingInvitation';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DevicePairingCode } from '../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../contexts/identities/domain/value-objects/PairingId';
import { thrownPairingFailure } from './thrownPairingFailure';

describe(DevicePairingInvitation.name, () => {
  async function invitation() {
    const identity = await KeyPair.generate();

    return DevicePairingInvitation.create({
      author: await KeyPair.generate(),
      epoch: DeviceAuthorizationEpoch.genesis(),
      expiresAt: new Timestamp(2_000),
      identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
      pairingId: PairingId.generate(),
      revision: DeviceAuthorizationRevision.fromNumber(3),
    });
  }

  it('round-trips an authenticated unexpired invitation', async () => {
    const source = await invitation();
    const decoded = DevicePairingInvitation.fromCode(
      source.toCode(),
      new Timestamp(1_000),
    );

    expect(decoded.getPairingId().isEqual(source.getPairingId())).toBe(true);
    expect(decoded.getRevision().valueOf()).toBe(3);
  });

  it('rejects expiration and tampering', async () => {
    const source = await invitation();

    expect(
      thrownPairingFailure(() =>
        DevicePairingInvitation.fromCode(source.toCode(), new Timestamp(2_001)),
      ),
    ).toBe('expired');

    const resource = source.toCode().decode() as Record<string, unknown>;
    const tampered = DevicePairingCode.encode({ ...resource, revision: 4 });
    expect(
      thrownPairingFailure(() =>
        DevicePairingInvitation.fromCode(tampered, new Timestamp(1_000)),
      ),
    ).toBe('invalid');
  });
});
