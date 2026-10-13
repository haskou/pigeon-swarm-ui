import { KeyPair, SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import { IdentityMailboxHomeTrust } from '../../../../contexts/identities/domain/IdentityMailboxHomeTrust';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';

const CONTENT = 'signed record';

async function claim() {
  const keyPair = await KeyPair.generate();
  const deviceCredential = (await KeyPair.generate()).toPrimitives().publicKey;
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();

  return {
    deviceCredential,
    deviceCredentialCommitment: SHA256Hash.from(
      new StringValueObject(deviceCredential),
    ).valueOf(),
    requestedId: id,
    servedId: id,
    signature: keyPair.sign(CONTENT).toString(),
    signedContent: CONTENT,
  };
}

describe(IdentityMailboxHomeTrust.name, () => {
  it('trusts an identity whose id, commitment, and signature all match', async () => {
    expect(IdentityMailboxHomeTrust.isTrusted(await claim())).toBe(true);
  });

  it('rejects an identity served for another id', async () => {
    const other = await claim();

    expect(
      IdentityMailboxHomeTrust.isTrusted({
        ...other,
        servedId: (await claim()).servedId,
      }),
    ).toBe(false);
  });

  it('rejects a device credential whose commitment does not match', async () => {
    const base = await claim();

    expect(
      IdentityMailboxHomeTrust.isTrusted({
        ...base,
        deviceCredential: (await KeyPair.generate()).toPrimitives().publicKey,
      }),
    ).toBe(false);
  });

  it('rejects a signature that does not cover the signed content', async () => {
    expect(
      IdentityMailboxHomeTrust.isTrusted({
        ...(await claim()),
        signedContent: 'altered record',
      }),
    ).toBe(false);
  });

  it('fails closed on a malformed requested id', async () => {
    expect(
      IdentityMailboxHomeTrust.isTrusted({
        ...(await claim()),
        requestedId: 'not-a-public-key',
      }),
    ).toBe(false);
  });

  it('trusts a served id in the PEM form of the requested id', async () => {
    const base = await claim();

    expect(
      IdentityMailboxHomeTrust.isTrusted({
        ...base,
        servedId: `-----BEGIN PUBLIC KEY-----\n${base.requestedId}\n-----END PUBLIC KEY-----\n`,
      }),
    ).toBe(true);
  });

  it('fails closed on a malformed commitment', async () => {
    expect(
      IdentityMailboxHomeTrust.isTrusted({
        ...(await claim()),
        deviceCredentialCommitment: 'not-a-hash',
      }),
    ).toBe(false);
  });
});
