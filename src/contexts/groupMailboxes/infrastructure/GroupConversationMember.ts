import { MlsLeafSigner } from '@haskou/pigeon-swarm-crypto/mls';

import type { Session } from '../../identities/infrastructure/session/Session';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupConversationStores } from './GroupConversationStores';

import { IndexedDbMlsStateStore } from '../../communities/infrastructure/mls/IndexedDbMlsStateStore';
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
  /** The roots the sessions it followed replaced. */
  private readonly retired: Buffer[] = [];

  public static open(
    session: Session,
    ports: GroupConversationPorts,
    stores: GroupConversationStores,
  ): GroupConversationMember {
    const identityId = session.identity.id;
    const deviceCredential =
      session.deviceCredentialKeyPair.toPrimitives().publicKey;
    // Every part reads the latest session: after a revoke rotated the root,
    // local state seals under it and requests carry it.
    const current = { session };
    const latest = (): Session => current.session;
    const generations = new IndexedDbGroupMailboxGenerationStore(
      new DeviceSealedEntryStore(
        stores.database('generations', identityId),
        'pigeon-group-generations',
      ),
      latest,
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
        latest,
      ),
      generations,
      () => ports.verifiedDevices(current.session),
      () => ports.contacts(current.session),
      ports.now,
    );
    const outbox = new GroupMailboxOutbox(
      latest,
      engine,
      ports.channel,
      stores.outbox,
      ports.now,
    );
    const control = new GroupMailboxControl(
      { deviceCredential, identityId },
      engine,
      () => ports.contacts(current.session),
      ports.direct(latest),
      outbox,
    );

    return new GroupConversationMember(
      current,
      engine,
      control,
      outbox,
      generations,
      new GroupMailboxNotificationPump(
        latest,
        control,
        ports.notifications,
        new GroupMailboxHandledLetters(
          new DeviceSealedEntryStore(
            stores.database('control', identityId),
            'pigeon-group-control',
          ),
          latest,
        ),
        ports.now,
      ),
      new GroupMailboxInboxSync(
        latest,
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
    private readonly current: { session: Session },
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
  ) {
    this.follow(current.session);
  }

  /** The latest session it follows. */
  public get session(): Session {
    return this.current.session;
  }

  /**
   * Seals the local state under this session's root and sends with it from
   * now on, unless a session it followed replaced that root: a call that
   * started before a revoke rotated the root still holds the replaced
   * session, and must not move the state back under it.
   */
  public follow(session: Session): void {
    const root = session.deviceSealedRootKey?.getBuffer();

    if (root && this.retired.some((stale) => stale.equals(root))) return;
    const previous = session.previousDeviceSealedRootKey?.getBuffer();

    if (previous && !this.retired.some((stale) => stale.equals(previous))) {
      this.retired.push(previous);
    }
    this.current.session = session;
  }

  /** Stops background delivery and pending key package requests. */
  public close(): void {
    this.outbox.stop();
    this.control.close();
  }
}
