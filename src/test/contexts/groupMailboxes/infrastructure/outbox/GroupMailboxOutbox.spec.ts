import type { MockProxy } from 'jest-mock-extended';

import { mock } from 'jest-mock-extended';

import type { GroupMailboxOutboxEngine } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxEngine';
import type { GroupMailboxOutboxRow } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxRow';
import type { GroupMailboxOutboxStore } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutboxStore';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';

import { MlsRejectedError } from '../../../../../contexts/communities/infrastructure/mls/MlsRejectedError';
import { GroupMailboxGeneration } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
import { GroupMailboxGenerationSecret } from '../../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxGenerationSecret';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxKeySchedule } from '../../../../../contexts/groupMailboxes/infrastructure/crypto/GroupMailboxKeySchedule';
import { GroupMailboxOutbox } from '../../../../../contexts/groupMailboxes/infrastructure/outbox/GroupMailboxOutbox';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/domain/errors/MailboxUnavailableError';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const CONVERSATION = 'conversation-1';

const generation = (index: number): GroupMailboxGeneration =>
  new GroupMailboxGeneration(
    index,
    GroupMailboxGenerationSecret.fromBytes(new Uint8Array(32).fill(index + 1)),
    BigInt(index),
    'tree',
  );

const inboxOf = (index: number, identityId: string): string =>
  GroupMailboxKeySchedule.inbox(
    generation(index).secret,
    IdentityId.fromString(identityId),
  ).mailboxId;

describe('GroupMailboxOutbox', () => {
  let now: number;
  let current: number;
  let engine: MockProxy<GroupMailboxOutboxEngine>;
  let channel: MockProxy<Pick<MailboxChannel, 'send'>>;
  let rows: Map<string, GroupMailboxOutboxRow>;
  let store: MockProxy<
    Pick<GroupMailboxOutboxStore, 'forget' | 'load' | 'remove' | 'save'>
  >;
  let sent: string[];
  let outbox: GroupMailboxOutbox;
  let roster: ReadonlySet<string>;

  const session = { identity: { id: 'alice' } } as unknown as Session;

  const build = (): GroupMailboxOutbox =>
    new GroupMailboxOutbox(
      session,
      engine,
      channel,
      store,
      () => Promise.resolve(roster),
      () => now,
    );

  beforeEach(() => {
    now = 1_000;
    roster = new Set(['alice', 'bob', 'dave']);
    current = 0;
    sent = [];
    rows = new Map();
    engine = mock<GroupMailboxOutboxEngine>();
    engine.generation.mockImplementation(() =>
      Promise.resolve(generation(current)),
    );
    engine.readableGenerations.mockImplementation(() =>
      Promise.resolve(
        [current, current - 1].filter((i) => i >= 0).map(generation),
      ),
    );
    engine.members.mockResolvedValue(['alice', 'bob']);
    engine.encrypt.mockImplementation(() =>
      Promise.resolve(new Uint8Array([current, 7])),
    );
    channel = mock<Pick<MailboxChannel, 'send'>>();
    channel.send.mockImplementation((keys: MailboxKeys, _plaintext, id) => {
      sent.push(keys.mailboxId);

      return Promise.resolve({ cursor: 1, envelopeId: id ?? '' });
    });
    store =
      mock<
        Pick<GroupMailboxOutboxStore, 'forget' | 'load' | 'remove' | 'save'>
      >();
    store.save.mockImplementation((_session, row) => {
      rows.set(row.id, row);

      return Promise.resolve();
    });
    store.remove.mockImplementation((_identityId, id) => {
      rows.delete(id);

      return Promise.resolve();
    });
    store.load.mockImplementation(() => Promise.resolve([...rows.values()]));
    store.forget.mockImplementation(() => {
      rows.clear();

      return Promise.resolve();
    });
    outbox = build();
  });

  afterEach(() => {
    outbox.stop();
  });

  it('persists a message before its first append and forgets it once delivered', async () => {
    channel.send.mockImplementationOnce(() => {
      expect([...rows.values()].map(({ reference }) => reference)).toEqual([
        'm1',
      ]);

      return Promise.resolve({ cursor: 1, envelopeId: 'x' });
    });

    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));

    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(rows.size).toBe(0);
  });

  it.each([
    ['a missing inbox', new MailboxUnavailableError()],
    ['a conflict', new HttpJsonError(409, 'conflict', '')],
    ['a rate limit', new HttpJsonError(429, 'slow down', '')],
    ['the network', new TypeError('offline')],
  ])(
    'keeps a copy refused by %s and retries it with backoff',
    async (_n, error) => {
      channel.send.mockImplementation((keys: MailboxKeys, _plaintext, id) =>
        keys.mailboxId === inboxOf(0, 'bob')
          ? Promise.reject(error)
          : Promise.resolve({ cursor: 1, envelopeId: id ?? '' }),
      );

      await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
      const [kept] = rows.values();

      expect(kept.copies.map(({ identityId }) => identityId)).toEqual(['bob']);
      expect(kept.retryAt).toBe(now + GroupMailboxOutbox.RETRY_BASE_MS);

      await outbox.resume();
      expect(channel.send).toHaveBeenCalledTimes(2);

      now += GroupMailboxOutbox.RETRY_BASE_MS;
      await outbox.resume();
      expect([...rows.values()][0].retryAt).toBe(
        now + 2 * GroupMailboxOutbox.RETRY_BASE_MS,
      );
    },
  );

  it('reuses the envelope id of a copy on retry', async () => {
    channel.send.mockRejectedValueOnce(new HttpJsonError(429, 'slow down', ''));
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    now += GroupMailboxOutbox.RETRY_MAX_MS;
    await outbox.resume();

    const ids = channel.send.mock.calls
      .filter(([keys]) => keys.mailboxId === inboxOf(0, 'alice'))
      .map(([, , id]) => id);

    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  it('keeps later records to an inbox behind a stuck one', async () => {
    channel.send.mockImplementation((keys: MailboxKeys, _plaintext, id) =>
      keys.mailboxId === inboxOf(0, 'bob')
        ? Promise.reject(new MailboxUnavailableError())
        : Promise.resolve({ cursor: 1, envelopeId: id ?? '' }),
    );
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    channel.send.mockClear();
    await outbox.enqueueMessage(CONVERSATION, 'm2', new Uint8Array([2]));

    expect(channel.send.mock.calls.map(([keys]) => keys.mailboxId)).toEqual([
      inboxOf(0, 'alice'),
    ]);
    expect(outbox.pending(CONVERSATION)).toEqual(['m1', 'm2']);
  });

  it('keeps a later message behind a held commit to the same recipient in the next generation', async () => {
    channel.send.mockImplementation((keys: MailboxKeys, _plaintext, id) =>
      keys.mailboxId === inboxOf(0, 'bob')
        ? Promise.reject(new MailboxUnavailableError())
        : Promise.resolve({ cursor: 1, envelopeId: id ?? '' }),
    );
    await outbox.enqueueCommit(
      CONVERSATION,
      {
        commit: new Uint8Array([9, 9]),
        deliveryGeneration: generation(0),
        epoch: 1n,
        generation: generation(1),
      },
      ['bob'],
    );
    current = 1;
    channel.send.mockClear();

    await outbox.enqueueMessage(CONVERSATION, 'm2', new Uint8Array([2]));

    expect(channel.send.mock.calls.map(([keys]) => keys.mailboxId)).toEqual([
      inboxOf(1, 'alice'),
    ]);
    expect(outbox.pending(CONVERSATION)).toHaveLength(2);
  });

  it('resumes a queue persisted before a restart', async () => {
    channel.send.mockRejectedValue(new TypeError('offline'));
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    outbox.stop();
    channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'x' });
    now += GroupMailboxOutbox.RETRY_MAX_MS;
    outbox = build();

    await outbox.resume();

    expect(rows.size).toBe(0);
    expect(outbox.pending(CONVERSATION)).toEqual([]);
  });

  it('re-encrypts a stranded message for its pending recipients still in the group', async () => {
    channel.send.mockImplementation((keys: MailboxKeys, _plaintext, id) =>
      keys.mailboxId === inboxOf(0, 'bob')
        ? Promise.reject(new MailboxUnavailableError())
        : Promise.resolve({ cursor: 1, envelopeId: id ?? '' }),
    );
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    current = 1;
    engine.members.mockResolvedValue(['alice', 'bob', 'dave']);
    channel.send.mockClear();
    now += GroupMailboxOutbox.RETRY_MAX_MS;

    await outbox.resume();

    expect(engine.encrypt).toHaveBeenLastCalledWith(
      CONVERSATION,
      new Uint8Array([1]),
    );
    expect(channel.send.mock.calls.map(([keys]) => keys.mailboxId)).toEqual([
      inboxOf(1, 'bob'),
    ]);
    const record = GroupMailboxControlRecord.decode(
      channel.send.mock.calls[0][1],
    );

    expect(record).toEqual({
      ciphertext: new Uint8Array([1, 7]),
      conversationId: CONVERSATION,
      type: 'message',
    });
  });

  it('reports a stranded message it can no longer encrypt', async () => {
    const failures: string[] = [];

    outbox.subscribe(({ reference }) => failures.push(reference));
    channel.send.mockRejectedValue(new MailboxUnavailableError());
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    current = 1;
    engine.encrypt.mockRejectedValue(
      new MlsRejectedError('This device is not in the group'),
    );
    now += GroupMailboxOutbox.RETRY_MAX_MS;

    await outbox.resume();

    expect(failures).toEqual(['m1']);
    expect(rows.size).toBe(0);
  });

  it('keeps a stranded message whose re-encryption fails for a moment', async () => {
    const failures: string[] = [];

    outbox.subscribe(({ reference }) => failures.push(reference));
    channel.send.mockRejectedValue(new MailboxUnavailableError());
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    current = 1;
    // As when the engine cannot store the plaintext it keeps for itself.
    engine.encrypt.mockRejectedValueOnce(new Error('quota exceeded'));
    channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'x' });
    now += GroupMailboxOutbox.RETRY_MAX_MS;

    await outbox.resume();

    expect(failures).toEqual([]);
    expect(outbox.pending(CONVERSATION)).toEqual(['m1']);
    expect([...rows.values()][0].retryAt).toBeGreaterThan(now);

    now += GroupMailboxOutbox.RETRY_MAX_MS;
    await outbox.resume();

    expect(failures).toEqual([]);
    expect(outbox.pending(CONVERSATION)).toEqual([]);
  });

  it('never re-encrypts a commit and drops it once its generation drained', async () => {
    const failures: string[] = [];

    outbox.subscribe(({ reference }) => failures.push(reference));
    channel.send.mockRejectedValue(new MailboxUnavailableError());
    await outbox.enqueueCommit(
      CONVERSATION,
      {
        commit: new Uint8Array([9, 9]),
        deliveryGeneration: generation(0),
        epoch: 1n,
        generation: generation(1),
      },
      ['bob'],
    );
    current = 1;
    channel.send.mockClear();
    now += GroupMailboxOutbox.RETRY_MAX_MS;
    await outbox.resume();

    expect(engine.encrypt).not.toHaveBeenCalled();
    expect(channel.send.mock.calls.map(([keys]) => keys.mailboxId)).toEqual([
      inboxOf(0, 'bob'),
    ]);

    current = 2;
    now += GroupMailboxOutbox.RETRY_MAX_MS;
    await outbox.resume();

    expect(failures).toHaveLength(1);
    expect(rows.size).toBe(0);
  });

  it('drops the queue on forget', async () => {
    channel.send.mockRejectedValue(new TypeError('offline'));
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));

    await outbox.forget();

    expect(store.forget).toHaveBeenCalledWith('alice');
    expect(outbox.pending(CONVERSATION)).toEqual([]);
  });

  it('seals nothing while a member off the roster is still in the group', async () => {
    roster = new Set(['alice']);

    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));

    expect(engine.encrypt).not.toHaveBeenCalled();
    expect(channel.send).not.toHaveBeenCalled();
    expect(outbox.pending(CONVERSATION)).toEqual(['m1']);

    current = 1;
    engine.members.mockResolvedValue(['alice']);
    now += GroupMailboxOutbox.RETRY_MAX_MS;
    await outbox.resume();

    expect(sent).toEqual([inboxOf(1, 'alice')]);
    expect(outbox.pending(CONVERSATION)).toEqual([]);
  });

  it('holds a queued message once a recipient leaves the roster', async () => {
    channel.send.mockRejectedValue(new TypeError('offline'));
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    roster = new Set(['alice']);
    channel.send.mockReset();
    channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'x' });
    now += GroupMailboxOutbox.RETRY_MAX_MS;

    await outbox.resume();

    expect(channel.send).not.toHaveBeenCalled();
    expect(outbox.pending(CONVERSATION)).toEqual(['m1']);
  });

  it('rejects a message once this identity is off the roster', async () => {
    roster = new Set(['bob']);

    await expect(
      outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1])),
    ).rejects.toThrow(MlsRejectedError);
    expect(engine.encrypt).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it('drops a queued message once this identity is off the roster', async () => {
    const failures: string[] = [];

    outbox.subscribe(({ reference }) => failures.push(reference));
    channel.send.mockRejectedValue(new TypeError('offline'));
    await outbox.enqueueMessage(CONVERSATION, 'm1', new Uint8Array([1]));
    roster = new Set(['bob']);
    now += GroupMailboxOutbox.RETRY_MAX_MS;

    await outbox.resume();

    expect(failures).toEqual(['m1']);
    expect(rows.size).toBe(0);
  });
});
