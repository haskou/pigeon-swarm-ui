import type { MockProxy } from 'jest-mock-extended';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageOutboxDelivery } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutbox';
import type { DirectMessageOutboxRow } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxStore';

import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { DirectMessageOutbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutbox';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const marker = 'plaintext-marker-2b7c';

type Store = {
  load(session: Session): Promise<DirectMessageOutboxRow[]>;
  remove(identityId: string, id: string): Promise<void>;
  save(session: Session, row: DirectMessageOutboxRow): Promise<void>;
  forget(identityId: string): Promise<void>;
};

class MemoryOutboxStore implements Store {
  public readonly rows = new Map<string, DirectMessageOutboxRow>();

  public load(session: Session): Promise<DirectMessageOutboxRow[]> {
    const prefix = `${session.identity.id}\u0000`;

    return Promise.resolve(
      [...this.rows.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, row]) => structuredClone(row)),
    );
  }

  public remove(identityId: string, id: string): Promise<void> {
    this.rows.delete(`${identityId}\u0000${id}`);

    return Promise.resolve();
  }

  public save(session: Session, row: DirectMessageOutboxRow): Promise<void> {
    this.rows.set(
      `${session.identity.id}\u0000${row.id}`,
      structuredClone(row),
    );

    return Promise.resolve();
  }

  public forget(identityId: string): Promise<void> {
    const prefix = `${identityId}\u0000`;

    for (const key of [...this.rows.keys()]) {
      if (key.startsWith(prefix)) this.rows.delete(key);
    }

    return Promise.resolve();
  }
}

function session(identityId = 'identity-1'): Session {
  return { identity: { id: identityId } } as unknown as Session;
}

function draft(
  id: string,
  peerIdentityId = 'identity-2',
  conversationId = 'conversation-1',
) {
  return {
    conversationId,
    peerIdentityId,
    record: {
      authorId: 'identity-1',
      conversationId,
      createdAt: 1,
      encryptedPayload: `${marker}:${id}`,
      id,
      previousMessageIds: [],
      type: 'sent',
    } as unknown as DirectMessageOutboxRow['record'],
  };
}

async function settle(): Promise<void> {
  await jest.advanceTimersByTimeAsync(0);
}

describe(DirectMessageOutbox.name, () => {
  let store: MemoryOutboxStore;
  let delivery: MockProxy<DirectMessageOutboxDelivery>;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new MemoryOutboxStore();
    delivery = mock<DirectMessageOutboxDelivery>();
    delivery.toPeer.mockResolvedValue(undefined);
    delivery.toOwn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('persists a send before the first peer attempt', async () => {
    let rowsAtAttempt = -1;

    delivery.toPeer.mockImplementation(() => {
      rowsAtAttempt = store.rows.size;

      return Promise.resolve();
    });

    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a'));

    await ticket.delivered;

    expect(rowsAtAttempt).toBe(1);
  });

  it('delivers to the peer, then to the own inbox, and clears the row', async () => {
    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a'));

    await expect(ticket.delivered).resolves.toBeUndefined();

    expect(delivery.toPeer).toHaveBeenCalledTimes(1);
    expect(delivery.toOwn).toHaveBeenCalledTimes(1);
    expect(await store.load(session())).toEqual([]);
  });

  it('rejects the send without attempting delivery when it cannot be persisted', async () => {
    jest.spyOn(store, 'save').mockRejectedValueOnce(new Error('quota'));

    const outbox = new DirectMessageOutbox(store, delivery);

    await expect(outbox.enqueue(session(), draft('a'))).rejects.toThrow(
      'quota',
    );
    expect(delivery.toPeer).not.toHaveBeenCalled();
  });

  it('retries an absent peer inbox with backoff until it opens', async () => {
    delivery.toPeer
      .mockRejectedValueOnce(new MailboxUnavailableError())
      .mockRejectedValueOnce(new MailboxUnavailableError());

    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a'));

    await jest.advanceTimersByTimeAsync(1_000);

    await expect(ticket.delivered).resolves.toBeUndefined();
    expect(delivery.toPeer).toHaveBeenCalledTimes(3);
  });

  it('keeps a send in the retry state past the first 30 seconds', async () => {
    delivery.toPeer.mockRejectedValue(new MailboxUnavailableError());

    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a'));
    const settled = jest.fn();

    ticket.delivered.then(settled, settled);

    await jest.advanceTimersByTimeAsync(31_000);

    expect(settled).not.toHaveBeenCalled();
    expect(outbox.items('identity-1', 'conversation-1')).toEqual([
      expect.objectContaining({ id: 'a', state: 'retry' }),
    ]);

    delivery.toPeer.mockResolvedValue(undefined);
    await jest.advanceTimersByTimeAsync(120_000);

    await expect(ticket.delivered).resolves.toBeUndefined();
  });

  it('marks a fault as failed, keeps the row, and waits for an explicit retry', async () => {
    delivery.toPeer.mockRejectedValueOnce(
      new HttpJsonError(500, 'Internal Server Error', ''),
    );

    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a'));

    await expect(ticket.delivered).rejects.toBeInstanceOf(HttpJsonError);
    expect(outbox.items('identity-1', 'conversation-1')).toEqual([
      expect.objectContaining({ id: 'a', state: 'failed' }),
    ]);
    expect(await store.load(session())).toEqual([
      expect.objectContaining({ id: 'a', state: 'failed' }),
    ]);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(delivery.toPeer).toHaveBeenCalledTimes(1);

    const retried = outbox.retry(session(), 'a');

    expect(retried).toBeDefined();
    await expect(retried?.delivered).resolves.toBeUndefined();
    expect(delivery.toPeer).toHaveBeenCalledTimes(2);
    expect(await store.load(session())).toEqual([]);
  });

  it('returns no ticket when retrying a message that is not queued', () => {
    const outbox = new DirectMessageOutbox(store, delivery);

    expect(outbox.retry(session(), 'missing')).toBeUndefined();
  });

  it('resumes a persisted send after a reload with the same record id', async () => {
    const firstDelivery = mock<DirectMessageOutboxDelivery>();

    firstDelivery.toPeer.mockRejectedValue(new MailboxUnavailableError());
    firstDelivery.toOwn.mockResolvedValue(undefined);
    await new DirectMessageOutbox(store, firstDelivery).enqueue(
      session(),
      draft('a'),
    );

    const second = new DirectMessageOutbox(store, delivery);

    await second.resume(session());
    await jest.advanceTimersByTimeAsync(1_000);

    expect(delivery.toPeer).toHaveBeenCalledWith(
      session(),
      expect.objectContaining({ id: 'a' }),
    );
    expect(delivery.toOwn).toHaveBeenCalledTimes(1);
    expect(await store.load(session())).toEqual([]);
  });

  it('does not append to the peer again after a reload that follows the peer copy', async () => {
    const own = new Promise<void>(() => undefined);
    const firstDelivery = mock<DirectMessageOutboxDelivery>();

    firstDelivery.toPeer.mockResolvedValue(undefined);
    firstDelivery.toOwn.mockReturnValue(own);
    await new DirectMessageOutbox(store, firstDelivery).enqueue(
      session(),
      draft('a'),
    );
    await settle();

    expect(await store.load(session())).toEqual([
      expect.objectContaining({ id: 'a', peerDelivered: true }),
    ]);

    const second = new DirectMessageOutbox(store, delivery);

    await second.resume(session());
    await settle();

    expect(delivery.toPeer).not.toHaveBeenCalled();
    expect(delivery.toOwn).toHaveBeenCalledWith(
      session(),
      expect.objectContaining({ id: 'a', peerDelivered: true }),
    );
    expect(await store.load(session())).toEqual([]);
  });

  it('does not hold back a send to another peer while one peer inbox is absent', async () => {
    delivery.toPeer.mockImplementation((_session, row) =>
      row.peerIdentityId === 'identity-2'
        ? Promise.reject(new MailboxUnavailableError())
        : Promise.resolve(),
    );

    const outbox = new DirectMessageOutbox(store, delivery);

    await outbox.enqueue(session(), draft('a', 'identity-2'));

    const other = await outbox.enqueue(session(), draft('b', 'identity-3'));

    await expect(other.delivered).resolves.toBeUndefined();
    expect(outbox.items('identity-1', 'conversation-1')).toEqual([
      expect.objectContaining({ id: 'a', state: 'retry' }),
    ]);
  });

  it("lists each message's state for its own conversation only", async () => {
    delivery.toPeer.mockRejectedValue(new MailboxUnavailableError());

    const outbox = new DirectMessageOutbox(store, delivery);

    await outbox.enqueue(session(), draft('a', 'identity-2', 'conversation-1'));
    await outbox.enqueue(session(), draft('b', 'identity-2', 'conversation-2'));

    expect(
      outbox.items('identity-1', 'conversation-1').map((item) => item.id),
    ).toEqual(['a']);
    expect(
      outbox.items('identity-1', 'conversation-2').map((item) => item.id),
    ).toEqual(['b']);
  });

  it('cancel stops retries and wipes the identity rows', async () => {
    delivery.toPeer.mockRejectedValue(new MailboxUnavailableError());

    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a'));

    await settle();
    await outbox.cancel('identity-1');

    await expect(ticket.delivered).rejects.toThrow();

    const attemptsAtCancel = delivery.toPeer.mock.calls.length;

    await jest.advanceTimersByTimeAsync(120_000);

    expect(delivery.toPeer).toHaveBeenCalledTimes(attemptsAtCancel);
    expect(await store.load(session())).toEqual([]);
    expect(outbox.items('identity-1', 'conversation-1')).toEqual([]);
  });

  it('logs no payload, peer id, or error text', async () => {
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    delivery.toPeer.mockRejectedValue(
      new HttpJsonError(500, 'Internal Server Error', marker),
    );

    const outbox = new DirectMessageOutbox(store, delivery);
    const ticket = await outbox.enqueue(session(), draft('a', 'identity-2'));

    await expect(ticket.delivered).rejects.toThrow();

    const logged = JSON.stringify([
      debug.mock.calls,
      log.mock.calls,
      warn.mock.calls,
      error.mock.calls,
    ]);

    expect(logged).not.toContain(marker);
    expect(logged).not.toContain('identity-2');
  });

  it('notifies subscribers when a message changes state', async () => {
    delivery.toPeer.mockRejectedValue(new MailboxUnavailableError());

    const outbox = new DirectMessageOutbox(store, delivery);
    const listener = jest.fn();

    const unsubscribe = outbox.subscribe(listener);

    await outbox.enqueue(session(), draft('a'));
    await settle();

    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();

    await outbox.cancel('identity-1');

    expect(listener).not.toHaveBeenCalled();
  });
});
