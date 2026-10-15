import { Buffer } from 'buffer';

import type { CommunityAuthority } from '../../../contexts/communities/domain/operations/CommunityAuthority';
import type { CommunityOperation } from '../../../contexts/communities/domain/operations/CommunityOperation';
import type { PigeonCommunityOperationsApi } from '../../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import type { PigeonMlsRecordsApi } from '../../../contexts/communities/infrastructure/http/PigeonMlsRecordsApi';
import type { MlsGroupCredentials } from '../../../contexts/communities/infrastructure/mls/MlsGroupCredentials';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { MessageResource } from '../../../contexts/messages/infrastructure/http/MessageResource';

import { CommunityMlsRoster } from '../../../contexts/communities/domain/CommunityMlsRoster';
import { CommunityRosterHistory } from '../../../contexts/communities/domain/CommunityRosterHistory';
import { CommunityChannelRestrictionRefusedError } from '../../../contexts/communities/domain/errors/CommunityChannelRestrictionRefusedError';
import { CommunityOperationFold } from '../../../contexts/communities/domain/operations/CommunityOperationFold';
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
/** The group of a channel only some roles may see. */
const channelGroupOf = (communityId: string, channelId: string): string =>
  `${communityId}:${channelId}`;

/**
 * Group encryption for communities, one engine per signed-in device. A
 * community has one group, `communityId`, for every channel everyone may
 * see; each channel restricted to some roles has its own group,
 * `communityId:channelId`, whose roster is who may see the channel.
 */
export class PigeonMlsFacade {
  private readonly engines = new Map<
    string,
    { engine: MlsCommunityEngine; session: Session }
  >();

  private readonly synchronizations = new Map<
    string,
    { at: number; result: Promise<ReadonlyMap<string, boolean>> }
  >();

  private state: DeviceSealedEntryStore | undefined;

  public constructor(
    private readonly records: PigeonMlsRecordsApi,
    private readonly operations: PigeonCommunityOperationsApi,
  ) {}

  /** Who may change the group, as the community's signed history. */
  private async history(
    session: Session,
    groupId: string,
  ): Promise<CommunityRosterHistory> {
    const [communityId, channelId] = groupId.split(':');

    return CommunityRosterHistory.of(
      await this.communityOperations(session, communityId),
      channelId,
    );
  }

  /** The rights the community's signed history proves, if any. */
  private async authority(
    session: Session,
    communityId: string,
  ): Promise<CommunityAuthority | undefined> {
    return CommunityOperationFold.fold(
      await this.operations.list(session, communityId),
    );
  }

  /**
   * The group a channel's messages and calls are sealed for, read from the
   * signed history right now so a restriction applies to the next write. A
   * channel the history does not show (a channel from before signed
   * operations, or one whose creation it rejected) cannot be restricted by
   * it, so it stays on the community group.
   */
  private async groupFor(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<string> {
    const authority = await this.authority(session, communityId);

    return authority?.isChannelRestricted(channelId)
      ? channelGroupOf(communityId, channelId)
      : communityId;
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
      deviceCredential:
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      identityId: session.identity.id,
    };
    const key = `${owner.identityId}/${owner.deviceCredential}`;
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
      new MlsLeafSigner(
        owner,
        { sign: (message) => holder.session.keyPair.sign(message) },
        {
          sign: (message) =>
            holder.session.deviceCredentialKeyPair.sign(message),
        },
      ),
      new IndexedDbMlsStateStore(this.sealedState(), () => holder.session),
      (communityId) =>
        new SessionMlsRecordTransport(
          this.records,
          () => holder.session,
          communityId,
        ),
      (groupId) => async () => await this.history(holder.session, groupId),
    );
    this.engines.set(key, holder);

    return holder.engine;
  }

  /**
   * Syncs every group of the community this device may read, at most once
   * per interval unless forced: the community group, then each restricted
   * channel group it may see. Maps each group to whether it is readable; a
   * failing channel group is unreadable and does not stop the others.
   */
  private async synchronized(
    session: Session,
    communityId: string,
    force: boolean,
  ): Promise<ReadonlyMap<string, boolean>> {
    const key = `${session.identity.id}/${communityId}`;
    const recent = this.synchronizations.get(key);

    if (recent && !force && Date.now() - recent.at < synchronizeIntervalMs) {
      return await recent.result;
    }

    const result = this.runSynchronize(session, communityId);

    this.synchronizations.set(key, { at: Date.now(), result });
    result.catch(() => this.synchronizations.delete(key));

    return await result;
  }

  private async runSynchronize(
    session: Session,
    communityId: string,
  ): Promise<ReadonlyMap<string, boolean>> {
    const engine = this.engineFor(session);
    const authority = await this.authority(session, communityId);
    const readable = new Map([
      [communityId, await this.reconcile(engine, communityId)],
    ]);

    for (const channelId of authority?.getRestrictedChannelIds() ?? []) {
      if (!authority?.canAccessChannel(session.identity.id, channelId)) {
        continue;
      }

      const groupId = channelGroupOf(communityId, channelId);

      readable.set(
        groupId,
        await this.reconcile(engine, groupId).catch(() => false),
      );
    }

    return readable;
  }

  /**
   * Publishes key packages so a member can admit this device, applies
   * pending commits or welcomes and follows the roster. Returns whether this
   * device can read the group.
   */
  private async reconcile(
    engine: MlsCommunityEngine,
    groupId: string,
  ): Promise<boolean> {
    await engine.publishKeyPackages(groupId);

    return (
      (await engine.reconcile(groupId)) && (await engine.hasGroup(groupId))
    );
  }

  /** Starts the group of a community this identity just created. */
  public async createGroup(session: Session, groupId: string): Promise<void> {
    await this.engineFor(session).createGroup(groupId);
  }

  /** Keeps this device current in every group of the community it may read. */
  public async synchronize(
    session: Session,
    communityId: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    await this.synchronized(session, communityId, options.force ?? false);
  }

  /** Whether this device can read and write the channel's group. */
  public async ready(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<boolean> {
    const readable = await this.synchronized(session, communityId, false);

    return (
      readable.get(await this.groupFor(session, communityId, channelId)) ??
      false
    );
  }

  /**
   * Refuses, before anything is signed, to restrict a channel to roles whose
   * group this identity could not start: the first member must be able to
   * add the others and keep seeing the channel.
   */
  public async assertCanRestrictChannel(
    session: Session,
    communityId: string,
    visibleRoleIds: readonly string[],
  ): Promise<void> {
    const authority = await this.authority(session, communityId);

    if (
      !authority?.canKeyRestrictedChannel(session.identity.id, visibleRoleIds)
    ) {
      throw new CommunityChannelRestrictionRefusedError();
    }
  }

  /**
   * Follows a restriction this identity just signed: starts the channel's
   * group when it may add its members and no device holds it yet (neither
   * this one nor any commit the node keeps), then admits who may see it. A
   * channel restricted again resumes its group; other managers never start
   * one.
   */
  public async openChannelGroup(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    const operations = await this.operations.list(session, communityId);

    if (
      !CommunityOperationFold.fold(operations)?.isChannelRestricted(channelId)
    ) {
      return;
    }

    const groupId = channelGroupOf(communityId, channelId);
    const engine = this.engineFor(session);

    if (
      CommunityMlsRoster.replay(operations, channelId).manages(
        session.identity.id,
      ) &&
      !(await engine.hasGroup(groupId)) &&
      (
        await this.records.list(session, communityId, {
          groupId,
          kind: 'commit',
        })
      ).length === 0
    ) {
      await engine.createGroup(groupId);
    }

    await this.synchronized(session, communityId, true);
  }

  /**
   * Decrypts the encrypted payload of each message of the channel into
   * `plaintextPayload`. A payload opens only with the community group or
   * this channel's group, so a node cannot move one channel's message into
   * another. Messages this device cannot read (sent before it joined, or
   * after it was removed) are returned unchanged.
   */
  public async openMessages(
    session: Session,
    communityId: string,
    channelId: string,
    messages: MessageResource[],
  ): Promise<MessageResource[]> {
    if (!messages.some(needsDecryption)) return messages;

    const readable = await this.synchronized(session, communityId, false);
    const groups = [communityId, channelGroupOf(communityId, channelId)];
    const engine = this.engineFor(session);
    const opened = new Map<number, string>();
    const order = messages
      .map((message, index) => ({ index, message }))
      .filter(({ message }) => needsDecryption(message))
      .sort(
        (first, second) =>
          (first.message.createdAt ?? 0) - (second.message.createdAt ?? 0),
      );

    for (const { index, message } of order) {
      const ciphertext = message.encryptedPayload ?? '';
      const groupId = MlsCommunityEngine.groupOf(ciphertext);

      // A channel group no longer synced (the channel is open again) still
      // reads what it sealed before.
      if (
        groupId === undefined ||
        !groups.includes(groupId) ||
        readable.get(groupId) === false
      ) {
        continue;
      }

      try {
        opened.set(index, await engine.decrypt(groupId, ciphertext));
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

  /** Seals a message for the group of the channel it is sent to. */
  public async encrypt(
    session: Session,
    communityId: string,
    channelId: string,
    plaintext: string,
  ): Promise<string> {
    return await this.engineFor(session).encrypt(
      await this.groupFor(session, communityId, channelId),
      plaintext,
    );
  }

  /** Public leaf credentials of a group this device holds, for audit. */
  public async credentials(
    session: Session,
    groupId: string,
  ): Promise<MlsGroupCredentials | null> {
    return await this.engineFor(session).credentials(groupId);
  }

  /** The community's operations, each verified against its author's key. */
  public async communityOperations(
    session: Session,
    communityId: string,
  ): Promise<CommunityOperation[]> {
    return await this.operations.list(session, communityId);
  }

  /** The media key of a call, from the group of the channel it runs in. */
  public async callMediaKey(
    session: Session,
    communityId: string,
    channelId: string,
    callId: string,
  ): Promise<string> {
    const secret = await this.engineFor(session).exportSecret(
      await this.groupFor(session, communityId, channelId),
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
