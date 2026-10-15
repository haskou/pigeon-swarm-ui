import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

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
          'subjectId' in payload ? payload.subjectId : undefined,
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

  it('signs a group letter that names no subject in its id or payload', async () => {
    const inviter = await session();
    const recipient = await session();
    const signed = await signer.invitation(inviter, {
      encryptedKey: 'key',
      recipientIdentityId: recipient.identity.id,
      type: 'group_conversation_invitation',
    });

    expect(signed.notificationId).toBe(
      signer.invitationId(
        signed.inviterIdentityId,
        signed.recipientIdentityId,
        undefined,
        signed.nonce,
      ),
    );

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
