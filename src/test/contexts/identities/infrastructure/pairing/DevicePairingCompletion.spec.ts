import type { DevicePairingCompletionPayload } from '@haskou/pigeon-swarm-crypto';

import {
  DevicePairingCompletionSignature,
  EncryptedPayload,
  KeyPair,
  PrivateKey,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import type { DevicePairingMaterial } from '../../../../../contexts/identities/domain/DevicePairingMaterial';
import type { DevicePairingRequestDraft } from '../../../../../contexts/identities/domain/DevicePairingRequestDraft';

import { DevicePairingCompletion } from '../../../../../contexts/identities/domain/DevicePairingCompletion';
import { DevicePairingInvitation } from '../../../../../contexts/identities/domain/DevicePairingInvitation';
import { DevicePairingRequest } from '../../../../../contexts/identities/domain/DevicePairingRequest';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceHistoryFloor } from '../../../../../contexts/identities/domain/value-objects/DeviceHistoryFloor';
import { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../../contexts/identities/domain/value-objects/PairingId';
import { DeviceAuthorizationCheckpointMapper } from '../../../../../contexts/identities/infrastructure/http/DeviceAuthorizationCheckpointMapper';
import { DevicePairingCodeReader } from '../../../../../contexts/identities/infrastructure/pairing/DevicePairingCodeReader';
import { thrownPairingFailure } from '../../domain/thrownPairingFailure';

const ACCEPTED_AT = new Timestamp(1_000);

function openMaterial(
  completion: DevicePairingCompletion,
  draft: DevicePairingRequestDraft,
): DevicePairingMaterial {
  return DevicePairingCodeReader.material(
    completion.decryptMaterial(draft.getRequest(), draft.getTransportKeyPair()),
    ACCEPTED_AT,
  );
}

describe(DevicePairingCompletion.name, () => {
  async function fixture(
    historyTransferSecret: SymmetricKey = SymmetricKey.generate(),
    historyFloor: DeviceHistoryFloor = DeviceHistoryFloor.at(
      new Timestamp(400),
    ),
  ) {
    const author = await KeyPair.generate();
    const identityKeyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    );
    const invitation = DevicePairingInvitation.create({
      author,
      epoch: DeviceAuthorizationEpoch.genesis(),
      expiresAt: new Timestamp(2_000),
      identityId,
      pairingId: PairingId.generate(),
      revision: DeviceAuthorizationRevision.fromNumber(3),
    });
    const draft = await DevicePairingRequest.create(
      invitation,
      new Timestamp(1_000),
    );
    const rootKey = UserRootKey.generate();
    const recoveryAuthorityKeyPair = await KeyPair.generate();
    const completion = DevicePairingCompletion.create({
      author,
      checkpoint: DeviceAuthorizationCheckpointMapper.fromResource(
        { epoch: 'genesis', identityId: identityId.valueOf(), revision: 4 },
        identityId,
      ),
      historyFloor,
      historyTransferSecret,
      identityKeyPair,
      recoveryAuthorityKeyPair,
      request: draft.getRequest(),
      rootKey,
    });

    return { author, completion, draft, identityId, identityKeyPair, rootKey };
  }

  it('transfers identity material only to the ephemeral target transport key', async () => {
    const source = await fixture();
    const completion = DevicePairingCodeReader.completion(
      source.completion.toCode(),
    );
    const material = openMaterial(completion, source.draft);

    expect(material.getIdentityKeyPair().toPrimitives()).toEqual(
      source.identityKeyPair.toPrimitives(),
    );
    expect(material.getRootKey().isEqual(source.rootKey)).toBe(true);
  });

  it('carries the history transfer secret inside the encrypted material', async () => {
    const historyTransferSecret = SymmetricKey.generate();
    const source = await fixture(historyTransferSecret);
    const material = openMaterial(
      DevicePairingCodeReader.completion(source.completion.toCode()),
      source.draft,
    );

    expect(material.getHistoryTransferSecret()?.valueOf()).toBe(
      historyTransferSecret.valueOf(),
    );
  });

  /**
   * The source completion, its material edited and signed again. A field
   * edited to undefined is left out of the material.
   */
  function resigned(
    source: {
      author: KeyPair;
      completion: DevicePairingCompletion;
      draft: DevicePairingRequestDraft;
    },
    edit: (material: Record<string, unknown>) => Record<string, unknown>,
  ): DevicePairingCompletion {
    const resource = source.completion.toCode().decode() as Record<
      string,
      string
    >;
    const material = edit(
      JSON.parse(
        source.draft
          .getTransportKeyPair()
          .decrypt(new EncryptedPayload(resource.encryptedMaterial))
          .toString(),
      ) as Record<string, unknown>,
    );

    const payload: DevicePairingCompletionPayload = {
      authorCredential: resource.authorCredential,
      encryptedMaterial: source.draft
        .getRequest()
        .getTransportPublicKey()
        .getPublicKey()
        .encrypt(JSON.stringify(material))
        .valueOf(),
      epoch: resource.epoch,
      identityId: resource.identityId,
      operationId: resource.operationId,
      pairingId: resource.pairingId,
      revision: Number(resource.revision),
      version: 1,
    };

    return DevicePairingCodeReader.completion(
      DevicePairingCode.encode({
        kind: resource.kind,
        ...payload,
        signature: DevicePairingCompletionSignature.sign(
          payload,
          new PrivateKey(source.author.toPrimitives().privateKey),
        ).valueOf(),
      }),
    );
  }

  it('refuses a validly signed completion whose material carries no history transfer secret', async () => {
    const source = await fixture();
    const completion = resigned(source, (material) => ({
      ...material,
      historyTransferSecret: undefined,
    }));

    expect(
      thrownPairingFailure(() => openMaterial(completion, source.draft)),
    ).toBe('invalid');
  });

  it('carries the history floor the authorizer chose inside the encrypted material', async () => {
    const floor = DeviceHistoryFloor.at(new Timestamp(700));
    const source = await fixture(SymmetricKey.generate(), floor);
    const material = openMaterial(
      DevicePairingCodeReader.completion(source.completion.toCode()),
      source.draft,
    );

    expect(material.getHistoryFloor().toPrimitives()).toBe(700);
  });

  it('accepts a history floor ahead of this device clock within the clock skew', async () => {
    const source = await fixture();
    const completion = resigned(source, (material) => ({
      ...material,
      historyFloor: ACCEPTED_AT.addMinutes(5).toMilliseconds(),
    }));

    expect(
      openMaterial(completion, source.draft).getHistoryFloor().toPrimitives(),
    ).toBe(ACCEPTED_AT.addMinutes(5).toMilliseconds());
  });

  it.each([
    ['is missing', undefined],
    ['is not a number', '400'],
    ['is negative', -1],
    ['is fractional', 400.5],
    ['lies past the clock skew', ACCEPTED_AT.addMinutes(6).toMilliseconds()],
  ])(
    'refuses a validly signed completion whose history floor %s',
    async (_case, historyFloor) => {
      const source = await fixture();
      const completion = resigned(source, (material) => ({
        ...material,
        historyFloor,
      }));

      expect(
        thrownPairingFailure(() => openMaterial(completion, source.draft)),
      ).toBe('invalid');
    },
  );

  it('rejects tampered completion checkpoints before decryption', async () => {
    const source = await fixture();
    const resource = source.completion.toCode().decode() as Record<
      string,
      unknown
    >;
    const completion = DevicePairingCodeReader.completion(
      DevicePairingCode.encode({ ...resource, revision: 5 }),
    );

    expect(
      thrownPairingFailure(() => openMaterial(completion, source.draft)),
    ).toBe('invalid');
  });

  it('rejects a completion whose material was swapped in from another completion', async () => {
    const source = await fixture();
    const other = await fixture();
    const resource = source.completion.toCode().decode() as Record<
      string,
      unknown
    >;
    const foreign = other.completion.toCode().decode() as Record<
      string,
      unknown
    >;
    const completion = DevicePairingCodeReader.completion(
      DevicePairingCode.encode({
        ...resource,
        encryptedMaterial: foreign.encryptedMaterial,
      }),
    );

    expect(
      thrownPairingFailure(() => openMaterial(completion, source.draft)),
    ).toBe('invalid');
  });

  it('refuses to sign a completion with a device other than the invitation author', async () => {
    const source = await fixture();
    const author = await KeyPair.generate();
    const recoveryAuthorityKeyPair = await KeyPair.generate();

    expect(() =>
      DevicePairingCompletion.create({
        author,
        checkpoint: DeviceAuthorizationCheckpointMapper.fromResource(
          {
            epoch: 'genesis',
            identityId: source.identityId.valueOf(),
            revision: 4,
          },
          source.identityId,
        ),
        historyFloor: DeviceHistoryFloor.OPEN,
        historyTransferSecret: SymmetricKey.generate(),
        identityKeyPair: source.identityKeyPair,
        recoveryAuthorityKeyPair,
        request: source.draft.getRequest(),
        rootKey: source.rootKey,
      }),
    ).toThrow();
  });

  it('rejects a completion signed by a device other than the invitation author', async () => {
    const source = await fixture();
    const resource = source.completion.toCode().decode() as Record<
      string,
      string
    >;
    const payload: DevicePairingCompletionPayload = {
      authorCredential: resource.authorCredential,
      encryptedMaterial: resource.encryptedMaterial,
      epoch: resource.epoch,
      identityId: resource.identityId,
      operationId: resource.operationId,
      pairingId: resource.pairingId,
      revision: Number(resource.revision),
      version: 1,
    };
    const forger = await KeyPair.generate();
    const forged = DevicePairingCodeReader.completion(
      DevicePairingCode.encode({
        kind: resource.kind,
        ...payload,
        signature: forger
          .sign(DevicePairingCompletionSignature.signingContent(payload))
          .valueOf(),
      }),
    );

    expect(thrownPairingFailure(() => openMaterial(forged, source.draft))).toBe(
      'invalid',
    );
  });
});
