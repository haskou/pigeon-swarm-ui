import { PigeonAttachmentsApplication } from '../../contexts/attachments/application/PigeonAttachmentsApplication';
import { PigeonCallsApplication } from '../../contexts/calls/application/PigeonCallsApplication';
import { PigeonCommunitiesApplication } from '../../contexts/communities/application/PigeonCommunitiesApplication';
import { PigeonConversationsApplication } from '../../contexts/conversations/application/PigeonConversationsApplication';
import { PigeonIdentitiesApplication } from '../../contexts/identities/application/PigeonIdentitiesApplication';
import { PigeonSessionApplication } from '../../contexts/identities/application/PigeonSessionApplication';
import { PigeonMessagesApplication } from '../../contexts/messages/application/PigeonMessagesApplication';
import { PigeonNetworksApplication } from '../../contexts/networks/application/PigeonNetworksApplication';
import { PigeonNotificationsApplication } from '../../contexts/notifications/application/PigeonNotificationsApplication';
import { PigeonPollsApplication } from '../../contexts/polls/application/PigeonPollsApplication';
import { PigeonStickersApplication } from '../../contexts/stickers/application/PigeonStickersApplication';
import { RealtimeGateway } from '../../shared/infrastructure/realtime/RealtimeGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';

export class PigeonApplication {
  public readonly attachments: PigeonAttachmentsApplication;

  public readonly calls: PigeonCallsApplication;

  public readonly communities: PigeonCommunitiesApplication;

  public readonly conversations: PigeonConversationsApplication;

  public readonly identities: PigeonIdentitiesApplication;

  public readonly messages: PigeonMessagesApplication;

  public readonly networks: PigeonNetworksApplication;

  public readonly notifications: PigeonNotificationsApplication;

  public readonly polls: PigeonPollsApplication;

  public readonly realtime: PigeonRealtimeApplication;

  public readonly session: PigeonSessionApplication;

  public readonly stickers: PigeonStickersApplication;

  public constructor(
    gateway: PigeonApiGateway = new PigeonApiGateway(),
    realtime: RealtimeGateway = new RealtimeGateway(),
  ) {
    this.attachments = new PigeonAttachmentsApplication(gateway);
    this.calls = new PigeonCallsApplication(gateway.calls);
    this.communities = new PigeonCommunitiesApplication({
      channels: gateway,
      directory: gateway,
      invitations: gateway,
      keychain: gateway,
      media: gateway,
      membership: gateway,
      roles: gateway,
    });
    this.conversations = new PigeonConversationsApplication(gateway);
    this.identities = new PigeonIdentitiesApplication(
      gateway.identityApplication,
    );
    this.messages = new PigeonMessagesApplication(gateway);
    this.networks = new PigeonNetworksApplication(gateway.node);
    this.notifications = new PigeonNotificationsApplication({
      acceptInvitation: gateway,
      listNotifications: gateway,
      listNotificationSettings: gateway,
      push: gateway,
      resetNotificationSetting: gateway,
      saveNotificationSetting: gateway,
      updateNotification: gateway,
    });
    this.polls = new PigeonPollsApplication(gateway);
    this.realtime = new PigeonRealtimeApplication(realtime);
    this.session = new PigeonSessionApplication(
      gateway.identityApplication.session,
    );
    this.stickers = new PigeonStickersApplication(gateway);
  }
}
