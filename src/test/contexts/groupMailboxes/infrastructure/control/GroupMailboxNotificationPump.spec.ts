import { EncryptedPayload, KeyPair } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { GroupMailboxControl } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import type { GroupMailboxControlFields } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlFields';
import type { GroupMailboxNotificationPages } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationPages';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { GroupMailboxControl as Control } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControl';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';
import { GroupMailboxControlSeal } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlSeal';
import { GroupMailboxNotificationPump } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxNotificationPump';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

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

const person = async (): Promise<Person> => {
  const keyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();

  return {
    id,
    keyPair,
    session: { identity: { id }, keyPair } as unknown as Session,
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

const setup = (pages: NotificationResource[][]) => {
  const control = mock<Pick<GroupMailboxControl, 'receiveDirect'>>();
  const notifications = mock<GroupMailboxNotificationPages>();

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
      () => NOW,
    ),
  };
};

beforeAll(async () => {
  [alice, bob, mallory] = await Promise.all([person(), person(), person()]);
});

describe('GroupMailboxNotificationPump', () => {
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
