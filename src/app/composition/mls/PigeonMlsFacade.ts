import type { PigeonCommunitiesGateway } from '../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import type { PigeonMlsRecordsApi } from '../../../contexts/communities/infrastructure/http/PigeonMlsRecordsApi';
import type {
  MessageResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { IndexedDbMlsStateStore } from '../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';
import { MlsCommunityEngine } from '../../../contexts/communities/infrastructure/mls/MlsCommunityEngine';
import { SessionMlsRecordTransport } from '../../../contexts/communities/infrastructure/mls/SessionMlsRecordTransport';
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

  public constructor(
    private readonly records: PigeonMlsRecordsApi,
    private readonly communities: PigeonCommunitiesGateway,
  ) {}

  private async roster(
    session: Session,
    communityId: string,
  ): Promise<ReadonlySet<string>> {
    const community = await this.communities.getCommunity(session, communityId);
    const banned = new Set(community.bannedMemberIds ?? []);

    return new Set(community.memberIds.filter((id) => !banned.has(id)));
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
      owner,
      new IndexedDbMlsStateStore(
        scopeClientStorageKey(stateDatabase),
        owner.identityId,
      ),
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
  ): Promise<boolean> {
    const key = `${session.identity.id}/${groupId}`;
    const recent = this.synchronizations.get(key);

    if (recent && Date.now() - recent.at < synchronizeIntervalMs) {
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

  public async exportSecret(
    session: Session,
    groupId: string,
    label: string,
    context: string,
  ): Promise<Uint8Array> {
    return await this.engineFor(session).exportSecret(groupId, label, context);
  }
}
