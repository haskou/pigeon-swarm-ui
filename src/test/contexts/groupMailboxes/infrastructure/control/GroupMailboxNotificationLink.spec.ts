import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { NotificationMutationSigner } from '../../../../../contexts/notifications/infrastructure/http/NotificationMutationSigner';
import type { SignedPublicMutation } from '../../../../../shared/infrastructure/crypto/SignedPublicMutation';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { GroupMailboxControlSeal } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlSeal';
import { GroupMailboxNotificationLink } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationLink';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

const CONVERSATION = 'group:control-link';
const NOW = 1_700_000_000_000;

const person = async () => {
  const keyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();

  return {
    id,
    session: { identity: { id }, keyPair } as unknown as Session,
  };
};

describe('GroupMailboxNotificationLink', () => {
  it('posts a group notification sealed to the peer and signed by this identity', async () => {
    const [alice, bob] = await Promise.all([person(), person()]);
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const invitations = mock<Pick<NotificationMutationSigner, 'invitation'>>();
    const mutation = { signature: 'mutation' } as SignedPublicMutation;

    signer.headers.mockResolvedValue({ authorization: 'signed' });
    http.request.mockResolvedValue({});
    invitations.invitation.mockResolvedValue({
      inviterIdentityId: alice.id,
      mutation,
      nonce: 'nonce',
      notificationId: 'invitation:1',
      recipientIdentityId: bob.id,
    });

    await new GroupMailboxNotificationLink(
      alice.session,
      http,
      signer,
      invitations,
      () => NOW,
    ).send(CONVERSATION, bob.id, new Uint8Array([7, 8]));

    const [input] = invitations.invitation.mock.calls[0].slice(1) as [
      { encryptedKey: string; recipientIdentityId: string; subjectId: string },
    ];
    const [path, init] = http.request.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const opened = GroupMailboxControlSeal.open(
      bob.session,
      String(body.encryptedConversationKey),
      { conversationId: CONVERSATION, senderIdentityId: alice.id },
    );

    expect(input).toEqual({
      encryptedKey: body.encryptedConversationKey,
      recipientIdentityId: bob.id,
      subjectId: CONVERSATION,
      type: 'group_conversation_invitation',
    });
    expect(path).toBe('/notifications/');
    expect(init?.method).toBe('POST');
    expect(body).toEqual({
      conversationId: CONVERSATION,
      encryptedConversationKey: expect.any(String),
      inviterIdentityId: alice.id,
      mutation,
      nonce: 'nonce',
      recipientIdentityId: bob.id,
      type: 'group_conversation_invitation',
    });
    expect(opened?.sentAt).toBe(NOW);
    expect([...(opened?.plaintext ?? [])]).toEqual([7, 8]);
  });
});
