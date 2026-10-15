import { sha256 } from '@noble/hashes/sha2.js';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { GroupMailboxGeneration } from '../../domain/GroupMailboxGeneration';
import type { GroupMailboxRoster } from '../../domain/GroupMailboxRoster';
import type { GroupMailboxCommit } from '../mls/GroupMailboxCommit';
import type { GroupMailboxOutboxAttempt } from './GroupMailboxOutboxAttempt';
import type { GroupMailboxOutboxCopy } from './GroupMailboxOutboxCopy';
import type { GroupMailboxOutboxEngine } from './GroupMailboxOutboxEngine';
import type { GroupMailboxOutboxFailure } from './GroupMailboxOutboxFailure';
import type { GroupMailboxOutboxItem } from './GroupMailboxOutboxItem';
import type { GroupMailboxOutboxRow } from './GroupMailboxOutboxRow';
import type { GroupMailboxOutboxStore } from './GroupMailboxOutboxStore';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { MlsRejectedError } from '../../../communities/infrastructure/mls/MlsRejectedError';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { GroupMailboxControlRecord } from '../control/GroupMailboxControlRecord';
import { GroupMailboxKeySchedule } from '../crypto/GroupMailboxKeySchedule';

/**
 * Durable fan-out of group records (node `docs/design/group-mailboxes.md`,
 * D5, D9). A record is persisted before its first append, then appended to
 * each recipient's inbox of its generation under a deterministic envelope id,
 * so a retry is stored once. A failed append (an inbox not yet created, a
 * conflict, a rate limit, the network) stays queued and is retried with
 * backoff; later records to that recipient, in any generation, wait behind
 * it, so a commit reaches each member before the messages of the epoch it
 * starts. A message whose generation was superseded before every copy
 * landed is re-encrypted in the current epoch for the current members; one
 * that cannot be re-encrypted for a moment is retried with backoff. While
 * the MLS group still holds a member the node's roster removed, no message
 * is encrypted or appended: that member holds the epoch secret and could
 * read any inbox of the generation. Such a message is held, unsealed or
 * stale, until the removal is committed. While this device awaits the
 * group's confirmation, no record of the conversation is encrypted or
 * appended at all; its messages are held unsealed and sealed in the epoch
 * current once it is confirmed. A commit belongs to its generation and is
 * never re-encrypted. A record still queued after the expiry is dropped
 * and reported. `items` lists each queued record as held, retrying or
 * pending. An ephemeral record (`sendEphemeral`) is never queued: it is
 * appended once or dropped, and none is sealed in a conversation whose
 * queue has held a record past `EPHEMERAL_HOLD_MS`. Logs carry counts
 * only.
 */
export class GroupMailboxOutbox {
  /** The generation index of a message held before it was ever sealed. */
  private static readonly UNSEALED = -1;

  /**
   * How long a queued record may wait for its recipient before no ephemeral
   * record is sealed in its conversation. Each ephemeral record skipped for
   * that recipient still advances this sender's MLS ratchet, and a receiver
   * ratchets at most 200 generations forward: at one typing notice per
   * 10 seconds, 15 minutes keep the gap below 100.
   */
  public static readonly EPHEMERAL_HOLD_MS = 15 * 60 * 1000;
  public static readonly EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;
  public static readonly RETRY_BASE_MS = 5_000;
  public static readonly RETRY_MAX_MS = 5 * 60 * 1000;

  private readonly listeners = new Set<
    (failure: GroupMailboxOutboxFailure) => void
  >();

  /** The ids of rows whose last pass found them held back. */
  private readonly held = new Set<string>();
  private readonly rows = new Map<string, GroupMailboxOutboxRow>();
  /** The roster of each conversation, read once per pass. */
  private readonly rosters = new Map<string, Promise<GroupMailboxRoster>>();
  private lastCreatedAt = 0;
  private queue: Promise<void> = Promise.resolve();
  private stopped = false;

  private static commitSeed(
    commit: GroupMailboxCommit,
    identityId: string,
  ): string {
    const next = GroupMailboxKeySchedule.inbox(
      commit.generation.secret,
      IdentityId.fromString(identityId),
    );

    const hash = encodeBase64Url(sha256(commit.commit));

    return `group-commit|${hash}|${next.mailboxId}`;
  }

  /** Holds back later rows to the recipients of `row`. */
  private static hold(row: GroupMailboxOutboxRow, blocked: Set<string>): void {
    for (const copy of row.copies) {
      blocked.add(GroupMailboxOutbox.recipient(row, copy));
    }
  }

  private static ordered(
    rows: Iterable<GroupMailboxOutboxRow>,
  ): GroupMailboxOutboxRow[] {
    return [...rows].sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );
  }

  /**
   * One recipient of one conversation, for the in-order rule. Generations
   * share it: a commit held in `I(Y,k)` holds back the messages queued for
   * `I(Y,k+1)`, which `Y` could not decrypt before the commit.
   */
  private static recipient(
    row: GroupMailboxOutboxRow,
    copy: GroupMailboxOutboxCopy,
  ): string {
    return [row.conversationId, copy.identityId].join('\u0000');
  }

  private static retryDelay(attempts: number): number {
    return Math.min(
      GroupMailboxOutbox.RETRY_MAX_MS,
      GroupMailboxOutbox.RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1),
    );
  }

  /** The recipients a stale message is re-encrypted for; all if unsealed. */
  private static recipientsOf(
    row: GroupMailboxOutboxRow,
  ): ReadonlySet<string> | undefined {
    if (row.generationIndex === GroupMailboxOutbox.UNSEALED) return undefined;

    return new Set(row.copies.map(({ identityId }) => identityId));
  }

  public constructor(
    private readonly session: Session,
    private readonly engine: GroupMailboxOutboxEngine,
    private readonly channel: Pick<MailboxChannel, 'send'>,
    private readonly store: Pick<
      GroupMailboxOutboxStore,
      'forget' | 'load' | 'remove' | 'save'
    >,
    private readonly roster: (
      conversationId: string,
    ) => Promise<GroupMailboxRoster>,
    private readonly clock: () => number = Date.now,
  ) {}

  private cancelTimer: () => void = () => undefined;

  /**
   * Prepares every row, re-encrypting the stale messages, then appends the
   * due copies: older generations first, so a commit goes out before the
   * messages of the epoch it starts, then oldest record first.
   */
  private async attemptAll(): Promise<void> {
    const now = this.clock();
    const attempts: GroupMailboxOutboxAttempt[] = [];

    this.rosters.clear();

    for (const row of GroupMailboxOutbox.ordered(this.rows.values())) {
      if (this.stopped) return;
      const attempt = await this.prepared(row, now);

      if (attempt) attempts.push(attempt);
    }
    const blocked = new Set<string>();

    attempts.sort(
      (left, right) =>
        left.current.generationIndex - right.current.generationIndex,
    );

    for (const attempt of attempts) {
      if (this.stopped) return;
      await this.attemptRow(attempt, now, blocked);
    }
    this.schedule(now);
  }

  /**
   * Appends the copies of one row. A row waiting for its retry only holds
   * back later rows to its recipients.
   */
  private async attemptRow(
    { current, generation, row }: GroupMailboxOutboxAttempt,
    now: number,
    blocked: Set<string>,
  ): Promise<void> {
    if (!generation) {
      GroupMailboxOutbox.hold(current, blocked);

      return;
    }
    const { failed, pending } = await this.sendCopies(
      current,
      generation,
      blocked,
    );

    await this.settle(row, current, pending, failed, now);
  }

  /** Appends one copy; false when the node refused it or was unreachable. */
  private async appended(
    record: Uint8Array,
    generation: GroupMailboxGeneration,
    copy: GroupMailboxOutboxCopy,
  ): Promise<boolean> {
    try {
      await this.channel.send(
        GroupMailboxKeySchedule.inbox(
          generation.secret,
          IdentityId.fromString(copy.identityId),
        ),
        record,
        copy.envelopeId,
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * The row to deliver now: a message whose generation was superseded, or
   * one never sealed, is encrypted in the current epoch for those of its
   * pending recipients still in the group, or for every member if never
   * sealed; a member who joined since never gets it. Null while the
   * conversation holds it back (`holdsBack`); a commit is held back only
   * while this device awaits the group's confirmation. Undefined when it
   * can no longer be encrypted, as after this identity's removal or when it
   * outgrew the record limit; any other failure rejects, so the row is
   * retried.
   */
  private async currentRow(
    row: GroupMailboxOutboxRow,
  ): Promise<GroupMailboxOutboxRow | null | undefined> {
    const { conversationId } = row;

    try {
      if (row.body === undefined) {
        return (await this.engine.awaitsConfirmation(conversationId))
          ? null
          : row;
      }
      const roster = await this.passRoster(conversationId);

      if (await this.holdsBack(conversationId, roster)) return null;
      const generation = await this.engine.generation(conversationId);

      if (generation.index === row.generationIndex) return row;

      return await this.sealedMessage(
        row,
        new Uint8Array(decodeBase64Url(row.body)),
        GroupMailboxOutbox.recipientsOf(row),
      );
    } catch (error: unknown) {
      if (error instanceof MlsRejectedError || error instanceof RangeError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * The row to deliver now with the generation of its inboxes, or undefined
   * when it can no longer be delivered.
   */
  private async deliverable(
    row: GroupMailboxOutboxRow,
  ): Promise<GroupMailboxOutboxAttempt | undefined> {
    const current = await this.currentRow(row);

    if (current === null) {
      this.held.add(row.id);

      return { current: row, row };
    }
    this.held.delete(row.id);

    if (!current) return undefined;
    const generation = (
      await this.engine.readableGenerations(current.conversationId)
    ).find(({ index }) => index === current.generationIndex);

    return generation ? { current, generation, row } : undefined;
  }

  private async fail(row: GroupMailboxOutboxRow): Promise<void> {
    await this.forgetRow(row);
    // eslint-disable-next-line no-console
    console.debug('Group outbox dropped 1 record.');

    for (const listener of this.listeners) {
      listener({
        conversationId: row.conversationId,
        reference: row.reference,
      });
    }
  }

  private async forgetRow(row: GroupMailboxOutboxRow): Promise<void> {
    this.rows.delete(row.id);
    this.held.delete(row.id);
    await this.store.remove(this.session.identity.id, row.id).catch(() => {
      // eslint-disable-next-line no-console
      console.debug('Group outbox remove failed.');
    });
  }

  /** Whether a record of the conversation waited past the ephemeral hold. */
  private heldTooLong(conversationId: string): boolean {
    const cutoff = this.clock() - GroupMailboxOutbox.EPHEMERAL_HOLD_MS;

    return [...this.rows.values()].some(
      (row) => row.conversationId === conversationId && row.createdAt < cutoff,
    );
  }

  /** Keeps the row in memory; persists it, or runs from memory alone. */
  private async keep(row: GroupMailboxOutboxRow): Promise<void> {
    this.rows.set(row.id, row);
    await this.store.save(this.session, row).catch(() => undefined);
  }

  /**
   * Keeps a row that could not be prepared for delivery, as when the
   * engine failed to re-encrypt it, and retries it after a backoff.
   */
  private async postpone(
    row: GroupMailboxOutboxRow,
    now: number,
  ): Promise<GroupMailboxOutboxRow> {
    const attempts = row.attempts + 1;
    const kept = {
      ...row,
      attempts,
      retryAt: now + GroupMailboxOutbox.retryDelay(attempts),
    };

    // eslint-disable-next-line no-console
    console.debug('Group outbox postponed 1 record.');
    await this.keep(kept);

    return kept;
  }

  /**
   * One row ready for this pass, or undefined once it is dropped. A row
   * waiting for its retry, or one that could not be prepared for now, has
   * no generation and only holds back its recipients.
   */
  private async prepared(
    row: GroupMailboxOutboxRow,
    now: number,
  ): Promise<GroupMailboxOutboxAttempt | undefined> {
    if (now - row.createdAt >= GroupMailboxOutbox.EXPIRY_MS) {
      await this.fail(row);

      return undefined;
    }

    if (row.retryAt > now) return { current: row, row };
    // Null: the row could not be prepared for now; undefined: never again.
    const delivery = await this.deliverable(row).catch(() => null);

    if (delivery === null)
      return { current: await this.postpone(row, now), row };

    if (!delivery) await this.fail(row);

    return delivery;
  }

  /** Runs one pass after any pass already queued. */
  private pass(): Promise<void> {
    const next = this.queue.then(() => this.attemptAll());

    this.queue = next.catch(() => undefined);

    return next;
  }

  /**
   * A creation time later than every queued record's, so records enqueued
   * within one millisecond keep their order.
   */
  private stamp(): number {
    this.lastCreatedAt = Math.max(this.clock(), this.lastCreatedAt + 1);

    return this.lastCreatedAt;
  }

  private schedule(now: number): void {
    this.cancelTimer();
    const waits = [...this.rows.values()]
      .map(({ retryAt }) => retryAt - now)
      .filter((wait) => wait > 0);

    if (this.stopped || waits.length === 0) return;
    const timer = setTimeout(
      () => {
        void this.pass().catch(() => undefined);
      },
      Math.min(...waits),
    );

    this.cancelTimer = () => {
      clearTimeout(timer);
    };
  }

  /**
   * Appends each copy not held back by an earlier row to its recipient.
   * Returns the copies left, and whether an append failed.
   */
  private async sendCopies(
    row: GroupMailboxOutboxRow,
    generation: GroupMailboxGeneration,
    blocked: Set<string>,
  ): Promise<{ failed: boolean; pending: GroupMailboxOutboxCopy[] }> {
    const record = new Uint8Array(decodeBase64Url(row.record));
    const pending: GroupMailboxOutboxCopy[] = [];
    let failed = false;

    for (const copy of row.copies) {
      const recipient = GroupMailboxOutbox.recipient(row, copy);
      const held = blocked.has(recipient);

      if (!held && (await this.appended(record, generation, copy))) continue;
      failed = failed || !held;
      pending.push(copy);
      blocked.add(recipient);
    }

    return { failed, pending };
  }

  /**
   * Forgets a row once every copy landed; otherwise keeps the copies left,
   * backing off after a failure.
   */
  private async settle(
    row: GroupMailboxOutboxRow,
    current: GroupMailboxOutboxRow,
    pending: GroupMailboxOutboxCopy[],
    failed: boolean,
    now: number,
  ): Promise<void> {
    if (pending.length === 0) {
      await this.forgetRow(current);

      return;
    }

    if (failed) {
      // eslint-disable-next-line no-console
      console.debug(`Group outbox kept ${pending.length.toString()} copies.`);
    }

    if (current === row && pending.length === row.copies.length && !failed) {
      return;
    }
    const attempts = failed ? current.attempts + 1 : current.attempts;

    await this.keep({
      ...current,
      attempts,
      copies: pending,
      retryAt: failed ? now + GroupMailboxOutbox.retryDelay(attempts) : 0,
    });
  }

  /** The roster for this pass, read once per conversation. */
  private passRoster(conversationId: string): Promise<GroupMailboxRoster> {
    const known = this.rosters.get(conversationId);

    if (known) return known;
    const read = this.roster(conversationId);

    this.rosters.set(conversationId, read);

    return read;
  }

  /**
   * Whether no message may be encrypted in the conversation now: this
   * device awaits the group's confirmation, or the MLS group still holds a
   * member the roster no longer lists. Rejects once this identity is off
   * the roster itself.
   */
  private async holdsBack(
    conversationId: string,
    roster: GroupMailboxRoster,
  ): Promise<boolean> {
    if (!roster.has(this.session.identity.id)) {
      throw new MlsRejectedError('This identity is not in the group');
    }

    return (
      (await this.engine.awaitsConfirmation(conversationId)) ||
      (await this.engine.members(conversationId)).some(
        (identityId) => !roster.has(identityId),
      )
    );
  }

  /**
   * Encrypts `body` in the current epoch, addressed to every current
   * member, this identity included, or to those of them in `recipients`. A
   * commit applied between reading the generation and encrypting makes it
   * encrypt again, up to three times.
   */
  private async sealedMessage(
    row: Omit<GroupMailboxOutboxRow, 'copies' | 'generationIndex' | 'record'>,
    body: Uint8Array,
    recipients?: ReadonlySet<string>,
  ): Promise<GroupMailboxOutboxRow> {
    const { conversationId } = row;

    for (let attempt = 1; ; attempt += 1) {
      const before = await this.engine.generation(conversationId);
      const ciphertext = await this.engine.encrypt(conversationId, body);
      const generation = await this.engine.generation(conversationId);

      if (generation.index !== before.index && attempt < 3) continue;
      const record = GroupMailboxControlRecord.encode({
        ciphertext,
        conversationId,
        type: 'message',
      });

      if (GroupMailboxControlRecord.decode(record) === null) {
        throw new RangeError('Group message exceeds the record limit');
      }

      return {
        ...row,
        copies: (await this.engine.members(conversationId))
          .filter((identityId) => recipients?.has(identityId) ?? true)
          .map((identityId) => ({
            envelopeId: MailboxChannel.envelopeIdFor(
              `group-message|${row.id}|${
                GroupMailboxKeySchedule.inbox(
                  generation.secret,
                  IdentityId.fromString(identityId),
                ).mailboxId
              }`,
            ),
            identityId,
          })),
        generationIndex: generation.index,
        record: encodeBase64Url(record),
      };
    }
  }

  /**
   * Persists a commit for `I(Y,k)` of each of its recipients, `k` being the
   * generation the commit was made in, and rejects if it cannot: a commit
   * that is not queued must not be kept. The envelope id is seeded from the
   * commit's hash and the recipient's inbox of the generation after it: a
   * removed member, who can still append to `I(Y,k)` and may see one copy,
   * cannot derive the id of another. Nothing is sent until `flush`.
   */
  public async enqueueCommit(
    conversationId: string,
    commit: GroupMailboxCommit,
  ): Promise<void> {
    const { deliveryGeneration } = commit;
    const row: GroupMailboxOutboxRow = {
      attempts: 0,
      conversationId,
      copies: commit.recipients.map((identityId) => ({
        envelopeId: MailboxChannel.envelopeIdFor(
          `${GroupMailboxOutbox.commitSeed(commit, identityId)}|${
            GroupMailboxKeySchedule.inbox(
              deliveryGeneration.secret,
              IdentityId.fromString(identityId),
            ).mailboxId
          }`,
        ),
        identityId,
      })),
      createdAt: this.stamp(),
      generationIndex: deliveryGeneration.index,
      id: MailboxChannel.randomEnvelopeId(),
      record: encodeBase64Url(
        GroupMailboxControlRecord.encode({
          commit: commit.commit,
          conversationId,
          type: 'commit',
        }),
      ),
      reference: encodeBase64Url(sha256(commit.commit)),
      retryAt: 0,
    };

    await this.store.save(this.session, row);
    this.rows.set(row.id, row);
  }

  /**
   * Encrypts an application message in the current epoch and queues it for
   * every member's inbox, this identity's included; while a removal is
   * pending it is queued unsealed instead. Resolves after the first
   * delivery attempt; rejects when the roster cannot be read, when this
   * identity is off it, or when the message cannot be encrypted.
   */
  public async enqueueMessage(
    conversationId: string,
    reference: string,
    body: Uint8Array,
  ): Promise<void> {
    const pending = await this.holdsBack(
      conversationId,
      await this.roster(conversationId),
    );
    const unsealed = {
      attempts: 0,
      body: encodeBase64Url(body),
      conversationId,
      createdAt: this.stamp(),
      id: MailboxChannel.randomEnvelopeId(),
      reference,
      retryAt: 0,
    };

    await this.keep(
      pending
        ? {
            ...unsealed,
            copies: [],
            generationIndex: GroupMailboxOutbox.UNSEALED,
            record: '',
          }
        : await this.sealedMessage(unsealed, body),
    );
    await this.pass();
  }

  /** Retries the queue now, as after a commit changed the epoch. */
  public flush(): Promise<void> {
    return this.pass();
  }

  /** Drops this identity's queue, in memory and at rest. */
  public async forget(): Promise<void> {
    this.stop();
    this.rows.clear();
    this.held.clear();
    await this.store.forget(this.session.identity.id);
  }

  /** The records still queued for one conversation, oldest first. */
  public items(conversationId: string): GroupMailboxOutboxItem[] {
    return GroupMailboxOutbox.ordered(this.rows.values())
      .filter((row) => row.conversationId === conversationId)
      .map((row) => ({
        reference: row.reference,
        state:
          this.held.has(row.id) ||
          row.generationIndex === GroupMailboxOutbox.UNSEALED
            ? 'held'
            : row.attempts > 0
              ? 'retry'
              : 'pending',
      }));
  }

  /** Loads the persisted queue and retries it. */
  public async resume(): Promise<void> {
    this.stopped = false;

    for (const row of await this.store.load(this.session)) {
      if (!this.rows.has(row.id)) this.rows.set(row.id, row);
      this.lastCreatedAt = Math.max(this.lastCreatedAt, row.createdAt);
    }
    await this.pass();
  }

  /**
   * Encrypts an ephemeral record, as a typing notice, in the current epoch
   * and appends it once to every other member's inbox. It is never stored
   * or retried, and never listed in `items`. A recipient an earlier queued
   * record still waits for is skipped, so it never reads a record of an
   * epoch it has not reached. Nothing is sent while the conversation holds
   * messages back (`holdsBack`) or once this identity is off the roster.
   * Never rejects: an ephemeral record that cannot go out is dropped.
   */
  public async sendEphemeral(
    conversationId: string,
    body: Uint8Array,
  ): Promise<void> {
    try {
      if (this.stopped || this.heldTooLong(conversationId)) return;

      if (
        await this.holdsBack(conversationId, await this.roster(conversationId))
      ) {
        return;
      }
      const row = await this.sealedMessage(
        {
          attempts: 0,
          conversationId,
          createdAt: this.clock(),
          id: MailboxChannel.randomEnvelopeId(),
          reference: '',
          retryAt: 0,
        },
        body,
      );
      const generation = (
        await this.engine.readableGenerations(conversationId)
      ).find(({ index }) => index === row.generationIndex);

      if (!generation) return;
      const blocked = new Set<string>();

      for (const queued of this.rows.values()) {
        GroupMailboxOutbox.hold(queued, blocked);
      }
      const record = new Uint8Array(decodeBase64Url(row.record));
      const copies = row.copies.filter(
        (copy) =>
          copy.identityId !== this.session.identity.id &&
          !blocked.has(GroupMailboxOutbox.recipient(row, copy)),
      );
      const sent = await Promise.all(
        copies.map((copy) => this.appended(record, generation, copy)),
      );
      const dropped = sent.filter((appended) => !appended).length;

      if (dropped > 0) {
        // eslint-disable-next-line no-console
        console.debug(
          `Group outbox dropped ${dropped.toString()} ephemeral copies.`,
        );
      }
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Group outbox dropped an ephemeral record.');
    }
  }

  public stop(): void {
    this.stopped = true;
    this.cancelTimer();
  }

  public subscribe(
    listener: (failure: GroupMailboxOutboxFailure) => void,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
