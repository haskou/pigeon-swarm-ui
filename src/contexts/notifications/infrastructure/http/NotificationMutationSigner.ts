import type { PublicMutation } from '@haskou/pigeon-swarm-crypto';

import { CommitmentId } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationInvitationInput } from './NotificationInvitationInput';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';

export interface SignedNotificationInvitation {
  inviterIdentityId: string;
  mutation: PublicMutation;
  nonce: string;
  notificationId: string;
  recipientIdentityId: string;
}

/**
 * Signs the notification records the node replicates: an invitation by its
 * inviter and a state change (accepted, declined) by its recipient. Byte-exact
 * contract: node docs/api.md, "Notification HTTP API".
 */
export class NotificationMutationSigner {
  public constructor(private readonly mutations: PublicMutationSigner) {}

  private nonce(): string {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  public async invitation(
    session: Session,
    input: NotificationInvitationInput,
  ): Promise<SignedNotificationInvitation> {
    const inviterIdentityId = this.mutations.authorOf(session);
    const recipientIdentityId = IdentityId.normalize(input.recipientIdentityId);
    const nonce = this.nonce();
    const subjectId =
      input.type === 'group_conversation_invitation'
        ? undefined
        : input.subjectId;
    const notificationId = CommitmentId.invitation(
      inviterIdentityId,
      recipientIdentityId,
      nonce,
      subjectId,
    );
    const mutation = await this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: {
          ...(input.encryptedKey === undefined
            ? {}
            : { encryptedKey: input.encryptedKey }),
          id: notificationId,
          inviterIdentityId,
          nonce,
          recipientIdentityId,
          scopeType: 'notification_invitation',
          ...(subjectId === undefined ? {} : { subjectId }),
          type: input.type,
        },
        recordId: notificationId,
        store: 'notifications',
      },
      PublicMutationSigner.FIRST_POSITION,
    );

    return {
      inviterIdentityId,
      mutation,
      nonce,
      notificationId,
      recipientIdentityId,
    };
  }

  public async state(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<PublicMutation> {
    const payload = {
      id: `notification-state:${notificationId}:${state}`,
      notificationId,
      read: true,
      recipientIdentityId: this.mutations.authorOf(session),
      scopeType: 'notification_state',
      state,
    };

    return await this.mutations.sign(
      session,
      { kind: 'put', payload, recordId: payload.id, store: 'notifications' },
      PublicMutationSigner.FIRST_POSITION,
    );
  }
}
