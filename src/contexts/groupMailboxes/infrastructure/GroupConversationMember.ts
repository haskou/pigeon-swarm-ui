import type { Session } from '../../identities/infrastructure/session/Session';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupConversationStores } from './GroupConversationStores';

import { IndexedDbMlsStateStore } from '../../communities/infrastructure/mls/IndexedDbMlsStateStore';
import { MlsLeafSigner } from '../../communities/infrastructure/mls/MlsLeafSigner';
import { DeviceSealedEntryStore } from '../../messages/infrastructure/mailbox/DeviceSealedEntryStore';
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
    // Local state seals under the latest root, as after a revoke rotated it.
    const sealing = { session };
    const engine = new GroupMailboxMlsEngine(
      new MlsLeafSigner(
        { deviceId: String(session.deviceId), identityId },
        session.keyPair,
      ),
      new IndexedDbMlsStateStore(
        new DeviceSealedEntryStore(
          stores.database('mls', identityId),
          'pigeon-group-mls',
        ),
        () => sealing.session,
      ),
      new IndexedDbGroupMailboxGenerationStore(
        new DeviceSealedEntryStore(
          stores.database('generations', identityId),
          'pigeon-group-generations',
        ),
        () => sealing.session,
      ),
      rosterFor,
      ports.now,
    );
    const outbox = new GroupMailboxOutbox(
      session,
      engine,
      ports.channel,
      stores.outbox,
      rosterFor,
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
      sealing,
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
    private readonly sealing: { session: Session },
    public readonly engine: GroupMailboxMlsEngine,
    public readonly control: GroupMailboxControl,
    public readonly outbox: GroupMailboxOutbox,
    public readonly pump: GroupMailboxNotificationPump,
    public readonly inbox: GroupMailboxInboxSync,
  ) {}

  /** Seals the local state under this session's root from now on. */
  public follow(session: Session): void {
    this.sealing.session = session;
  }

  /** Stops background delivery and pending key package requests. */
  public close(): void {
    this.outbox.stop();
    this.control.close();
  }
}
