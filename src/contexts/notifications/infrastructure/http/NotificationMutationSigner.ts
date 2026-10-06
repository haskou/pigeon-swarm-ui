import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';
import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';

export type NotificationInvitationType =
  | 'community_invitation'
  | 'conversation_invitation'
  | 'group_conversation_invitation';

export interface SignedNotificationInvitation {
  inviterIdentityId: string;
  mutation: SignedPublicMutation;
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
  private readonly mutations = new PublicMutationSigner();

  private nonce(): string {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  public invitationId(
    inviterIdentityId: string,
    recipientIdentityId: string,
    subjectId: string,
    nonce: string,
  ): string {
    return `invitation:${SHA256Hash.from(
      canonicalJson({
        inviterIdentityId,
        nonce,
        recipientIdentityId,
        subjectId,
      }),
    ).toString()}`;
  }

  public invitation(
    session: Session,
    input: {
      encryptedKey: string;
      recipientIdentityId: string;
      subjectId: string;
      type: NotificationInvitationType;
    },
  ): SignedNotificationInvitation {
    const inviterIdentityId = this.mutations.authorOf(session);
    const recipientIdentityId = IdentityId.normalize(input.recipientIdentityId);
    const nonce = this.nonce();
    const notificationId = this.invitationId(
      inviterIdentityId,
      recipientIdentityId,
      input.subjectId,
      nonce,
    );
    const mutation = this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: {
          encryptedKey: input.encryptedKey,
          id: notificationId,
          inviterIdentityId,
          nonce,
          recipientIdentityId,
          scopeType: 'notification_invitation',
          subjectId: input.subjectId,
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

  public state(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): SignedPublicMutation {
    const payload = {
      id: `notification-state:${notificationId}:${state}`,
      notificationId,
      read: true,
      recipientIdentityId: this.mutations.authorOf(session),
      scopeType: 'notification_state',
      state,
    };

    return this.mutations.sign(
      session,
      { kind: 'put', payload, recordId: payload.id, store: 'notifications' },
      PublicMutationSigner.FIRST_POSITION,
    );
  }
}
