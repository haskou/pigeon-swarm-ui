import { KeyPair, SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type { IdentityResource } from '../../../../../shared/domain/pigeonResources.types';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityMailboxHomeVerifier } from '../../../../../contexts/identities/infrastructure/http/IdentityMailboxHomeVerifier';
import { IdentitySignaturePayloadFactory } from '../../../../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';

const HOME = 'https://home.example';

type UnsignedIdentity = Omit<IdentityResource, 'signature'>;

function publish(
  keyPair: KeyPair,
  unsigned: UnsignedIdentity,
): IdentityResource {
  return {
    ...unsigned,
    signature: keyPair.sign(JSON.stringify(unsigned)).toString(),
  };
}

async function fixture(
  mailboxHome?: string,
  commitment?: (deviceCredential: string) => string,
) {
  const keyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();
  const deviceCredential = (await KeyPair.generate()).toPrimitives().publicKey;
  const unsigned = await new IdentitySignaturePayloadFactory(
    mailboxHome,
  ).createInitial({
    deviceCredential,
    deviceCredentialCommitment:
      commitment?.(deviceCredential) ??
      SHA256Hash.from(new StringValueObject(deviceCredential)).valueOf(),
    id,
    networks: [],
    profile: { name: 'Ada' },
    recoveryAuthority: (await KeyPair.generate()).toPrimitives().publicKey,
    timestamp: 1,
  });

  return {
    id,
    identity: publish(keyPair, unsigned),
    keyPair,
    unsigned,
  };
}

describe(IdentityMailboxHomeVerifier.name, () => {
  it('returns the base when the identity signature covers it', async () => {
    const { id, identity } = await fixture(HOME);

    expect(IdentityMailboxHomeVerifier.verifiedBase(id, identity)).toBe(HOME);
  });

  it('returns a path-prefixed base the identity signature covers', async () => {
    const { id, identity } = await fixture(`${HOME}/api`);

    expect(IdentityMailboxHomeVerifier.verifiedBase(id, identity)).toBe(
      `${HOME}/api`,
    );
  });

  it('rejects a mailbox home altered after signing', async () => {
    const { id, identity } = await fixture(HOME);

    expect(
      IdentityMailboxHomeVerifier.verifiedBase(id, {
        ...identity,
        mailboxHome: 'https://attacker.example',
      }),
    ).toBeUndefined();
  });

  it('rejects a document served for another identity', async () => {
    const { identity } = await fixture(HOME);
    const other = await fixture();

    expect(
      IdentityMailboxHomeVerifier.verifiedBase(other.id, identity),
    ).toBeUndefined();
  });

  it('rejects a device credential whose commitment does not match', async () => {
    const { id, identity } = await fixture(HOME, () => 'forged-commitment');

    expect(
      IdentityMailboxHomeVerifier.verifiedBase(id, identity),
    ).toBeUndefined();
  });

  it('rejects a signed base that fails host validation', async () => {
    const { id, keyPair, unsigned } = await fixture();
    const identity = publish(keyPair, {
      ...unsigned,
      mailboxHome: 'https://10.0.0.5',
    });

    expect(
      IdentityMailboxHomeVerifier.verifiedBase(id, identity),
    ).toBeUndefined();
  });

  it('returns undefined when no mailbox home is published', async () => {
    const { id, identity } = await fixture();

    expect(
      IdentityMailboxHomeVerifier.verifiedBase(id, identity),
    ).toBeUndefined();
  });

  it('fails closed when the document carries no signature', async () => {
    const { id, identity } = await fixture(HOME);

    expect(
      IdentityMailboxHomeVerifier.verifiedBase(id, {
        ...identity,
        signature: '',
      }),
    ).toBeUndefined();
  });

  it('returns undefined instead of throwing on a malformed signature', async () => {
    const { id, identity } = await fixture(HOME);

    expect(() =>
      IdentityMailboxHomeVerifier.verifiedBase(id, {
        ...identity,
        signature: 'not-a-signature',
      }),
    ).not.toThrow();
    expect(
      IdentityMailboxHomeVerifier.verifiedBase(id, {
        ...identity,
        signature: 'not-a-signature',
      }),
    ).toBeUndefined();
  });

  it('accepts the document after a JSON round trip, as a node serves it', async () => {
    const { id, identity } = await fixture(HOME);
    const served = JSON.parse(JSON.stringify(identity)) as IdentityResource;

    expect(IdentityMailboxHomeVerifier.verifiedBase(id, served)).toBe(HOME);
  });
});
