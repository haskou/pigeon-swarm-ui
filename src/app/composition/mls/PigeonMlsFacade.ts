import { Buffer } from 'buffer';

import type { PigeonCommunitiesGateway } from '../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import type { PigeonMlsRecordsApi } from '../../../contexts/communities/infrastructure/http/PigeonMlsRecordsApi';
import type { MlsGroupCredentials } from '../../../contexts/communities/infrastructure/mls/MlsGroupCredentials';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { MessageResource } from '../../../contexts/messages/infrastructure/http/MessageResource';

import { CommunityMlsRoster } from '../../../contexts/communities/domain/CommunityMlsRoster';
import { IndexedDbMlsStateStore } from '../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { MlsCommunityEngine } from '../../../contexts/communities/infrastructure/mls/MlsCommunityEngine';
import { MlsLeafSigner } from '../../../contexts/communities/infrastructure/mls/MlsLeafSigner';
import { SessionMlsRecordTransport } from '../../../contexts/communities/infrastructure/mls/SessionMlsRecordTransport';
import { DeviceSealedEntryStore } from '../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';
import { scopeClientStorageKey } from '../../../shared/infrastructure/storage/ClientStorageScope';

const stateDatabase = 'pigeon-mls-state';
const synchronizeIntervalMs = 5000;
const needsDecryption = (message: MessageResource): boolean =>
  message.encryptedPayload !== undefined &&
  message.plaintextPayload === undefined;
const communityIdOf = (groupId: string): string => groupId.split(':')[0];

/** Group encryption for communities, one engine per signed-in device. */
export class PigeonMlsFacade {
  private readonly engines = new Map<
    string,
    { engine: MlsCommunityEngine; session: Session }
  >();

  private readonly synchronizations = new Map<
    string,
    { at: number; result: Promise<boolean> }
  >();

  private state: DeviceSealedEntryStore | undefined;

  public constructor(
    private readonly records: PigeonMlsRecordsApi,
    private readonly communities: PigeonCommunitiesGateway,
  ) {}

  private async roster(
    session: Session,
    communityId: string,
  ): Promise<CommunityMlsRoster> {
    return CommunityMlsRoster.of(
      await this.communities.getCommunity(session, communityId),
    );
  }

  /** Opened on first use: the database name needs the chosen node. */
  private sealedState(): DeviceSealedEntryStore {
    this.state ??= new DeviceSealedEntryStore(
      scopeClientStorageKey(stateDatabase),
      stateDatabase,
    );

    return this.state;
  }

  private engineFor(session: Session): MlsCommunityEngine {
    const owner = {
      deviceId: String(session.deviceId),
      identityId: session.identity.id,
    };
    const key = `${owner.identityId}/${owner.deviceId}`;
    const known = this.engines.get(key);

    if (known) {
      known.session = session;

      return known.engine;
    }

    const holder = {
      engine: undefined as unknown as MlsCommunityEngine,
      session,
    };

    holder.engine = new MlsCommunityEngine(
      new MlsLeafSigner(owner, {
        sign: (message) => holder.session.keyPair.sign(message),
      }),
      new IndexedDbMlsStateStore(this.sealedState(), () => holder.session),
      (communityId) =>
        new SessionMlsRecordTransport(
          this.records,
          () => holder.session,
          communityId,
        ),
      (groupId) => async () =>
        await this.roster(holder.session, communityIdOf(groupId)),
    );
    this.engines.set(key, holder);

    return holder.engine;
  }

  /** Starts the group of a community this identity just created. */
  public async createGroup(session: Session, groupId: string): Promise<void> {
    await this.engineFor(session).createGroup(groupId);
  }

  /**
   * Keeps this device current: publishes key packages so a member can admit
   * it, applies pending commits or welcomes and follows the roster. Returns
   * whether this device can read the group.
   */
  public async synchronize(
    session: Session,
    groupId: string,
    options: { force?: boolean } = {},
  ): Promise<boolean> {
    const key = `${session.identity.id}/${groupId}`;
    const recent = this.synchronizations.get(key);

    if (
      recent &&
      !options.force &&
      Date.now() - recent.at < synchronizeIntervalMs
    ) {
      return await recent.result;
    }

    const result = this.runSynchronize(session, groupId);

    this.synchronizations.set(key, { at: Date.now(), result });
    result.catch(() => this.synchronizations.delete(key));

    return await result;
  }

  private async runSynchronize(
    session: Session,
    groupId: string,
  ): Promise<boolean> {
    const engine = this.engineFor(session);

    await engine.publishKeyPackages(communityIdOf(groupId));

    if (!(await engine.reconcile(groupId))) return false;

    return await engine.hasGroup(groupId);
  }

  /**
   * Decrypts the encrypted payload of each message into `plaintextPayload`.
   * Messages this device cannot read (sent before it joined, or after it was
   * removed) are returned unchanged.
   */
  public async openMessages(
    session: Session,
    groupId: string,
    messages: MessageResource[],
  ): Promise<MessageResource[]> {
    if (!messages.some(needsDecryption)) return messages;

    const readable = await this.synchronize(session, groupId);
    const opened = new Map<number, string>();
    const order = messages
      .map((message, index) => ({ index, message }))
      .filter(({ message }) => needsDecryption(message))
      .sort(
        (first, second) =>
          (first.message.createdAt ?? 0) - (second.message.createdAt ?? 0),
      );

    for (const { index, message } of readable ? order : []) {
      try {
        opened.set(
          index,
          await this.decrypt(session, groupId, message.encryptedPayload ?? ''),
        );
      } catch {
        // Not readable by this device; the projection shows it as locked.
      }
    }

    return messages.map((message, index) =>
      opened.has(index)
        ? { ...message, plaintextPayload: opened.get(index) }
        : message,
    );
  }

  public async encrypt(
    session: Session,
    groupId: string,
    plaintext: string,
  ): Promise<string> {
    return await this.engineFor(session).encrypt(groupId, plaintext);
  }

  public async decrypt(
    session: Session,
    groupId: string,
    ciphertext: string,
  ): Promise<string> {
    return await this.engineFor(session).decrypt(groupId, ciphertext);
  }

  /** Public leaf credentials of a group this device holds, for audit. */
  public async credentials(
    session: Session,
    groupId: string,
  ): Promise<MlsGroupCredentials | null> {
    return await this.engineFor(session).credentials(groupId);
  }

  public async exportSecret(
    session: Session,
    groupId: string,
    label: string,
    context: string,
  ): Promise<Uint8Array> {
    return await this.engineFor(session).exportSecret(groupId, label, context);
  }

  public async callMediaKey(
    session: Session,
    groupId: string,
    callId: string,
  ): Promise<string> {
    const secret = await this.exportSecret(
      session,
      groupId,
      'pigeon/call-media/v1',
      callId,
    );

    return Buffer.from(secret).toString('base64');
  }

  /** Drops the engines and keys held in memory, for logout. State is kept. */
  public close(): void {
    this.engines.clear();
    this.synchronizations.clear();
    this.state?.close();
  }

  /** Drops the engines and the community MLS state of the identity. */
  public async forget(identityId: string): Promise<void> {
    for (const held of [this.engines, this.synchronizations]) {
      for (const key of [...held.keys()]) {
        if (key.startsWith(`${identityId}/`)) held.delete(key);
      }
    }
    await this.sealedState().forget(identityId);
  }
}
