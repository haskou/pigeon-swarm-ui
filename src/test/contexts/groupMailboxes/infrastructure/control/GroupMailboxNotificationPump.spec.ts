import 'fake-indexeddb/auto';
import { EncryptedPayload, KeyPair } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';
import { randomUUID } from 'node:crypto';

import type { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import type { GroupMailboxControlFields } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlFields';
import type { GroupMailboxNotificationPages } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationPages';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { GroupMailboxControl as Control } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxControlSeal } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlSeal';
import { GroupMailboxLetterClaims } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxLetterClaims';
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
};

const CONVERSATION = 'group:control-pump';
const NOW = 1_700_000_000_000;
const REQUEST_ID = 'abcdefghijklmnopqrstuv';
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
const WINDOW = GroupMailboxNotificationPump.ANSWER_WINDOW_MS;

const person = async (): Promise<Person> => {
  const keyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();

  return {
    id,
    keyPair,
    session: {
      deviceSealedRootKey: { getBuffer: () => Buffer.alloc(32, 7) },
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
  let sealed = GroupMailboxControlSeal.seal(letter.from.session, {
    conversationId,
    plaintext: GroupMailboxControlRecord.encode(letter.record ?? REQUEST),
    recipientIdentityId: bob.id,
    sentAt: letter.sentAt ?? NOW,
  });

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
      conversationId,
      encryptedConversationKey: sealed,
      inviterIdentityId: (letter.inviter ?? letter.from).id,
      nonce: 'nonce',
      recipientIdentityId: bob.id,
    },
    recipientIdentityId: bob.id,
    state: 'pending',
    status: 'unread',
    type: 'group_conversation_invitation',
  };
};

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
  const notifications = mock<GroupMailboxNotificationPages>();
  const database = device.database ?? `group-control-${randomUUID()}`;

  control.receiveDirect.mockResolvedValue('applied');
  notifications.listPage.mockImplementation((_session, _limit, before) => {
    const index =
      before === undefined
        ? 0
        : pages.findIndex((page) => page[page.length - 1]?.id === before) + 1;

    return Promise.resolve(pages[index] ?? []);
  });

  return {
    control,
    notifications,
    pump: new GroupMailboxNotificationPump(
      bob.session,
      control,
      notifications,
      new GroupMailboxLetterClaims(entries(database), () => bob.session),
      () => device.now ?? NOW,
    ),
  };
};

beforeAll(async () => {
  [alice, bob, mallory] = await Promise.all([person(), person(), person()]);
});

describe('GroupMailboxNotificationPump', () => {
  describe('on one device across reloads and sessions', () => {
    it.each([
      ['request', REQUEST],
      ['response', RESPONSE],
    ])(
      'does not hand a replayed %s over again within its answer window',
      async (_kind, record) => {
        const database = `group-control-${randomUUID()}`;
        const before = setup(
          [[notification({ from: alice, id: 'n1', record })]],
          {
            database,
          },
        );

        await before.pump.run();
        const reloaded = setup(
          [
            [
              notification({ from: alice, id: 'n1', record }),
              notification({ from: alice, id: 'n1-reposted', record }),
            ],
          ],
          { database, now: NOW + WINDOW },
        );

        await reloaded.pump.run();

        expect(before.control.receiveDirect).toHaveBeenCalledTimes(1);
        expect(reloaded.control.receiveDirect).not.toHaveBeenCalled();
      },
    );

    it('lets one of two concurrent sessions hand a letter over', async () => {
      const database = `group-control-${randomUUID()}`;
      const sessions = [
        setup([[notification({ from: alice, id: 'n1' })]], { database }),
        setup([[notification({ from: alice, id: 'n1' })]], { database }),
      ];

      await Promise.all(sessions.map(({ pump }) => pump.run()));

      expect(
        sessions.flatMap(({ control }) => control.receiveDirect.mock.calls),
      ).toHaveLength(1);
    });

    it('hands a letter over after a reload when its handling failed', async () => {
      const database = `group-control-${randomUUID()}`;
      const failed = setup([[notification({ from: alice, id: 'n1' })]], {
        database,
      });

      failed.control.receiveDirect.mockRejectedValueOnce(new Error('offline'));
      await failed.pump.run();
      const reloaded = setup([[notification({ from: alice, id: 'n1' })]], {
        database,
      });

      await reloaded.pump.run();

      expect(reloaded.control.receiveDirect).toHaveBeenCalledTimes(1);
    });

    it('keeps a handled letter until its answer window ended', async () => {
      const database = `group-control-${randomUUID()}`;

      await setup([[notification({ from: alice, id: 'n1' })]], {
        database,
      }).pump.run();
      await setup([[]], { database, now: NOW + WINDOW }).pump.run();

      await expect(
        entries(database).list(bob.session, 'control-letter'),
      ).resolves.toHaveLength(1);
      await setup([[]], { database, now: NOW + WINDOW + 1 }).pump.run();

      await expect(
        entries(database).list(bob.session, 'control-letter'),
      ).resolves.toEqual([]);
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

  it('ignores a record its sender did not sign', async () => {
    const { control, pump } = setup([
      [
        notification({
          from: alice,
          id: 'n1',
          reseal: { signature: undefined },
        }),
      ],
    ]);

    await pump.run();

    expect(control.receiveDirect).not.toHaveBeenCalled();
  });

  it('ignores a record signed by someone other than the node author', async () => {
    const { control, pump } = setup([
      [
        notification({ from: alice, id: 'n1', inviter: mallory }),
        notification({
          from: mallory,
          id: 'n2',
          inviter: alice,
          reseal: { senderIdentityId: alice.id },
        }),
      ],
    ]);

    await pump.run();

    expect(control.receiveDirect).not.toHaveBeenCalled();
  });

  it('ignores a record for another conversation than its letter', async () => {
    const { control, pump } = setup([
      [
        notification({
          from: alice,
          id: 'n1',
          record: { ...REQUEST, conversationId: 'group:other' },
        }),
      ],
    ]);

    await pump.run();

    expect(control.receiveDirect).not.toHaveBeenCalled();
  });

  it('ignores a key package exchange outside its answer window', async () => {
    const window = GroupMailboxNotificationPump.ANSWER_WINDOW_MS;
    const response: GroupMailboxControlFields = {
      conversationId: CONVERSATION,
      keyPackage: new Uint8Array([1]),
      requestId: REQUEST_ID,
      type: 'key-package-response',
    };
    const { control, pump } = setup([
      [
        notification({ from: alice, id: 'n1', sentAt: NOW - window - 1 }),
        notification({
          from: alice,
          id: 'n2',
          record: response,
          sentAt: NOW - window - 1,
        }),
        notification({ from: alice, id: 'n3', sentAt: NOW + window + 1 }),
      ],
    ]);

    await pump.run();

    expect(window).toBeGreaterThan(Control.KEY_PACKAGE_TIMEOUT_MS);
    expect(control.receiveDirect).not.toHaveBeenCalled();
  });

  it('hands a late welcome over for the engine to judge', async () => {
    const welcome: GroupMailboxControlFields = {
      conversationId: CONVERSATION,
      index: 0,
      type: 'welcome',
      welcome: new Uint8Array([1]),
    };
    const { control, pump } = setup([
      [
        notification({
          from: alice,
          id: 'n1',
          record: welcome,
          sentAt: NOW - 86_400_000,
        }),
      ],
    ]);

    await pump.run();

    expect(control.receiveDirect).toHaveBeenCalledTimes(1);
  });

  it('hands each notification over once', async () => {
    const { control, pump } = setup([
      [notification({ from: alice, id: 'n1' })],
    ]);

    await pump.run();
    await pump.run();

    expect(control.receiveDirect).toHaveBeenCalledTimes(1);
  });

  it('hands a notification over again after its handling failed', async () => {
    const { control, pump } = setup([
      [notification({ from: alice, id: 'n1' })],
    ]);

    control.receiveDirect.mockRejectedValueOnce(new Error('offline'));
    await pump.run();
    await pump.run();

    expect(control.receiveDirect).toHaveBeenCalledTimes(2);
  });

  it('reads every page of notifications', async () => {
    const size = GroupMailboxNotificationPump.PAGE_SIZE;
    const first = Array.from({ length: size }, (_, index) => ({
      id: `other-${index}`,
      payload: { communityId: 'c', inviterIdentityId: alice.id },
      recipientIdentityId: bob.id,
      state: 'pending',
      status: 'unread',
      type: 'community_invitation',
    })) as NotificationResource[];
    const { control, notifications, pump } = setup([
      first,
      [notification({ from: alice, id: 'n1' })],
    ]);

    await pump.run();

    expect(notifications.listPage).toHaveBeenCalledWith(
      bob.session,
      size,
      `other-${size - 1}`,
    );
    expect(control.receiveDirect).toHaveBeenCalledTimes(1);
  });

  it('stops when the node does not move past the cursor', async () => {
    const size = GroupMailboxNotificationPump.PAGE_SIZE;
    const page = Array.from({ length: size }, (_, index) =>
      notification({ from: alice, id: `n-${index}` }),
    );
    const { notifications, pump } = setup([page]);

    notifications.listPage.mockResolvedValue(page);
    await pump.run();

    expect(notifications.listPage).toHaveBeenCalledTimes(2);
  });

  it('reads at most MAX_PAGES pages in one run', async () => {
    const size = GroupMailboxNotificationPump.PAGE_SIZE;
    const { notifications, pump } = setup([]);
    let next = 1_000_000_000;
    const other = (): NotificationResource => {
      next -= 1;

      return {
        id: `other-${next}`,
        payload: { communityId: 'c', inviterIdentityId: alice.id },
        recipientIdentityId: bob.id,
        state: 'pending',
        status: 'unread',
        type: 'community_invitation',
      } as NotificationResource;
    };

    notifications.listPage.mockImplementation(() =>
      Promise.resolve(Array.from({ length: size }, other)),
    );
    await pump.run();

    expect(notifications.listPage).toHaveBeenCalledTimes(
      GroupMailboxNotificationPump.MAX_PAGES,
    );
  });

  it('ignores notifications that are not group control letters', async () => {
    const letter = notification({ from: alice, id: 'n1' });
    const { control, pump } = setup([
      [{ ...letter, type: 'conversation_invitation' } as NotificationResource],
    ]);

    await pump.run();

    expect(control.receiveDirect).not.toHaveBeenCalled();
  });

  it('skips a malformed notification and reads the rest', async () => {
    const broken = notification({ from: alice, id: 'n1' });
    const { control, pump } = setup([
      [
        {
          ...broken,
          payload: { ...broken.payload, inviterIdentityId: undefined },
        } as unknown as NotificationResource,
        notification({ from: alice, id: 'n2' }),
      ],
    ]);

    await pump.run();

    expect(control.receiveDirect).toHaveBeenCalledTimes(1);
  });
});
