import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';

import type { DeviceSealedSecretEntryResource } from '../../../../../contexts/identities/infrastructure/http/resources/DeviceSealedSecretResource';

import { DeviceSealedSecretPreimage } from '../../../../../contexts/identities/domain/DeviceSealedSecretPreimage';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceSealedSecretCipher } from '../../../../../contexts/identities/infrastructure/crypto/DeviceSealedSecretCipher';

describe(DeviceSealedSecretCipher.name, () => {
  const payload = 'fresh-mailbox-root-secret';

  async function fixture() {
    const identityKeyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    ).valueOf();
    const publisher = await KeyPair.generate();
    const recipient = await KeyPair.generate();
    const other = await KeyPair.generate();
    const outsider = await KeyPair.generate();
    const publisherCredential = DeviceCredential.fromString(
      publisher.toPrimitives().publicKey,
    ).valueOf();
    const entries = DeviceSealedSecretCipher.seal({
      authorizationRevision: 2,
      generation: 3,
      identityId,
      payload,
      publisher,
      recipients: [recipient, other].map((pair) =>
        DeviceCredential.fromString(pair.toPrimitives().publicKey),
      ),
    });

    function resourceFor(
      entry: DeviceSealedSecretEntryResource,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        authorizationRevision: 2,
        generation: 3,
        identityId,
        publisherCredential,
        recipientCredential: entry.recipientCredential,
        sealedSecret: entry.sealedSecret,
        signature: entry.signature,
        ...overrides,
      };
    }

    return {
      entries,
      identityId,
      other,
      outsider,
      publisherCredential,
      recipient,
      resourceFor,
    };
  }

  it('seals one entry per recipient and only that device opens it', async () => {
    const { entries, identityId, other, recipient, resourceFor } =
      await fixture();
    const [forRecipient, forOther] = entries;

    expect(entries).toHaveLength(2);
    expect(
      DeviceSealedSecretCipher.open({
        identityId,
        recipient,
        resource: resourceFor(forRecipient!),
      }),
    ).toEqual({ authorizationRevision: 2, generation: 3, payload });
    expect(() =>
      DeviceSealedSecretCipher.open({
        identityId,
        recipient: other,
        resource: resourceFor(forRecipient!),
      }),
    ).toThrow();
    expect(forOther!.sealedSecret).not.toContain(payload);
  });

  it('signs each entry over the preimage with the publisher device', async () => {
    const { entries, identityId, publisherCredential } = await fixture();
    const [entry] = entries;
    const preimage = DeviceSealedSecretPreimage.of({
      authorizationRevision: 2,
      generation: 3,
      identityId,
      publisherCredential,
      recipientCredential: entry!.recipientCredential,
      sealedSecret: entry!.sealedSecret,
    });

    expect(Object.keys(JSON.parse(preimage) as object)).toEqual([
      'purpose',
      'identityId',
      'generation',
      'authorizationRevision',
      'publisherCredential',
      'recipientCredential',
      'sealedSecret',
    ]);
    expect(
      DeviceCredential.fromString(publisherCredential)
        .getPublicKey()
        .isValidSignature(preimage, new Signature(entry!.signature)),
    ).toBe(true);
    expect(entry!.sealedSecret.length).toBeLessThanOrEqual(4096);
  });

  it('refuses an entry altered after it was signed', async () => {
    const { entries, identityId, recipient, resourceFor } = await fixture();

    expect(() =>
      DeviceSealedSecretCipher.open({
        identityId,
        recipient,
        resource: resourceFor(entries[0]!, { generation: 4 }),
      }),
    ).toThrow();
  });

  it('refuses an entry signed by a device that is not the named publisher', async () => {
    const { entries, identityId, outsider, recipient, resourceFor } =
      await fixture();

    expect(() =>
      DeviceSealedSecretCipher.open({
        identityId,
        recipient,
        resource: resourceFor(entries[0]!, {
          publisherCredential: DeviceCredential.fromString(
            outsider.toPrimitives().publicKey,
          ).valueOf(),
        }),
      }),
    ).toThrow();
  });
});
