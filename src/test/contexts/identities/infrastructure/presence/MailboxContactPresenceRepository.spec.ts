import { MailboxReadToken, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';
import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';

import { ContactPresence } from '../../../../../contexts/identities/domain/ContactPresence';
import { PresenceSharing } from '../../../../../contexts/identities/domain/PresenceSharing';
import { ContactPresenceSequence } from '../../../../../contexts/identities/domain/value-objects/ContactPresenceSequence';
import { ContactPresenceSource } from '../../../../../contexts/identities/domain/value-objects/ContactPresenceSource';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPresenceStatus } from '../../../../../contexts/identities/domain/value-objects/IdentityPresenceStatus';
import { MailboxContactPresenceRepository } from '../../../../../contexts/identities/infrastructure/presence/MailboxContactPresenceRepository';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/domain/errors/MailboxUnavailableError';
import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { RecipientMailboxRouter } from '../../../../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const ALICE = IdentityId.fromString('identity-alice');
const BOB = IdentityId.fromString('identity-bob');
const CONVERSATION = 'conversation-ab';
const SEALED = SymmetricKey.fromBuffer(Buffer.alloc(32, 1));
const ROTATED = SymmetricKey.fromBuffer(Buffer.alloc(32, 2));
/** Alice shares with Bob; Bob reads what Alice sent. */
const TO_BOB = PresenceSharing.fromPrimitives({
  contactIdentityId: BOB.toString(),
  conversationId: CONVERSATION,
});
const FROM_ALICE = PresenceSharing.fromPrimitives({
  contactIdentityId: ALICE.toString(),
  conversationId: CONVERSATION,
});

type FakeInbox = {
  envelopes: { body: string; cursor: number; envelopeId: string }[];
  lastCursor: number;
  postTokenHash: string;
  readers: Map<string, number>;
};

/**
 * A node holding mailboxes the way the mailbox routes do: creation names the
 * first reader, each reader acks its own cursor, an envelope goes once every
 * reader acked it and the last reader cannot be removed.
 */
const fakeNode = () => {
  const inboxes = new Map<string, FakeInbox>();
  const wire = mock<PigeonMailboxClient>();
  const inboxFor = (mailboxId: string, token: string): FakeInbox => {
    const inbox = inboxes.get(mailboxId);

    if (!inbox?.readers.has(MailboxCapability.hash(token))) {
      throw new MailboxUnavailableError();
    }

    return inbox;
  };
  const settle = (inbox: FakeInbox): void => {
    const floor = Math.min(...inbox.readers.values());

    inbox.envelopes = inbox.envelopes.filter(({ cursor }) => cursor > floor);
  };

  wire.create.mockImplementation(async (mailboxId, creation) => {
    await Promise.resolve();
    const held = inboxes.get(mailboxId);

    if (!held) {
      inboxes.set(mailboxId, {
        envelopes: [],
        lastCursor: 0,
        postTokenHash: creation.postTokenHash,
        readers: new Map([[creation.readTokenHash, 0]]),
      });

      return;
    }

    if (!held.readers.has(creation.readTokenHash)) {
      throw new HttpJsonError(409, 'Conflict', '');
    }
  });
  wire.append.mockImplementation(async (mailboxId, postToken, input) => {
    await Promise.resolve();
    const inbox = inboxes.get(mailboxId);

    if (inbox?.postTokenHash !== MailboxCapability.hash(postToken)) {
      throw new MailboxUnavailableError();
    }
    inbox.lastCursor += 1;
    inbox.envelopes.push({ ...input, cursor: inbox.lastCursor });

    return { cursor: inbox.lastCursor };
  });
  wire.read.mockImplementation(async (mailboxId, token, after, limit) => {
    await Promise.resolve();
    const pending = inboxFor(mailboxId, token).envelopes.filter(
      ({ cursor }) => cursor > after,
    );

    return {
      envelopes: pending.slice(0, limit),
      hasMore: pending.length > limit,
    };
  });
  wire.acknowledge.mockImplementation(async (mailboxId, token, upTo) => {
    await Promise.resolve();
    const inbox = inboxFor(mailboxId, token);
    const hash = MailboxCapability.hash(token);

    inbox.readers.set(hash, Math.max(inbox.readers.get(hash) ?? 0, upTo));
    settle(inbox);
  });
  wire.readers.mockImplementation(async (mailboxId, token) => {
    await Promise.resolve();

    return {
      maxReaders: 129,
      readers: [...inboxFor(mailboxId, token).readers].map(
        ([readTokenHash, ackedCursor]) => ({ ackedCursor, readTokenHash }),
      ),
    };
  });
  wire.addReader.mockImplementation(async (mailboxId, token, readTokenHash) => {
    await Promise.resolve();
    const { readers } = inboxFor(mailboxId, token);

    if (!readers.has(readTokenHash)) readers.set(readTokenHash, 0);
  });
  wire.removeReader.mockImplementation(
    async (mailboxId, token, readTokenHash) => {
      await Promise.resolve();
      const inbox = inboxFor(mailboxId, token);

      if (inbox.readers.size === 1) {
        throw new HttpJsonError(409, 'Conflict', '');
      }
      inbox.readers.delete(readTokenHash);
      settle(inbox);
    },
  );
  wire.delete.mockImplementation(async (mailboxId, token) => {
    await Promise.resolve();
    inboxFor(mailboxId, token);
    inboxes.delete(mailboxId);
  });

  return {
    channel: new MailboxChannel(wire, () => Promise.resolve('nonce')),
    inboxes,
    wire,
  };
};

const sessionOf = (
  identityId: IdentityId,
  peerIdentityId: IdentityId,
  roots: { previous?: SymmetricKey; sealed: SymmetricKey } = { sealed: SEALED },
): Session =>
  ({
    deviceSealedRootKey: roots.sealed,
    identity: { id: identityId.toString() },
    keychain: {
      conversations: {
        [CONVERSATION]: {
          algorithm: 'aes-256-gcm',
          conversationId: CONVERSATION,
          createdAt: 0,
          key: Buffer.alloc(32, 7).toString('base64'),
          kind: 'conversation',
          peerIdentityId: peerIdentityId.toString(),
          version: 2,
        },
      },
      version: 1,
    },
    previousDeviceSealedRootKey: roots.previous,
  }) as unknown as Session;

const aliceUpdate = (status: IdentityPresenceStatus, sentAt: number) =>
  ContactPresence.create(
    ALICE,
    ContactPresenceSource.fromString('AAAAAAAAAAAAAAAAAAAAAA'),
    ContactPresenceSequence.fromPrimitives(sentAt + 1),
    status,
    new Timestamp(sentAt),
  );

const statusesOf = (presences: ContactPresence[]) =>
  presences.map((presence) => presence.toPrimitives().status);

const setup = () => {
  const node = fakeNode();
  const sessions = new Map<string, Session>([
    [ALICE.toString(), sessionOf(ALICE, BOB)],
    [BOB.toString(), sessionOf(BOB, ALICE)],
  ]);
  /** One app session on one device. */
  const device = (): MailboxContactPresenceRepository => {
    const contexts = mock<IdentityAccessContexts>();

    contexts.find.mockImplementation((identityId) => ({
      options: {},
      session: sessions.get(identityId.toString()) as Session,
    }));

    return new MailboxContactPresenceRepository(
      contexts,
      node.channel,
      new RecipientMailboxRouter(
        node.channel,
        () => Promise.resolve(undefined),
        () => node.channel,
      ),
    );
  };
  const bobInbox = (): { id: string; inbox: FakeInbox } => {
    const [[id, inbox]] = [...node.inboxes];

    return { id, inbox };
  };

  return { alice: device(), bob: device(), bobInbox, device, node, sessions };
};

describe(MailboxContactPresenceRepository.name, () => {
  it('relays only ciphertext and delivers the update to the contact', async () => {
    const { alice, bob, bobInbox } = setup();

    await bob.receive(BOB, FROM_ALICE, new Timestamp(0));
    await alice.publish(
      ALICE,
      TO_BOB,
      aliceUpdate(IdentityPresenceStatus.BUSY, 0),
    );

    const relayed = Buffer.from(
      bobInbox().inbox.envelopes[0].body,
      'base64url',
    ).toString('latin1');

    for (const marker of [ALICE.toString(), BOB.toString(), CONVERSATION]) {
      expect(relayed).not.toContain(marker);
    }
    expect(relayed).not.toContain('busy');
    await expect(
      bob.receive(BOB, FROM_ALICE, new Timestamp(1)).then(statusesOf),
    ).resolves.toEqual(['busy']);
  });

  it('opens the inbox with the root reader alone and reads each update once', async () => {
    const { alice, bob, bobInbox } = setup();

    await bob.receive(BOB, FROM_ALICE, new Timestamp(0));
    await alice.publish(
      ALICE,
      TO_BOB,
      aliceUpdate(IdentityPresenceStatus.AWAY, 0),
    );
    await bob.receive(BOB, FROM_ALICE, new Timestamp(1));

    const { id, inbox } = bobInbox();

    expect([...inbox.readers.keys()]).toEqual([
      MailboxCapability.hash(MailboxReadToken.derive(SEALED, id)),
    ]);
    await expect(
      bob.receive(BOB, FROM_ALICE, new Timestamp(2)),
    ).resolves.toEqual([]);
  });

  it('keeps a current update for the other devices and clears it once expired', async () => {
    const { alice, bobInbox, device } = setup();
    const laptop = device();
    const phone = device();

    await laptop.receive(BOB, FROM_ALICE, new Timestamp(0));
    await alice.publish(
      ALICE,
      TO_BOB,
      aliceUpdate(IdentityPresenceStatus.AVAILABLE, 0),
    );

    await expect(
      laptop.receive(BOB, FROM_ALICE, new Timestamp(1)).then(statusesOf),
    ).resolves.toEqual(['available']);
    await expect(
      phone.receive(BOB, FROM_ALICE, new Timestamp(1)).then(statusesOf),
    ).resolves.toEqual(['available']);
    expect(bobInbox().inbox.envelopes).toHaveLength(1);

    await laptop.receive(BOB, FROM_ALICE, new Timestamp(90_000));

    expect(bobInbox().inbox.envelopes).toHaveLength(0);
  });

  it('drops and clears an update not written by the contact', async () => {
    const { alice, bob, bobInbox } = setup();
    const carol = ContactPresence.create(
      IdentityId.fromString('identity-carol'),
      ContactPresenceSource.fromString('AAAAAAAAAAAAAAAAAAAAAA'),
      ContactPresenceSequence.first(),
      IdentityPresenceStatus.BUSY,
      new Timestamp(0),
    );

    await bob.receive(BOB, FROM_ALICE, new Timestamp(0));
    await alice.publish(ALICE, TO_BOB, carol);

    await expect(
      bob.receive(BOB, FROM_ALICE, new Timestamp(1)),
    ).resolves.toEqual([]);
    expect(bobInbox().inbox.envelopes).toHaveLength(0);
  });

  it('backs off a contact without an inbox for two minutes', async () => {
    const { alice, node } = setup();

    await expect(
      alice.publish(
        ALICE,
        TO_BOB,
        aliceUpdate(IdentityPresenceStatus.AVAILABLE, 0),
      ),
    ).resolves.toBeUndefined();
    await alice.publish(
      ALICE,
      TO_BOB,
      aliceUpdate(IdentityPresenceStatus.AVAILABLE, 119_999),
    );
    expect(node.wire.append).toHaveBeenCalledTimes(1);

    await alice.publish(
      ALICE,
      TO_BOB,
      aliceUpdate(IdentityPresenceStatus.AVAILABLE, 120_000),
    );
    expect(node.wire.append).toHaveBeenCalledTimes(2);
  });

  it('deletes the inbox when sharing stops, so nothing reaches the relay', async () => {
    const { alice, bob, node } = setup();

    await bob.receive(BOB, FROM_ALICE, new Timestamp(0));
    await bob.close(BOB, FROM_ALICE);

    expect(node.inboxes.size).toBe(0);
    await expect(
      alice.publish(
        ALICE,
        TO_BOB,
        aliceUpdate(IdentityPresenceStatus.AVAILABLE, 0),
      ),
    ).resolves.toBeUndefined();
    expect(node.inboxes.size).toBe(0);
  });

  it('cuts every other reader off once a revoke rotated the sealed root', async () => {
    const { bob, bobInbox, sessions } = setup();

    await bob.receive(BOB, FROM_ALICE, new Timestamp(0));
    bobInbox().inbox.readers.set('revoked-device-reader', 0);

    const rotated = sessionOf(BOB, ALICE, {
      previous: SEALED,
      sealed: ROTATED,
    });

    sessions.set(BOB.toString(), rotated);
    await bob.cutOffRevokedReaders(rotated);

    const { id, inbox } = bobInbox();

    expect([...inbox.readers.keys()]).toEqual([
      MailboxCapability.hash(MailboxReadToken.derive(ROTATED, id)),
    ]);
  });

  it('cuts the other readers off when the rotated session carries its id in PEM form', async () => {
    const { bob, bobInbox, sessions } = setup();

    await bob.receive(BOB, FROM_ALICE, new Timestamp(0));
    bobInbox().inbox.readers.set('revoked-device-reader', 0);

    const rotated = {
      ...sessionOf(BOB, ALICE, { previous: SEALED, sealed: ROTATED }),
      identity: {
        id: `-----BEGIN PUBLIC KEY-----\n${BOB.toString()}\n-----END PUBLIC KEY-----\n`,
      },
    } as unknown as Session;

    sessions.set(BOB.toString(), rotated);
    await bob.cutOffRevokedReaders(rotated);

    const { id, inbox } = bobInbox();

    expect([...inbox.readers.keys()]).toEqual([
      MailboxCapability.hash(MailboxReadToken.derive(ROTATED, id)),
    ]);
  });

  it('bridges into an inbox another device opened under the previous root', async () => {
    const { alice, bobInbox, device, sessions } = setup();

    await device().receive(BOB, FROM_ALICE, new Timestamp(0));
    sessions.set(
      BOB.toString(),
      sessionOf(BOB, ALICE, { previous: SEALED, sealed: ROTATED }),
    );
    await alice.publish(
      ALICE,
      TO_BOB,
      aliceUpdate(IdentityPresenceStatus.BUSY, 0),
    );

    await expect(
      device().receive(BOB, FROM_ALICE, new Timestamp(1)).then(statusesOf),
    ).resolves.toEqual(['busy']);

    const { id, inbox } = bobInbox();

    expect([...inbox.readers.keys()]).toEqual([
      MailboxCapability.hash(MailboxReadToken.derive(ROTATED, id)),
    ]);
  });

  it('opens nothing without a conversation key', async () => {
    const { bob, node, sessions } = setup();

    sessions.set(BOB.toString(), {
      ...sessionOf(BOB, ALICE),
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session);

    await expect(
      bob.receive(BOB, FROM_ALICE, new Timestamp(0)),
    ).resolves.toEqual([]);
    expect(node.wire.create).not.toHaveBeenCalled();
  });

  it('never rejects when the relay fails', async () => {
    const { bob, node } = setup();

    node.wire.create.mockRejectedValue(new Error('node down'));

    await expect(
      bob.receive(BOB, FROM_ALICE, new Timestamp(0)),
    ).resolves.toEqual([]);
    await expect(bob.close(BOB, FROM_ALICE)).resolves.toBeUndefined();
  });
});
