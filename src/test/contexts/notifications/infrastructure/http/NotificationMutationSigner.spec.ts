import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { NotificationMutationSigner } from '../../../../../contexts/notifications/infrastructure/http/NotificationMutationSigner';
import { canonicalJson } from '../../../../../shared/infrastructure/crypto/canonicalJson';
import vectors from '../../../../fixtures/notification-vectors.json';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

describe(NotificationMutationSigner.name, () => {
  const mutations = publicMutationSignerAt();
  const signer = new NotificationMutationSigner(mutations);

  async function session(): Promise<Session> {
    const device = await KeyPair.generate();

    return {
      deviceCredentialKeyPair: device,
      identity: { id: device.toPrimitives().publicKey },
    } as unknown as Session;
  }

  it.each(vectors.cases.filter(({ name }) => name.endsWith('_invitation')))(
    'derives the published invitation id for $name',
    (vector) => {
      const { payload } = vector.derived;

      expect(
        signer.invitationId(
          payload.inviterIdentityId as string,
          payload.recipientIdentityId as string,
          payload.subjectId as string,
          payload.nonce as string,
        ),
      ).toBe(payload.id);
    },
  );

  it.each(vectors.cases)(
    'canonicalizes and digests the $name payload as published',
    (vector) => {
      expect(canonicalJson(vector.derived.payload)).toBe(
        vector.derived.payloadCanonical,
      );
      expect(mutations.digestOfValue(vector.derived.payload)).toBe(
        vector.derived.payloadDigest,
      );
    },
  );

  it('signs an invitation whose digest and id match the payload it commits to', async () => {
    const inviter = await session();
    const recipient = await session();
    const signed = await signer.invitation(inviter, {
      encryptedKey: 'key',
      recipientIdentityId: recipient.identity.id,
      subjectId: 'group:g',
      type: 'group_conversation_invitation',
    });

    expect(signed.nonce).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(signed.mutation).toMatchObject({
      kind: 'put',
      predecessor: null,
      recordId: signed.notificationId,
      sequence: 0,
      store: 'notifications',
    });
    expect(signed.mutation.payloadDigest).toBe(
      mutations.digestOfValue({
        encryptedKey: 'key',
        id: signed.notificationId,
        inviterIdentityId: signed.inviterIdentityId,
        nonce: signed.nonce,
        recipientIdentityId: signed.recipientIdentityId,
        scopeType: 'notification_invitation',
        subjectId: 'group:g',
        type: 'group_conversation_invitation',
      }),
    );
  });

  it('signs a per-state record that matches the state vector shape', async () => {
    const recipient = await session();
    const vector = vectors.cases.find(({ name }) => name === 'state_accepted');
    const mutation = await signer.state(
      recipient,
      vector?.derived.payload.notificationId as string,
      'accepted',
    );

    expect(mutation.recordId).toBe(
      `notification-state:${vector?.derived.payload.notificationId}:accepted`,
    );
    expect(mutation.payloadDigest).toBe(
      mutations.digestOfValue({
        ...vector?.derived.payload,
        recipientIdentityId: mutations.authorOf(recipient),
      }),
    );
  });
});
