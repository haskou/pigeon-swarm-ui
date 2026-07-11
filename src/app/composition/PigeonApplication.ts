import { PigeonConversationsApplication } from '../../contexts/conversations/application/PigeonConversationsApplication';
import { PigeonMessagesApplication } from '../../contexts/messages/application/PigeonMessagesApplication';
import { RealtimeGateway } from '../../shared/infrastructure/realtime/RealtimeGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonAttachmentsApplication } from './PigeonAttachmentsApplication';
import { PigeonCallsApplication } from './PigeonCallsApplication';
import { PigeonCommunitiesApplication } from './PigeonCommunitiesApplication';
import { PigeonIdentitiesApplication } from './PigeonIdentitiesApplication';
import { PigeonNetworksApplication } from './PigeonNetworksApplication';
import { PigeonNotificationsApplication } from './PigeonNotificationsApplication';
import { PigeonPollsApplication } from './PigeonPollsApplication';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';
import { PigeonSessionApplication } from './PigeonSessionApplication';
import { PigeonStickersApplication } from './PigeonStickersApplication';

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
    this.communities = new PigeonCommunitiesApplication(gateway);
    this.conversations = new PigeonConversationsApplication(gateway);
    this.identities = new PigeonIdentitiesApplication(
      gateway,
      gateway.presence,
    );
    this.messages = new PigeonMessagesApplication(gateway);
    this.networks = new PigeonNetworksApplication(gateway.node);
    this.notifications = new PigeonNotificationsApplication(gateway);
    this.polls = new PigeonPollsApplication(gateway);
    this.realtime = new PigeonRealtimeApplication(realtime);
    this.session = new PigeonSessionApplication(gateway);
    this.stickers = new PigeonStickersApplication(gateway);
  }
}
