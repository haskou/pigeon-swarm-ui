import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import { DevicePairingInvitation } from '../../../../contexts/identities/domain/DevicePairingInvitation';
import { DevicePairingRequest } from '../../../../contexts/identities/domain/DevicePairingRequest';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DevicePairingCode } from '../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../contexts/identities/domain/value-objects/PairingId';

describe(DevicePairingRequest.name, () => {
  async function draft() {
    const identity = await KeyPair.generate();
    const invitation = DevicePairingInvitation.create({
      author: await KeyPair.generate(),
      epoch: DeviceAuthorizationEpoch.genesis(),
      expiresAt: new Timestamp(2_000),
      identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
      pairingId: PairingId.generate(),
      revision: DeviceAuthorizationRevision.fromNumber(3),
    });

    return await DevicePairingRequest.create(invitation, new Timestamp(1_000));
  }

  it('authenticates the target credential and transport key', async () => {
    const source = await draft();
    const decoded = DevicePairingRequest.fromCode(
      source.getRequest().toCode(),
      new Timestamp(1_100),
    );

    expect(decoded.getProof().getCredential().valueOf()).toBe(
      source.getTargetKeyPair().toPrimitives().publicKey,
    );
    expect(decoded.getTransportPublicKey().valueOf()).toBe(
      source.getTransportKeyPair().toPrimitives().publicKey,
    );
  });

  it('derives the same verification code on both devices and a different one per request', async () => {
    const source = await draft();
    const other = await draft();
    const decoded = DevicePairingRequest.fromCode(
      source.getRequest().toCode(),
      new Timestamp(1_100),
    );

    const code = await source.getRequest().getVerificationCode();

    expect(code).toMatch(/^\d{5} \d{5}$/);
    expect(await decoded.getVerificationCode()).toBe(code);
    expect(await other.getRequest().getVerificationCode()).not.toBe(code);
  });

  it('rejects a substituted transport key', async () => {
    const source = await draft();
    const resource = source.getRequest().toCode().decode() as Record<
      string,
      unknown
    >;
    const attacker = await KeyPair.generate();

    expect(() =>
      DevicePairingRequest.fromCode(
        DevicePairingCode.encode({
          ...resource,
          transportPublicKey: attacker.toPrimitives().publicKey,
        }),
        new Timestamp(1_100),
      ),
    ).toThrow('Invalid or expired');
  });
});
