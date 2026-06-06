import type {
  LocalKeychain,
  NotificationResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { AcceptConversationInvitationPort } from '../ports/AcceptConversationInvitationPort';

import { AcceptConversationInvitationMessage } from './messages/AcceptConversationInvitationMessage';

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
