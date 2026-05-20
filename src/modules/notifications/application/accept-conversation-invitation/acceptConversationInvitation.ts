import type {
  LocalKeychain,
  NotificationResource,
} from '../../../../domain/types';
import type { AcceptConversationInvitationPort } from '../ports/acceptConversationInvitationPort';

import { AcceptConversationInvitationMessage } from './messages/acceptConversationInvitationMessage';

export class AcceptConversationInvitation {
  public constructor(
    private readonly notifications: AcceptConversationInvitationPort,
  ) {}

  public async accept(message: AcceptConversationInvitationMessage): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    return await this.notifications.acceptConversationInvitation(
      message.getSession(),
      message.getNotification(),
    );
  }
}
