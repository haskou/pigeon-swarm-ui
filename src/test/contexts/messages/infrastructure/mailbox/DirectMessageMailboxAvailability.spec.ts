import 'fake-indexeddb/auto';
import { Buffer } from 'buffer';
import { type MockProxy, mock } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';
import type { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import type { ChatMessage } from '../../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../../contexts/messages/presentation/view-models/DirectMessageTimelineChange';

import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxKeySchedule } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { DirectMessageAvailabilityAnnouncement } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAvailabilityAnnouncement';
import { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import { DirectMessageMailboxStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import { DirectMessageReaderSet } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
import { RecipientMailboxRouter } from '../../../../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';

/**
 * Mailbox availability across nodes: the recipient opens its inbox on the
 * availability servers it picked and announces them to the sender inside the
 * encrypted channel. The sender appends every record to each announced server
 * as well as to the recipient's home, and the recipient reads every server,
 * applying a record once by its id.
 */
describe('DirectMessageMailbox availability servers', () => {
  const sharedSecret = Buffer.alloc(32, 7);
  const conversationId = 'conversation-1';
  const conversation = {
    id: conversationId,
    networkId: 'network-1',
    participantIds: ['alice', 'bob'],
    type: 'one-to-one',
  } as unknown as ConversationResource;
  const extraBase = 'https://b.example';
  const sent: MessageResource & { id: string } = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: [],
    type: 'sent',
  };

  const credentialFor = (identityId: string): string =>
    `device-credential-${identityId}`;

  const session = (identityId: string): Session =>
    ({
      deviceCredentialKeyPair: {
        toPrimitives: () => ({ publicKey: credentialFor(identityId) }),
      },
      identity: { id: identityId },
      keychain: {
        conversations: {
          [conversationId]: {
            algorithm: 'aes-256-gcm',
            conversationId,
            createdAt: 1,
            key: sharedSecret.toString('base64'),
            kind: 'conversation',
            peerIdentityId: identityId === 'alice' ? 'bob' : 'alice',
            version: 2,
          },
        },
        version: 1,
      },
      masterKey: {
        getBuffer: () => Buffer.alloc(32, identityId === 'alice' ? 3 : 9),
      },
    }) as unknown as Session;

  const mailboxIdOf = (identityId: string): string =>
    MailboxKeySchedule.derive(sharedSecret, identityId, 0).mailboxId;

  interface FakeNode {
    acked(mailboxId: string): number;
    envelopeIds(mailboxId: string): string[];
    hasInbox(mailboxId: string): boolean;
    setDown(value: boolean): void;
    wire: MockProxy<PigeonMailboxClient>;
  }

  /**
   * A node holding any number of inboxes. Reads and acknowledgements need a
   * registered reader token; appends need the inbox to exist. A node that is
   * down fails every call.
   */
  const fakeNode = (): FakeNode => {
    type Inbox = {
      acked: number;
      envelopes: { body: string; cursor: number; envelopeId: string }[];
      nextCursor: number;
      readers: Set<string>;
    };
    const inboxes = new Map<string, Inbox>();
    let down = false;
    const reachable = (): void => {
      if (down) throw new Error('offline');
    };
    const readable = (mailboxId: string, readToken: string): Inbox => {
      reachable();
      const inbox = inboxes.get(mailboxId);

      if (!inbox?.readers.has(MailboxCapability.hash(readToken))) {
        throw new MailboxUnavailableError();
      }

      return inbox;
    };
    const wire = mock<PigeonMailboxClient>();

    wire.create.mockImplementation((mailboxId, creation) => {
      reachable();
      const existing = inboxes.get(mailboxId);

      if (existing && !existing.readers.has(creation.readTokenHash)) {
        return Promise.reject(new Error('mailbox exists'));
      }

      if (!existing) {
        inboxes.set(mailboxId, {
          acked: 0,
          envelopes: [],
          nextCursor: 1,
          readers: new Set([creation.readTokenHash]),
        });
      }

      return Promise.resolve();
    });
    wire.readers.mockImplementation((mailboxId, readToken) =>
      Promise.resolve({
        maxReaders: 8,
        readers: [...readable(mailboxId, readToken).readers].map(
          (readTokenHash) => ({ ackedCursor: 0, readTokenHash }),
        ),
      }),
    );
    wire.addReader.mockImplementation((mailboxId, readToken, readTokenHash) => {
      readable(mailboxId, readToken).readers.add(readTokenHash);

      return Promise.resolve();
    });
    wire.removeReader.mockImplementation(
      (mailboxId, readToken, readTokenHash) => {
        readable(mailboxId, readToken).readers.delete(readTokenHash);

        return Promise.resolve();
      },
    );
    wire.append.mockImplementation((mailboxId, _postToken, input) => {
      reachable();
      const inbox = inboxes.get(mailboxId);

      if (!inbox) throw new MailboxUnavailableError();

      const known = inbox.envelopes.find(
        (envelope) => envelope.envelopeId === input.envelopeId,
      );

      if (known) return Promise.resolve({ cursor: known.cursor });

      const cursor = inbox.nextCursor;

      inbox.nextCursor += 1;
      inbox.envelopes.push({ ...input, cursor });

      return Promise.resolve({ cursor });
    });
    wire.read.mockImplementation((mailboxId, readToken, after, limit) =>
      Promise.resolve({
        envelopes: readable(mailboxId, readToken)
          .envelopes.filter((envelope) => envelope.cursor > after)
          .slice(0, limit),
        hasMore: false,
      }),
    );
    wire.acknowledge.mockImplementation((mailboxId, readToken, upTo) => {
      const inbox = readable(mailboxId, readToken);

      inbox.acked = Math.max(inbox.acked, upTo);

      return Promise.resolve();
    });

    return {
      acked: (mailboxId: string) => inboxes.get(mailboxId)?.acked ?? 0,
      envelopeIds: (mailboxId: string) =>
        (inboxes.get(mailboxId)?.envelopes ?? []).map(
          (envelope) => envelope.envelopeId,
        ),
      hasInbox: (mailboxId: string) => inboxes.has(mailboxId),
      setDown: (value: boolean) => {
        down = value;
      },
      wire,
    };
  };

  const projectionDouble = () => {
    const port = mock<Pick<MessageProjectionPort, 'decrypt' | 'decryptMany'>>();
    const decrypted = (message: MessageResource): ChatMessage =>
      ({
        id: message.id,
        raw: message,
        text: 'decrypted',
        timestamp: message.createdAt,
      }) as unknown as ChatMessage;

    port.decrypt.mockImplementation((_session, _id, message) =>
      Promise.resolve(decrypted(message)),
    );
    port.decryptMany.mockImplementation((_session, _id, records) =>
      Promise.resolve(records.map(decrypted)),
    );

    return port;
  };

  const composerDouble = () => {
    const composer =
      mock<Pick<PigeonMessageCommandsApi, 'composeEdit' | 'withSentRecord'>>();

    composer.withSentRecord.mockImplementation(
      (_session, _id, _content, _options, deliver) => deliver(sent),
    );

    return composer;
  };

  /**
   * One identity's client: connected to `home`, reading its inbox on the
   * availability servers it picked, and reaching any announced server of the
   * test network.
   */
  const clientOn = (
    home: FakeNode,
    network: Readonly<Record<string, FakeNode>>,
    picked: readonly string[],
  ): DirectMessageMailbox => {
    const devices = (s: Session) =>
      Promise.resolve([credentialFor(s.identity.id)]);
    const channels = new Map<string, MailboxChannel>();
    const channelFor = (base: string): MailboxChannel => {
      const channel =
        channels.get(base) ?? new MailboxChannel(network[base].wire, jest.fn());

      channels.set(base, channel);

      return channel;
    };
    const channel = new MailboxChannel(home.wire, jest.fn());

    return new DirectMessageMailbox(
      channel,
      new RecipientMailboxRouter(
        channel,
        () => Promise.resolve(undefined),
        channelFor,
      ),
      new DirectMessageMailboxStore(),
      projectionDouble(),
      new DirectMessageReaderSet(channel, devices),
      composerDouble(),
      picked.map((base) => ({
        base,
        channel: channelFor(base),
        readerSet: new DirectMessageReaderSet(channelFor(base), devices),
        store: new DirectMessageMailboxStore(base),
      })),
    );
  };

  const syncPass = (
    mailbox: DirectMessageMailbox,
    identityId: string,
    apply: (changes: DirectMessageTimelineChange[]) => void = jest.fn(),
  ): Promise<void> =>
    mailbox.sync(
      session(identityId),
      conversationId,
      new AbortController().signal,
      apply,
    );

  const outboxSettled = (
    mailbox: DirectMessageMailbox,
    identityId: string,
  ): Promise<void> =>
    new Promise<void>((resolve) => {
      const check = (): void => {
        if (
          mailbox
            .outboxItems(identityId, conversationId)
            .every((item) => item.state === 'failed')
        ) {
          resolve();
        }
      };

      mailbox.subscribeOutbox(check);
      check();
    });

  const messageIds = (apply: jest.Mock): string[] =>
    apply.mock.calls.flatMap(([changes]) =>
      (changes as DirectMessageTimelineChange[]).flatMap((change) =>
        change.kind === 'message' ? [change.message.id] : [],
      ),
    );

  /** Appends a raw announcement to Alice's inbox on the given node. */
  const announceToAlice = async (
    node: FakeNode,
    announcement: {
      authorId: string;
      createdAt: number;
      servers: string[];
    },
  ): Promise<void> => {
    await new MailboxChannel(node.wire, jest.fn()).send(
      MailboxKeySchedule.derive(sharedSecret, 'alice', 0),
      DirectMessageAvailabilityAnnouncement.encode({
        ...announcement,
        conversationId,
      }),
    );
  };

  beforeEach(() => {
    const storage = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  /** Alice and Bob share a home node; Bob also picked one extra server. */
  const network = () => {
    const home = fakeNode();
    const extra = fakeNode();
    const nodes = { [extraBase]: extra };
    const alice = clientOn(home, nodes, []);
    const bob = clientOn(home, nodes, [extraBase]);

    return { alice, bob, extra, home };
  };

  /** Both inboxes open, Bob's announcement received by Alice. */
  const announced = async () => {
    const parties = network();

    await syncPass(parties.alice, 'alice');
    await syncPass(parties.bob, 'bob');
    await syncPass(parties.alice, 'alice');

    return parties;
  };

  it('opens the recipient inbox on every picked availability server', async () => {
    const { bob, extra, home } = network();

    await syncPass(bob, 'bob');

    expect(home.hasInbox(mailboxIdOf('bob'))).toBe(true);
    expect(extra.hasInbox(mailboxIdOf('bob'))).toBe(true);
  });

  it('announces the opened servers to the peer once', async () => {
    const { alice, bob, home } = network();

    await syncPass(alice, 'alice');
    await syncPass(bob, 'bob');
    await syncPass(bob, 'bob');

    expect(home.envelopeIds(mailboxIdOf('alice'))).toHaveLength(1);
  });

  it('appends no announcement when no availability server is picked', async () => {
    const home = fakeNode();
    const alice = clientOn(home, {}, []);
    const bob = clientOn(home, {}, []);

    await syncPass(alice, 'alice');
    await syncPass(bob, 'bob');

    expect(home.envelopeIds(mailboxIdOf('alice'))).toEqual([]);
  });

  it('appends each record to the home and to every announced server under one envelope id', async () => {
    const { alice, extra, home } = await announced();

    await alice.send(session('alice'), conversation, 'hello', {});
    await outboxSettled(alice, 'alice');

    const homeIds = home.envelopeIds(mailboxIdOf('bob'));
    expect(homeIds).toHaveLength(1);
    expect(extra.envelopeIds(mailboxIdOf('bob'))).toEqual(homeIds);
  });

  it('applies a record replicated on two servers once and acknowledges both', async () => {
    const { alice, bob, extra, home } = await announced();
    const apply = jest.fn();

    await alice.send(session('alice'), conversation, 'hello', {});
    await outboxSettled(alice, 'alice');
    await syncPass(bob, 'bob', apply);

    expect(messageIds(apply)).toEqual(['message-1']);
    expect(home.acked(mailboxIdOf('bob'))).toBe(1);
    expect(extra.acked(mailboxIdOf('bob'))).toBe(1);
  });

  it('delivers through the availability server while the home node is down', async () => {
    const debug = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const { alice, bob, extra, home } = await announced();
    const apply = jest.fn();

    home.setDown(true);
    await alice.send(session('alice'), conversation, 'hello', {});
    await outboxSettled(alice, 'alice');

    expect(extra.envelopeIds(mailboxIdOf('bob'))).toHaveLength(1);

    await expect(syncPass(bob, 'bob', apply)).rejects.toThrow('offline');
    expect(messageIds(apply)).toEqual(['message-1']);
    debug.mockRestore();
  });

  it('ignores servers announced by anyone but the conversation peer', async () => {
    const home = fakeNode();
    const extra = fakeNode();
    const alice = clientOn(home, { [extraBase]: extra }, []);
    const bob = clientOn(home, {}, []);

    await syncPass(alice, 'alice');
    await syncPass(bob, 'bob');
    await announceToAlice(home, {
      authorId: 'mallory',
      createdAt: 5,
      servers: [extraBase],
    });
    await announceToAlice(home, {
      authorId: 'alice',
      createdAt: 6,
      servers: [extraBase],
    });
    await syncPass(alice, 'alice');
    await alice.send(session('alice'), conversation, 'hello', {});
    await outboxSettled(alice, 'alice');

    expect(extra.wire.append).not.toHaveBeenCalled();
  });

  it('keeps the newest announcement when an older one arrives later', async () => {
    const home = fakeNode();
    const extra = fakeNode();
    const alice = clientOn(home, { [extraBase]: extra }, []);
    const bob = clientOn(home, { [extraBase]: extra }, [extraBase]);

    await syncPass(alice, 'alice');
    await syncPass(bob, 'bob');
    await announceToAlice(home, {
      authorId: 'bob',
      createdAt: 1,
      servers: [],
    });
    await syncPass(alice, 'alice');
    await alice.send(session('alice'), conversation, 'hello', {});
    await outboxSettled(alice, 'alice');

    expect(extra.envelopeIds(mailboxIdOf('bob'))).toHaveLength(1);
  });
});
