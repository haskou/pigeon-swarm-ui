import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import { DevicePairingInvitation } from '../../../../contexts/identities/domain/DevicePairingInvitation';
import { DevicePairingRequest } from '../../../../contexts/identities/domain/DevicePairingRequest';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DevicePairingCode } from '../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../contexts/identities/domain/value-objects/PairingId';
import { thrownPairingFailure } from './thrownPairingFailure';

describe(DevicePairingRequest.name, () => {
  async function invitation(expiresAt = 2_000) {
    const identity = await KeyPair.generate();

    return DevicePairingInvitation.create({
      author: await KeyPair.generate(),
      epoch: DeviceAuthorizationEpoch.genesis(),
      expiresAt: new Timestamp(expiresAt),
      identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
      pairingId: PairingId.generate(),
      revision: DeviceAuthorizationRevision.fromNumber(3),
    });
  }

  async function draft() {
    return await DevicePairingRequest.create(
      await invitation(),
      new Timestamp(1_000),
    );
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

    expect(
      thrownPairingFailure(() =>
        DevicePairingRequest.fromCode(
          DevicePairingCode.encode({
            ...resource,
            transportPublicKey: attacker.toPrimitives().publicKey,
          }),
          new Timestamp(1_100),
        ),
      ),
    ).toBe('invalid');
  });

  it('reports a request accepted after the invitation expired as expired', async () => {
    const source = await draft();

    expect(
      thrownPairingFailure(() =>
        DevicePairingRequest.fromCode(
          source.getRequest().toCode(),
          new Timestamp(2_001),
        ),
      ),
    ).toBe('expired');
  });

  it('shows a different verification code on each device that answers one invitation', async () => {
    const shared = await invitation();
    const first = await DevicePairingRequest.create(
      shared,
      new Timestamp(1_000),
    );
    const second = await DevicePairingRequest.create(
      shared,
      new Timestamp(1_000),
    );

    expect(await second.getRequest().getVerificationCode()).not.toBe(
      await first.getRequest().getVerificationCode(),
    );
  });

  it('rejects a request claiming authorization beyond the allowed clock skew', async () => {
    const source = await DevicePairingRequest.create(
      await invitation(100_000),
      new Timestamp(31_001),
    );

    expect(
      thrownPairingFailure(() =>
        DevicePairingRequest.fromCode(
          source.getRequest().toCode(),
          new Timestamp(1_000),
        ),
      ),
    ).toBe('invalid');
  });
});
