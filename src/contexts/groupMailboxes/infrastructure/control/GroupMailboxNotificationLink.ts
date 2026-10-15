import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationMutationSigner } from '../../../notifications/infrastructure/http/NotificationMutationSigner';
import type { GroupMailboxDirectLink } from './GroupMailboxDirectLink';

import { GroupMailboxControlSeal } from './GroupMailboxControlSeal';

/**
 * Delivers a control record to one peer as a `group_conversation_invitation`
 * notification whose key field carries a `GroupMailboxControlSeal` letter.
 * The notification names no conversation: it travels only inside the seal.
 * The node admits it by its signature and the sender's quotas; the letter
 * itself proves the sender to the peer.
 */
export class GroupMailboxNotificationLink implements GroupMailboxDirectLink {
  private static readonly PATH = '/notifications/';
  private static readonly TYPE = 'group_conversation_invitation';

  public constructor(
    private readonly session: Session,
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly invitations: Pick<
      NotificationMutationSigner,
      'invitation'
    >,
    private readonly now: () => number,
  ) {}

  public async send(
    conversationId: string,
    peerIdentityId: string,
    plaintext: Uint8Array,
  ): Promise<void> {
    const path = GroupMailboxNotificationLink.PATH;
    const type = GroupMailboxNotificationLink.TYPE;
    const encryptedConversationKey = GroupMailboxControlSeal.seal(
      this.session,
      {
        conversationId,
        plaintext,
        recipientIdentityId: peerIdentityId,
        sentAt: this.now(),
      },
    );
    const invitation = await this.invitations.invitation(this.session, {
      encryptedKey: encryptedConversationKey,
      recipientIdentityId: peerIdentityId,
      type,
    });
    const body = {
      encryptedConversationKey,
      inviterIdentityId: invitation.inviterIdentityId,
      mutation: invitation.mutation,
      nonce: invitation.nonce,
      recipientIdentityId: invitation.recipientIdentityId,
      type,
    };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(this.session, 'POST', path, body),
      method: 'POST',
    });
  }
}
