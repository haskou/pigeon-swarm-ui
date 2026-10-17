import 'fake-indexeddb/auto';
import {
  MailboxRecordAuthorship,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';
import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectSentRecord } from '../../../../../contexts/mailboxes/domain/DirectSentRecord';
import type { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';

import { DeviceHistoryFloor } from '../../../../../contexts/identities/domain/value-objects/DeviceHistoryFloor';
import { DevicePairingHistoryPolicy } from '../../../../../contexts/identities/domain/value-objects/DevicePairingHistoryPolicy';
import { DirectMessageHistoryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryStore';
import { DirectMessageHistoryTransfer } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryTransfer';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';

type StoredEnvelope = {
  cursor: number;
  envelopeId: string;
  plaintext: Uint8Array;
};

describe(DirectMessageHistoryTransfer.name, () => {
  const secret = SymmetricKey.fromBuffer(Buffer.alloc(32, 11));
  const conversationId = 'conversation-1';
  const sealedRoot = SymmetricKey.fromBuffer(Buffer.alloc(32, 5));
  const now = Date.now();
  const recent = (offset: number): number => now - 60_000 + offset;
  const daysAgo = (days: number): number =>
    new Timestamp(now).addDays(-days).toMilliseconds();
  const defaultFloor = (): DeviceHistoryFloor =>
    DevicePairingHistoryPolicy.DEFAULT.floorAt(new Timestamp(now));

  const session = (root: SymmetricKey = sealedRoot): Session =>
    ({
      deviceSealedRootKey: root,
      identity: { id: 'alice' },
    }) as unknown as Session;

  const sent = (id: string, createdAt: number): DirectSentRecord => ({
    authorId: 'alice',
    conversationId,
    createdAt,
    encryptedPayload: `ciphertext-${id}`,
    id,
    previousMessageIds: [],
    type: 'sent',
  });

  const plaintextOf = (
    record: DirectSentRecord,
    root: SymmetricKey = sealedRoot,
  ) =>
    DirectMessageMailboxRecord.encode(
      record,
      MailboxRecordAuthorship.tag(root, record),
    );

  const texts = (values: Uint8Array[]): string[] =>
    values.map((value) => Buffer.from(value).toString('base64'));

  const databaseName = (): string => `direct-history-${randomUUID()}`;

  /** An in-memory node: one mailbox per id, cursors in append order. */
  const fakeNode = () => {
    const mailboxes = new Map<string, StoredEnvelope[]>();
    const channel = mock<MailboxChannel>();

    channel.createInbox.mockImplementation((box) => {
      if (!mailboxes.has(box.mailboxId)) mailboxes.set(box.mailboxId, []);

      return Promise.resolve();
    });
    channel.send.mockImplementation(
      (box, plaintext, envelopeId = randomUUID()) => {
        const envelopes = mailboxes.get(box.mailboxId);

        if (!envelopes) return Promise.reject(new Error('Missing mailbox.'));

        const cursor = envelopes.length + 1;

        envelopes.push({ cursor, envelopeId, plaintext });

        return Promise.resolve({ cursor, envelopeId });
      },
    );
    channel.read.mockImplementation((box, _readers, after, limit) => {
      const pending = (mailboxes.get(box.mailboxId) ?? []).filter(
        (envelope) => envelope.cursor > after,
      );
      const page = pending.slice(0, limit);
      const last = page[page.length - 1];

      return Promise.resolve({
        envelopes: page,
        hasMore: pending.length > page.length,
        lastCursor: last?.cursor ?? after,
        recreated: false,
      });
    });
    channel.acknowledge.mockResolvedValue({ recreated: false });

    return { channel };
  };

  /** Publishes the exporter history under a floor and imports it anew. */
  const transferred = async (
    records: DirectSentRecord[],
    floor: DeviceHistoryFloor,
  ) => {
    const { channel } = fakeNode();
    const exporter = new DirectMessageHistoryStore(databaseName());
    const importer = new DirectMessageHistoryStore(databaseName());

    await exporter.append(
      session(),
      conversationId,
      records.map((record) => ({
        plaintext: plaintextOf(record),
        recordId: record.id,
      })),
    );
    await new DirectMessageHistoryTransfer(channel, exporter).publish(
      session(),
      secret,
      floor,
    );
    await new DirectMessageHistoryTransfer(channel, importer).receive(
      session(),
      secret,
    );

    return {
      channel,
      imported: texts(await importer.load(session(), conversationId)),
    };
  };

  it('replays the exporter history on the new device', async () => {
    const first = sent('m1', recent(1));
    const second = sent('m2', recent(2));

    const { imported } = await transferred([first, second], defaultFloor());

    expect(imported).toEqual(texts([first, second].map((r) => plaintextOf(r))));
  });

  it('exports only the last 30 days under the default policy', async () => {
    const old = sent('old', daysAgo(31));
    const fresh = sent('fresh', daysAgo(29));

    const { imported } = await transferred([old, fresh], defaultFloor());

    expect(imported).toEqual(texts([plaintextOf(fresh)]));
  });

  it('exports every record under All history', async () => {
    const old = sent('old', daysAgo(400));
    const fresh = sent('fresh', recent(1));

    const { imported } = await transferred(
      [old, fresh],
      DevicePairingHistoryPolicy.ALL.floorAt(new Timestamp(now)),
    );

    expect(imported).toEqual(texts([old, fresh].map((r) => plaintextOf(r))));
  });

  it('exports no record under Nothing yet still opens the transfer inbox', async () => {
    const { channel, imported } = await transferred(
      [sent('m1', recent(1))],
      DevicePairingHistoryPolicy.NONE.floorAt(new Timestamp(now)),
    );

    expect(imported).toEqual([]);
    expect(channel.createInbox).toHaveBeenCalledTimes(1);
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('exports at most MAX_RECORDS and keeps the newest under the default policy', async () => {
    const records = Array.from(
      { length: DirectMessageHistoryTransfer.MAX_RECORDS + 1 },
      (_, index) => sent(`m${index}`, recent(index)),
    );

    const { imported } = await transferred(records, defaultFloor());

    expect(imported).toEqual(
      texts(records.slice(1).map((record) => plaintextOf(record))),
    );
  }, 60_000);

  it('exports the newest records within 4 MiB sealed and skips an over-size one under the default policy', async () => {
    const large = (id: string, createdAt: number, size: number) => ({
      ...sent(id, createdAt),
      encryptedPayload: 'x'.repeat(size),
    });
    // 65 records in the largest (64 KiB) bucket: only 64 fit in 4 MiB.
    const fitting = Array.from({ length: 65 }, (_, index) =>
      large(`m${index}`, recent(index), 40_000),
    );
    const oversize = large('newest', recent(100), 70_000);

    const { imported } = await transferred(
      [...fitting, oversize],
      defaultFloor(),
    );

    expect(imported).toEqual(
      texts(fitting.slice(1).map((record) => plaintextOf(record))),
    );
  }, 60_000);

  it('does not throw when the publish fails', async () => {
    const { channel } = fakeNode();

    channel.createInbox.mockRejectedValue(new Error('offline'));

    await expect(
      new DirectMessageHistoryTransfer(
        channel,
        new DirectMessageHistoryStore(databaseName()),
      ).publish(session(), secret, defaultFloor()),
    ).resolves.toBeUndefined();
  });

  it('leaves the transfer unacknowledged when the new device cannot store it', async () => {
    const { channel } = fakeNode();
    const exporter = new DirectMessageHistoryStore(databaseName());

    await exporter.append(session(), conversationId, [
      { plaintext: plaintextOf(sent('m1', recent(1))), recordId: 'm1' },
    ]);
    await new DirectMessageHistoryTransfer(channel, exporter).publish(
      session(),
      secret,
      defaultFloor(),
    );
    jest.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    try {
      await new DirectMessageHistoryTransfer(
        channel,
        new DirectMessageHistoryStore(databaseName()),
      ).receive(session(), secret);
    } finally {
      jest.restoreAllMocks();
    }

    expect(channel.acknowledge).not.toHaveBeenCalled();
  });

  it('does not import records authored under another root', async () => {
    const { channel } = fakeNode();
    const exporter = new DirectMessageHistoryStore(databaseName());
    const importer = new DirectMessageHistoryStore(databaseName());
    const other = SymmetricKey.fromBuffer(Buffer.alloc(32, 9));

    await exporter.append(session(), conversationId, [
      { plaintext: plaintextOf(sent('m1', recent(1))), recordId: 'm1' },
    ]);
    await new DirectMessageHistoryTransfer(channel, exporter).publish(
      session(),
      secret,
      defaultFloor(),
    );
    await new DirectMessageHistoryTransfer(channel, importer).receive(
      session(other),
      secret,
    );

    expect(await importer.load(session(other), conversationId)).toEqual([]);
  });
});
