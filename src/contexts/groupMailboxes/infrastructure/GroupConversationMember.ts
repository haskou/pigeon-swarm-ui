import type { Session } from '../../identities/infrastructure/session/Session';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupConversationStores } from './GroupConversationStores';

import { IndexedDbMlsStateStore } from '../../communities/infrastructure/mls/IndexedDbMlsStateStore';
import { GroupMailboxControl } from './control/GroupMailboxControl';
import { GroupMailboxNotificationPump } from './control/GroupMailboxNotificationPump';
import { GroupMailboxInboxSync } from './inbox/GroupMailboxInboxSync';
import { IndexedDbGroupMailboxGenerationStore } from './indexeddb/IndexedDbGroupMailboxGenerationStore';
import { GroupMailboxMlsEngine } from './mls/GroupMailboxMlsEngine';
import { GroupMailboxOutbox } from './outbox/GroupMailboxOutbox';

/** One signed-in identity's MLS engine and the mailbox parts around it. */
export class GroupConversationMember {
  public static open(
    session: Session,
    ports: GroupConversationPorts,
    stores: GroupConversationStores,
  ): GroupConversationMember {
    const identityId = session.identity.id;
    const rosterFor = (conversationId: string) =>
      ports.roster(session, conversationId);
    const engine = new GroupMailboxMlsEngine(
      { deviceId: String(session.deviceId), identityId },
      new IndexedDbMlsStateStore(
        stores.database('mls', identityId),
        identityId,
      ),
      new IndexedDbGroupMailboxGenerationStore(
        stores.database('generations', identityId),
        identityId,
      ),
      rosterFor,
      ports.now,
    );
    const outbox = new GroupMailboxOutbox(
      session,
      engine,
      ports.channel,
      stores.outbox,
      ports.now,
    );
    const control = new GroupMailboxControl(
      identityId,
      engine,
      rosterFor,
      ports.direct(session),
      outbox,
    );

    return new GroupConversationMember(
      session,
      engine,
      control,
      outbox,
      new GroupMailboxNotificationPump(
        session,
        control,
        ports.notifications,
        ports.now,
      ),
      new GroupMailboxInboxSync(
        session,
        engine,
        control,
        ports.channel,
        ports.client,
        stores.inboxes,
        stores.history,
      ),
    );
  }

  private constructor(
    public readonly session: Session,
    public readonly engine: GroupMailboxMlsEngine,
    public readonly control: GroupMailboxControl,
    public readonly outbox: GroupMailboxOutbox,
    public readonly pump: GroupMailboxNotificationPump,
    public readonly inbox: GroupMailboxInboxSync,
  ) {}

  /** Stops background delivery and pending key package requests. */
  public close(): void {
    this.outbox.stop();
    this.control.close();
  }
}
