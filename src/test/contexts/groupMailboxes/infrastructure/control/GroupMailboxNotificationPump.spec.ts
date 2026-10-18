import 'fake-indexeddb/auto';
import {
  EncryptedPayload,
  GroupMailboxControlLetter,
  KeyPair,
  PrivateKey,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';
import { randomUUID } from 'node:crypto';

import type { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import type { GroupMailboxControlFields } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlFields';
import type { GroupMailboxNotificationInbox } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationInbox';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { GroupMailboxControl as Control } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxHandledLetters } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxHandledLetters';
import { GroupMailboxNotificationPump } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationPump';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceSealedEntryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';

type Person = { id: string; keyPair: KeyPair; session: Session };
type Letter = {
  conversationId?: string;
  from: Person;
  id: string;
  inviter?: Person;
  record?: GroupMailboxControlFields;
  reseal?: Record<string, unknown>;
  sentAt?: number;
  state?: NotificationResource['state'];
};

const CONVERSATION = 'group:control-pump';
const DEVICE = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE=',
  '-----END PUBLIC KEY-----',
  '',
].join('\n');
const OTHER_DEVICE = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAucH5A2i1h+Bsy/pxTGlQgcT+UNN16/hpX4Ss8tNxHwo=',
  '-----END PUBLIC KEY-----',
  '',
].join('\n');
const NOW = 1_700_000_000_000;
const REQUEST_ID = 'abcdefghijklmnopqrstuv';
const OTHER_REQUEST_ID = 'ABCDEFGHIJKLMNOPQRSTUV';
const REQUEST: GroupMailboxControlFields = {
  conversationId: CONVERSATION,
  requestId: REQUEST_ID,
  type: 'key-package-request',
};
const RESPONSE: GroupMailboxControlFields = {
  conversationId: CONVERSATION,
  keyPackage: new Uint8Array([1]),
  requestId: REQUEST_ID,
  type: 'key-package-response',
};
const WELCOME: GroupMailboxControlFields = {
  conversationId: CONVERSATION,
  deviceCredential: DEVICE,
  index: 4,
  type: 'welcome',
  welcome: new Uint8Array([1]),
};
const KINDS: [string, GroupMailboxControlFields][] = [
  ['request', REQUEST],
  ['response', RESPONSE],
  ['welcome', WELCOME],
];
const WINDOW = GroupMailboxNotificationPump.ANSWER_WINDOW_MS;
const LETTER_WINDOW = GroupMailboxNotificationPump.LETTER_WINDOW_MS;

const person = async (): Promise<Person> => {
  const keyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();

  return {
    id,
    keyPair,
    session: {
      deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 7)),
      identity: { id },
      keyPair,
    } as unknown as Session,
  };
};

let alice: Person;
let bob: Person;
let mallory: Person;

/** A notification addressed to Bob carrying one sealed control record. */
const notification = (letter: Letter): NotificationResource => {
  const conversationId = letter.conversationId ?? CONVERSATION;
  let sealed = GroupMailboxControlLetter.seal(
    new PrivateKey(letter.from.keyPair.toPrimitives().privateKey),
    {
      conversationId,
      payload: GroupMailboxControlRecord.encode(letter.record ?? REQUEST),
      recipientIdentityId: bob.id,
      sentAt: letter.sentAt ?? NOW,
    },
  );

  if (letter.reseal) {
    const envelope = JSON.parse(
      bob.keyPair.decrypt(new EncryptedPayload(sealed)).toString(),
    ) as Record<string, unknown>;

    sealed = IdentityId.fromString(bob.id)
      .getPublicKey()
      .encrypt(JSON.stringify({ ...envelope, ...letter.reseal }))
      .toString();
  }

  return {
    id: letter.id,
    payload: {
      encryptedConversationKey: sealed,
      inviterIdentityId: (letter.inviter ?? letter.from).id,
      nonce: 'nonce',
      recipientIdentityId: bob.id,
    },
    recipientIdentityId: bob.id,
    state: letter.state ?? 'pending',
    status: 'unread',
    type: 'group_conversation_invitation',
  };
};

const other = (id: string): NotificationResource =>
  ({
    id,
    payload: { communityId: 'c', inviterIdentityId: alice.id },
    recipientIdentityId: bob.id,
    state: 'pending',
    status: 'unread',
    type: 'community_invitation',
  }) as NotificationResource;

/** This device's handled letters, in the IndexedDB database `database`. */
const entries = (database: string) =>
  new DeviceSealedEntryStore(database, 'pigeon-group-control');

/**
 * A pump of one session of Bob's device. Sessions given the same `database`
 * share the device's handled letters, as after a reload or in another tab.
 */
const setup = (
  pages: NotificationResource[][],
  device: { database?: string; now?: number } = {},
) => {
  const control = mock<Pick<GroupMailboxControl, 'receiveDirect'>>();
  const notifications = mock<GroupMailboxNotificationInbox>();
  const database = device.database ?? `group-control-${randomUUID()}`;

  control.receiveDirect.mockResolvedValue('applied');
  notifications.listPage.mockImplementation((_session, cursor) => {
    const index =
      cursor === undefined
        ? 0
        : pages.findIndex((page) => page[page.length - 1]?.id === cursor) + 1;
    const results = pages[index] ?? [];
    const last = results[results.length - 1];

    return Promise.resolve({
      nextCursor: last === undefined ? null : last.id,
      results,
    });
  });
  notifications.update.mockImplementation((_session, id) =>
    Promise.resolve(other(id)),
  );

  return {
    control,
    database,
    notifications,
    pump: new GroupMailboxNotificationPump(
      () => bob.session,
      control,
      notifications,
      new GroupMailboxHandledLetters(entries(database), () => bob.session),
      () => device.now ?? NOW,
    ),
    /** The state records signed, as `[notification id, state]`. */
    signed: () =>
      notifications.update.mock.calls.map(([session, id, state]) => {
        expect(session).toBe(bob.session);

        return [id, state];
      }),
  };
};

beforeAll(async () => {
  [alice, bob, mallory] = await Promise.all([person(), person(), person()]);
});

describe('GroupMailboxNotificationPump', () => {
  describe('signs a state record for each letter it decides', () => {
    it.each(KINDS)(
      'accepts a %s the control applied',
      async (_kind, record) => {
        const { control, pump, signed } = setup([
          [notification({ from: alice, id: 'n1', record })],
        ]);

        await pump.run();

        expect(control.receiveDirect).toHaveBeenCalledTimes(1);
        expect(signed()).toEqual([['n1', 'accepted']]);
      },
    );

    it.each(KINDS)(
      'declines a %s the control refused',
      async (_kind, record) => {
        const { control, pump, signed } = setup([
          [notification({ from: alice, id: 'n1', record })],
        ]);

        control.receiveDirect.mockResolvedValue('rejected');
        await pump.run();

        expect(signed()).toEqual([['n1', 'declined']]);
      },
    );

    it.each(KINDS)(
      'leaves a %s for another device or session pending, and reads it again',
      async (_kind, record) => {
        const { control, pump, signed } = setup([
          [notification({ from: alice, id: 'n1', record })],
        ]);

        control.receiveDirect.mockResolvedValue('ignored');
        await pump.run();
        await pump.run();

        expect(control.receiveDirect).toHaveBeenCalledTimes(2);
        expect(signed()).toEqual([]);
      },
    );

    it('resolves a run with the conversations a welcome joined', async () => {
      const { pump } = setup([
        [
          notification({ from: alice, id: 'n1', record: WELCOME }),
          notification({ from: alice, id: 'n2' }),
        ],
      ]);

      await expect(pump.run()).resolves.toEqual(new Set([CONVERSATION]));
    });

    it('declines, without handing it over, a letter that fails validation', async () => {
      const broken = notification({ from: alice, id: 'n6' });
      const { control, pump, signed } = setup([
        [
          notification({
            from: alice,
            id: 'n1',
            reseal: { signature: undefined },
          }),
          notification({ from: alice, id: 'n2', inviter: mallory }),
          notification({
            from: mallory,
            id: 'n3',
            inviter: alice,
            reseal: { senderIdentityId: alice.id },
          }),
          notification({
            from: alice,
            id: 'n4',
            record: { ...REQUEST, conversationId: 'group:other' },
          }),
          notification({
            from: alice,
            id: 'n5',
            record: {
              commit: new Uint8Array([1]),
              conversationId: CONVERSATION,
              type: 'commit',
            },
          }),
          {
            ...broken,
            payload: { ...broken.payload, inviterIdentityId: undefined },
          } as unknown as NotificationResource,
        ],
      ]);

      await pump.run();

      expect(control.receiveDirect).not.toHaveBeenCalled();
      expect(signed()).toEqual(
        ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((id) => [id, 'declined']),
      );
    });

    it('declines, without handing it over, a letter outside its window', async () => {
      const { control, pump, signed } = setup([
        [
          notification({
            from: alice,
            id: 'n1',
            sentAt: NOW - LETTER_WINDOW - 1,
          }),
          notification({
            from: alice,
            id: 'n2',
            record: RESPONSE,
            sentAt: NOW - LETTER_WINDOW - 1,
          }),
          notification({ from: alice, id: 'n3', sentAt: NOW + WINDOW + 1 }),
          notification({
            from: alice,
            id: 'n4',
            record: WELCOME,
            sentAt: NOW - LETTER_WINDOW - 1,
          }),
          notification({
            from: alice,
            id: 'n5',
            record: WELCOME,
            sentAt: NOW + WINDOW + 1,
          }),
        ],
      ]);

      await pump.run();

      expect(WINDOW).toBeGreaterThan(Control.KEY_PACKAGE_TIMEOUT_MS);
      expect(control.receiveDirect).not.toHaveBeenCalled();
      expect(signed()).toEqual(
        ['n1', 'n2', 'n3', 'n4', 'n5'].map((id) => [id, 'declined']),
      );
    });

    it.each(KINDS)(
      'hands a late %s within its window over for the control to judge',
      async (_kind, record) => {
        const { control, pump } = setup([
          [
            notification({
              from: alice,
              id: 'n1',
              record,
              sentAt: NOW - LETTER_WINDOW,
            }),
          ],
        ]);

        await pump.run();

        expect(control.receiveDirect).toHaveBeenCalledTimes(1);
      },
    );

    it('reads no letter the node holds as accepted or declined', async () => {
      const { control, pump, signed } = setup([
        [
          notification({ from: alice, id: 'n1', state: 'accepted' }),
          notification({
            from: alice,
            id: 'n2',
            reseal: { signature: undefined },
            state: 'declined',
          }),
        ],
      ]);

      await pump.run();

      expect(control.receiveDirect).not.toHaveBeenCalled();
      expect(signed()).toEqual([]);
    });

    it('signs nothing for notifications that are not group control letters', async () => {
      const letter = notification({ from: alice, id: 'n1' });
      const { control, pump, signed } = setup([
        [
          {
            ...letter,
            type: 'conversation_invitation',
          } as NotificationResource,
          other('n2'),
        ],
      ]);

      await pump.run();

      expect(control.receiveDirect).not.toHaveBeenCalled();
      expect(signed()).toEqual([]);
    });
  });

  describe('drops a letter whose sealed key this device already holds', () => {
    it.each(KINDS)(
      'declines a %s replayed under another notification id, with no second answer',
      async (_kind, record) => {
        const { control, pump, signed } = setup([
          [
            notification({ from: alice, id: 'n1', record }),
            notification({ from: alice, id: 'n2', record, sentAt: NOW + 1 }),
          ],
        ]);

        await pump.run();

        expect(control.receiveDirect).toHaveBeenCalledTimes(1);
        expect(signed()).toEqual([
          ['n1', 'accepted'],
          ['n2', 'declined'],
        ]);
      },
    );

    it.each(KINDS)(
      'declines a %s replayed after a reload, with no second answer',
      async (_kind, record) => {
        const before = setup([
          [notification({ from: alice, id: 'n1', record })],
        ]);

        await before.pump.run();
        const reloaded = setup(
          [
            [
              notification({
                from: alice,
                id: 'n1',
                record,
                state: 'accepted',
              }),
              notification({ from: alice, id: 'n2', record }),
            ],
          ],
          { database: before.database, now: NOW + WINDOW },
        );

        await reloaded.pump.run();

        expect(reloaded.control.receiveDirect).not.toHaveBeenCalled();
        expect(reloaded.signed()).toEqual([['n2', 'declined']]);
      },
    );

    it('keys a response by its key package, whatever request id it names', async () => {
      const { control, pump, signed } = setup([
        [
          notification({ from: alice, id: 'n1', record: RESPONSE }),
          notification({
            from: alice,
            id: 'n2',
            record: { ...RESPONSE, requestId: OTHER_REQUEST_ID },
          }),
        ],
      ]);

      await pump.run();

      expect(control.receiveDirect).toHaveBeenCalledTimes(1);
      expect(signed()).toEqual([
        ['n1', 'accepted'],
        ['n2', 'declined'],
      ]);
    });

    it('keys a welcome by its epoch and the device it names', async () => {
      const { control, pump, signed } = setup([
        [
          notification({ from: alice, id: 'n1', record: WELCOME }),
          notification({
            from: alice,
            id: 'n2',
            record: { ...WELCOME, deviceCredential: OTHER_DEVICE },
          }),
        ],
      ]);

      control.receiveDirect.mockImplementation((_sender, plaintext) => {
        const record = GroupMailboxControlRecord.decode(plaintext);

        return Promise.resolve(
          record?.type === 'welcome' && record.deviceCredential === DEVICE
            ? 'applied'
            : 'ignored',
        );
      });
      await pump.run();

      // The welcome of the identity's other device stays pending for it.
      expect(control.receiveDirect).toHaveBeenCalledTimes(2);
      expect(signed()).toEqual([['n1', 'accepted']]);
    });

    it.each(KINDS)(
      'keeps a %s through its letter window only',
      async (_kind, record) => {
        const { database, pump } = setup([
          [notification({ from: alice, id: 'n1', record })],
        ]);

        await pump.run();
        await setup([[]], { database, now: NOW + LETTER_WINDOW }).pump.run();

        await expect(
          entries(database).list(bob.session, 'control-letter'),
        ).resolves.toHaveLength(1);
        await setup([[]], {
          database,
          now: NOW + LETTER_WINDOW + 1,
        }).pump.run();

        await expect(
          entries(database).list(bob.session, 'control-letter'),
        ).resolves.toEqual([]);
      },
    );
  });

  describe('across failures and sessions', () => {
    it('signs nothing when the handling throws, and hands the letter over again', async () => {
      const { control, pump, signed } = setup([
        [notification({ from: alice, id: 'n1' })],
      ]);

      control.receiveDirect.mockRejectedValueOnce(new Error('offline'));
      await pump.run();

      expect(signed()).toEqual([]);
      await pump.run();

      expect(control.receiveDirect).toHaveBeenCalledTimes(2);
      expect(signed()).toEqual([['n1', 'accepted']]);
    });

    it('hands a letter over after a reload when its handling threw', async () => {
      const failed = setup([[notification({ from: alice, id: 'n1' })]]);

      failed.control.receiveDirect.mockRejectedValueOnce(new Error('offline'));
      await failed.pump.run();
      const reloaded = setup([[notification({ from: alice, id: 'n1' })]], {
        database: failed.database,
      });

      await reloaded.pump.run();

      expect(reloaded.control.receiveDirect).toHaveBeenCalledTimes(1);
      expect(reloaded.signed()).toEqual([['n1', 'accepted']]);
    });

    it('signs the decided state again when signing failed, without handling again', async () => {
      const { control, notifications, pump, signed } = setup([
        [notification({ from: alice, id: 'n1' })],
      ]);

      control.receiveDirect.mockResolvedValue('rejected');
      notifications.update.mockRejectedValueOnce(new Error('offline'));
      await pump.run();
      control.receiveDirect.mockResolvedValue('applied');
      await pump.run();

      expect(control.receiveDirect).toHaveBeenCalledTimes(1);
      expect(signed()).toEqual([
        ['n1', 'declined'],
        ['n1', 'declined'],
      ]);
    });

    it('lets one of two concurrent sessions hand a letter over', async () => {
      const first = setup([[notification({ from: alice, id: 'n1' })]]);
      const sessions = [
        first,
        setup([[notification({ from: alice, id: 'n1' })]], {
          database: first.database,
        }),
      ];

      await Promise.all(sessions.map(({ pump }) => pump.run()));

      expect(
        sessions.flatMap(({ control }) => control.receiveDirect.mock.calls),
      ).toHaveLength(1);
      const records = sessions.flatMap(({ signed }) => signed());

      expect(records.length).toBeGreaterThan(0);
      expect(new Set(records.map(String))).toEqual(new Set(['n1,accepted']));
    });

    it.each([
      ['request', REQUEST],
      ['response', RESPONSE],
    ] as const)(
      'never hands a %s over twice once a session stopped half-way',
      async (_kind, record) => {
        const stopped = setup([
          [notification({ from: alice, id: 'n1', record })],
        ]);

        stopped.control.receiveDirect.mockReturnValue(new Promise(() => {}));
        void stopped.pump.run();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const later = (now: number) =>
          setup([[notification({ from: alice, id: 'n1', record })]], {
            database: stopped.database,
            now,
          });
        const reloaded = later(NOW + WINDOW + 1);

        await reloaded.pump.run();

        expect(reloaded.control.receiveDirect).not.toHaveBeenCalled();
        expect(reloaded.signed()).toEqual([]);
        const late = later(NOW + LETTER_WINDOW + 1);

        await late.pump.run();

        expect(late.control.receiveDirect).not.toHaveBeenCalled();
        expect(late.signed()).toEqual([['n1', 'declined']]);
      },
    );

    it('hands a welcome over again once a session stopped half-way and its claim ended', async () => {
      const stopped = setup([
        [notification({ from: alice, id: 'n1', record: WELCOME })],
      ]);

      stopped.control.receiveDirect.mockReturnValue(new Promise(() => {}));
      void stopped.pump.run();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const reloaded = setup(
        [[notification({ from: alice, id: 'n1', record: WELCOME })]],
        { database: stopped.database, now: NOW + WINDOW + 1 },
      );

      await reloaded.pump.run();

      expect(reloaded.control.receiveDirect).toHaveBeenCalledTimes(1);
      expect(reloaded.signed()).toEqual([['n1', 'accepted']]);
    });
  });

  it('hands a fresh signed record to the control as its sender', async () => {
    const { control, pump } = setup([
      [notification({ from: alice, id: 'n1' })],
    ]);

    await pump.run();

    expect(control.receiveDirect).toHaveBeenCalledTimes(1);
    const [sender, plaintext] = control.receiveDirect.mock.calls[0];

    expect(sender).toBe(alice.id);
    expect(GroupMailboxControlRecord.decode(plaintext)).toEqual(REQUEST);
  });

  it('reads every page of notifications', async () => {
    const size = 100;
    const first = Array.from({ length: size }, (_, index) =>
      other(`other-${index}`),
    );
    const { control, notifications, pump } = setup([
      first,
      [notification({ from: alice, id: 'n1' })],
    ]);

    await pump.run();

    expect(notifications.listPage).toHaveBeenCalledWith(
      bob.session,
      `other-${size - 1}`,
    );
    expect(control.receiveDirect).toHaveBeenCalledTimes(1);
  });

  it('stops when the node does not move past the cursor', async () => {
    const size = 100;
    const page = Array.from({ length: size }, (_, index) =>
      other(`other-${index}`),
    );
    const { notifications, pump } = setup([page]);

    notifications.listPage.mockResolvedValue({
      nextCursor: page[size - 1].id,
      results: page,
    });
    await pump.run();

    expect(notifications.listPage).toHaveBeenCalledTimes(2);
  });

  it('reads at most MAX_PAGES pages in one run', async () => {
    const size = 100;
    const { notifications, pump } = setup([]);
    let next = 1_000_000_000;

    notifications.listPage.mockImplementation(() => {
      const results = Array.from({ length: size }, () => {
        next -= 1;

        return other(`other-${next}`);
      });

      return Promise.resolve({
        nextCursor: results[results.length - 1].id,
        results,
      });
    });
    await pump.run();

    expect(notifications.listPage).toHaveBeenCalledTimes(
      GroupMailboxNotificationPump.MAX_PAGES,
    );
  });

  describe('a request from an identity that is not a contact', () => {
    const deferred = () => {
      const pumped = setup([
        [
          notification({ from: alice, id: 'late', sentAt: NOW - 1 }),
          notification({ from: mallory, id: 'early', sentAt: NOW - 2 }),
        ],
      ]);

      pumped.control.receiveDirect.mockResolvedValue('deferred');

      return pumped;
    };

    it('stays pending and is listed as an invitation, oldest first', async () => {
      const { pump, signed } = deferred();

      await pump.run();

      expect(signed()).toEqual([]);
      expect(pump.invitations()).toEqual([
        {
          conversationId: CONVERSATION,
          inviterIdentityId: mallory.id,
          notificationId: 'early',
          sentAt: NOW - 2,
        },
        {
          conversationId: CONVERSATION,
          inviterIdentityId: alice.id,
          notificationId: 'late',
          sentAt: NOW - 1,
        },
      ]);
    });

    it('is answered as consented once the user accepts it', async () => {
      const { control, pump, signed } = deferred();

      await pump.run();
      control.receiveDirect.mockResolvedValue('applied');

      await expect(pump.accept('late')).resolves.toBe(true);
      expect(control.receiveDirect).toHaveBeenLastCalledWith(
        alice.id,
        expect.any(Uint8Array),
        true,
      );
      expect(signed()).toEqual([['late', 'accepted']]);
      expect(
        pump.invitations().map(({ notificationId }) => notificationId),
      ).toEqual(['early']);
      await expect(pump.accept('late')).resolves.toBe(false);
    });

    it('stays listed when the control cannot answer it now', async () => {
      const { pump } = deferred();

      await pump.run();

      await expect(pump.accept('late')).rejects.toThrow(
        'The invitation cannot be answered now',
      );
      expect(pump.invitations()).toHaveLength(2);
    });

    it('is declined without an answer once the user declines it', async () => {
      const { control, pump, signed } = deferred();

      await pump.run();

      await expect(pump.decline('early')).resolves.toBe(true);
      expect(control.receiveDirect).toHaveBeenCalledTimes(2);
      expect(signed()).toEqual([['early', 'declined']]);
      await expect(pump.decline('early')).resolves.toBe(false);
      await expect(pump.accept('unknown')).resolves.toBe(false);
    });
  });
});
