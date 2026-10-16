import 'fake-indexeddb/auto';
import {
  MailboxRecordAuthorship,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectSentRecord } from '../../../../../contexts/mailboxes/domain/DirectSentRecord';

import { DirectMessageHistoryBackup } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryBackup';
import { DirectMessageHistoryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryStore';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { DirectMessageRecordReader } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageRecordReader';

describe(DirectMessageHistoryBackup.name, () => {
  const conversationId = 'conversation-1';
  const previousRoot = SymmetricKey.fromBuffer(Buffer.alloc(32, 5));
  const rotatedRoot = SymmetricKey.fromBuffer(Buffer.alloc(32, 6));

  const session = (root: SymmetricKey = previousRoot): Session =>
    ({
      deviceSealedRootKey: root,
      identity: { id: 'alice' },
    }) as unknown as Session;

  const sent = (
    id: string,
    createdAt: number,
    authorId = 'alice',
  ): DirectSentRecord => ({
    authorId,
    conversationId,
    createdAt,
    encryptedPayload: `ciphertext-${id}`,
    id,
    previousMessageIds: [],
    type: 'sent',
  });

  const own = (record: DirectSentRecord, root: SymmetricKey = previousRoot) =>
    DirectMessageMailboxRecord.encode(
      record,
      MailboxRecordAuthorship.tag(root, record),
    );

  const store = () =>
    new DirectMessageHistoryStore(`direct-history-${randomUUID()}`);
  const ids = (reader: Session, values: Uint8Array[]): string[] =>
    values.map(
      (value) =>
        DirectMessageRecordReader.decode(reader, conversationId, value)?.id ??
        'rejected',
    );

  it('exports every stored record, oldest first', async () => {
    const history = store();
    const records = Array.from({ length: 600 }, (_, index) =>
      sent(`m${index}`, index),
    );

    await history.append(
      session(),
      conversationId,
      records.map((record) => ({
        plaintext: own(record),
        recordId: record.id,
      })),
    );

    const items = await new DirectMessageHistoryBackup(history).export(
      session(),
    );

    expect(items).toHaveLength(600);
    expect(items[0]?.conversationId).toBe(conversationId);
    expect(
      ids(session(), [items[0]!.plaintext, items[599]!.plaintext]),
    ).toEqual(['m0', 'm599']);
  }, 60_000);

  it('restores own records under the current device root, keeping peer records', async () => {
    const exporter = store();
    const importer = store();
    const peer = DirectMessageMailboxRecord.encode(sent('p1', 50, 'bob'));

    await exporter.append(session(), conversationId, [
      { plaintext: peer, recordId: 'p1' },
      { plaintext: own(sent('m1', 100)), recordId: 'm1' },
    ]);
    const items = await new DirectMessageHistoryBackup(exporter).export(
      session(),
    );

    await new DirectMessageHistoryBackup(importer).import(
      session(rotatedRoot),
      items,
    );

    const restored = await importer.load(session(rotatedRoot), conversationId);
    expect(ids(session(rotatedRoot), restored)).toEqual(['p1', 'm1']);
    expect(Buffer.from(restored[0]!).equals(Buffer.from(peer))).toBe(true);
  });

  it('does not duplicate records restored twice or already on the device', async () => {
    const history = store();
    const first = own(sent('m1', 100));

    await history.append(session(), conversationId, [
      { plaintext: first, recordId: 'm1' },
    ]);
    const items = await new DirectMessageHistoryBackup(history).export(
      session(),
    );
    const backup = new DirectMessageHistoryBackup(history);

    await backup.import(session(), items);
    await backup.import(session(), items);

    expect(await history.load(session(), conversationId)).toHaveLength(1);
  });

  it('skips records whose author id the value object rejects', async () => {
    const history = store();

    await new DirectMessageHistoryBackup(history).import(session(), [
      {
        conversationId,
        plaintext: DirectMessageMailboxRecord.encode(
          sent('p1', 50, 'x'.repeat(5000)),
        ),
      },
      { conversationId, plaintext: own(sent('m1', 100)) },
    ]);

    expect(
      ids(session(), await history.load(session(), conversationId)),
    ).toEqual(['m1']);
  });

  it('skips entries that are not direct-message records', async () => {
    const history = store();

    await new DirectMessageHistoryBackup(history).import(session(), [
      { conversationId, plaintext: new TextEncoder().encode('garbage') },
      {
        conversationId: 'conversation-2',
        plaintext: own(sent('m1', 100)),
      },
      { conversationId, plaintext: own(sent('m2', 200)) },
    ]);

    expect(
      ids(session(), await history.load(session(), conversationId)),
    ).toEqual(['m2']);
    expect(await history.load(session(), 'conversation-2')).toEqual([]);
  });
});
