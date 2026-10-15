import { EncryptedPayload, KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { GroupMailboxControlSeal } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlSeal';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

type Person = { id: string; keyPair: KeyPair; session: Session };

const CONVERSATION = 'group:control-seal';
const SENT_AT = 1_700_000_000_000;
const PLAINTEXT = new Uint8Array([1, 2, 3, 250]);

const person = async (): Promise<Person> => {
  const keyPair = await KeyPair.generate();
  const id = IdentityId.fromString(keyPair.toPrimitives().publicKey).valueOf();

  return {
    id,
    keyPair,
    session: { identity: { id }, keyPair } as unknown as Session,
  };
};

const sealFor = (from: Person, to: Person): string =>
  GroupMailboxControlSeal.seal(from.session, {
    conversationId: CONVERSATION,
    plaintext: PLAINTEXT,
    recipientIdentityId: to.id,
    sentAt: SENT_AT,
  });

const openAs = (to: Person, sealed: string, senderIdentityId: string) =>
  GroupMailboxControlSeal.open(to.session, sealed, senderIdentityId);

/** What `holder` reads inside `sealed`, changed and sealed to `to`. */
const reseal = (
  sealed: string,
  holder: Person,
  to: Person,
  change: Record<string, unknown> = {},
): string => {
  const envelope = JSON.parse(
    holder.keyPair.decrypt(new EncryptedPayload(sealed)).toString(),
  ) as Record<string, unknown>;

  return IdentityId.fromString(to.id)
    .getPublicKey()
    .encrypt(JSON.stringify({ ...envelope, ...change }))
    .toString();
};

let alice: Person;
let bob: Person;
let carol: Person;
let mallory: Person;

beforeAll(async () => {
  [alice, bob, carol, mallory] = await Promise.all([
    person(),
    person(),
    person(),
    person(),
  ]);
});

describe('GroupMailboxControlSeal', () => {
  it('opens a letter sealed to this identity by its sender', () => {
    const opened = openAs(bob, sealFor(alice, bob), alice.id);

    expect(opened?.conversationId).toBe(CONVERSATION);
    expect(opened?.sentAt).toBe(SENT_AT);
    expect([...(opened?.plaintext ?? [])]).toEqual([...PLAINTEXT]);
  });

  it('opens nothing sealed to another identity', () => {
    expect(openAs(bob, sealFor(alice, carol), alice.id)).toBeUndefined();
  });

  it('opens nothing a recipient forwards to another member', () => {
    const letter = sealFor(alice, bob);

    expect(openAs(carol, reseal(letter, bob, carol), alice.id)).toBeUndefined();
    expect(
      openAs(
        carol,
        reseal(letter, bob, carol, { recipientIdentityId: carol.id }),
        alice.id,
      ),
    ).toBeUndefined();
  });

  it('opens nothing without its sender signature', () => {
    const letter = sealFor(alice, bob);

    expect(
      openAs(bob, reseal(letter, bob, bob, { signature: undefined }), alice.id),
    ).toBeUndefined();
    expect(
      openAs(
        bob,
        reseal(letter, bob, bob, { signature: 'not-a-signature' }),
        alice.id,
      ),
    ).toBeUndefined();
  });

  it('opens nothing signed by an identity other than its sender', () => {
    const forged = reseal(sealFor(mallory, bob), bob, bob, {
      senderIdentityId: alice.id,
    });

    expect(openAs(bob, forged, alice.id)).toBeUndefined();
  });

  it('opens nothing whose node author is not its signer', () => {
    expect(openAs(bob, sealFor(alice, bob), mallory.id)).toBeUndefined();
  });

  it('opens nothing whose conversation was altered', () => {
    const letter = sealFor(alice, bob);

    expect(
      openAs(
        bob,
        reseal(letter, bob, bob, { conversationId: 'group:other' }),
        alice.id,
      ),
    ).toBeUndefined();
  });

  it('opens nothing whose payload or time was altered', () => {
    const letter = sealFor(alice, bob);
    const altered: Record<string, unknown>[] = [
      { payload: 'AQID' },
      { sentAt: SENT_AT + 1 },
    ];

    for (const change of altered) {
      expect(
        openAs(bob, reseal(letter, bob, bob, change), alice.id),
      ).toBeUndefined();
    }
  });

  it('opens nothing that is not a sealed control letter', () => {
    const publicKey = IdentityId.fromString(bob.id).getPublicKey();
    const letter = sealFor(alice, bob);

    expect(openAs(bob, 'garbage', alice.id)).toBeUndefined();
    expect(
      openAs(bob, publicKey.encrypt('not json').toString(), alice.id),
    ).toBeUndefined();
    expect(
      openAs(
        bob,
        reseal(letter, bob, bob, { kind: 'conversation-key' }),
        alice.id,
      ),
    ).toBeUndefined();
  });
});
