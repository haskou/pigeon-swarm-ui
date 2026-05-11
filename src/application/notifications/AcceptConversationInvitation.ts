import type {
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../domain/types';

import { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

export class AcceptInvitation {
  public constructor(private readonly gateway: PigeonApiGateway) {}

  public async execute(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    return await this.gateway.acceptConversationInvitation(
      session,
      notification,
    );
  }
}
