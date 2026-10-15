import type { Session } from '../../identities/infrastructure/session/Session';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupConversationStores } from './GroupConversationStores';

import { IndexedDbMlsStateStore } from '../../communities/infrastructure/mls/IndexedDbMlsStateStore';
import { MlsLeafSigner } from '../../communities/infrastructure/mls/MlsLeafSigner';
import { DeviceSealedEntryStore } from '../../messages/infrastructure/mailbox/DeviceSealedEntryStore';
import { GroupMailboxControl } from './control/GroupMailboxControl';
import { GroupMailboxHandledLetters } from './control/GroupMailboxHandledLetters';
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
    const deviceCredential =
      session.deviceCredentialKeyPair.toPrimitives().publicKey;
    const rosterFor = (conversationId: string) =>
      ports.roster(session, conversationId);
    // Local state seals under the latest root, as after a revoke rotated it.
    const sealing = { session };
    const generations = new IndexedDbGroupMailboxGenerationStore(
      new DeviceSealedEntryStore(
        stores.database('generations', identityId),
        'pigeon-group-generations',
      ),
      () => sealing.session,
    );
    const engine = new GroupMailboxMlsEngine(
      new MlsLeafSigner(
        { deviceCredential, identityId },
        session.keyPair,
        session.deviceCredentialKeyPair,
      ),
      new IndexedDbMlsStateStore(
        new DeviceSealedEntryStore(
          stores.database('mls', identityId),
          'pigeon-group-mls',
        ),
        () => sealing.session,
      ),
      generations,
      rosterFor,
      () => ports.verifiedDevices(sealing.session),
      () => ports.contacts(sealing.session),
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
      { deviceCredential, identityId },
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
      generations,
      new GroupMailboxNotificationPump(
        session,
        control,
        ports.notifications,
        new GroupMailboxHandledLetters(
          new DeviceSealedEntryStore(
            stores.database('control', identityId),
            'pigeon-group-control',
          ),
          () => sealing.session,
        ),
        ports.now,
      ),
      new GroupMailboxInboxSync(
        () => sealing.session,
        engine,
        control,
        ports.channel,
        ports.client,
        stores.inboxes,
        stores.history,
        generations,
        ports.readerSet,
      ),
    );
  }

  private constructor(
    public readonly session: Session,
    private readonly sealing: { session: Session },
    public readonly engine: GroupMailboxMlsEngine,
    public readonly control: GroupMailboxControl,
    public readonly outbox: GroupMailboxOutbox,
    /** The conversations this device holds group state for. */
    public readonly generations: Pick<
      IndexedDbGroupMailboxGenerationStore,
      'conversationIds'
    >,
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
