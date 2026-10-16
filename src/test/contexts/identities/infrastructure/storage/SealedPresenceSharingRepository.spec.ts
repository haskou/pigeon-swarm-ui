import 'fake-indexeddb/auto';
import type * as BufferModule from 'buffer';

import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { ConversationId } from '../../../../../contexts/conversations/domain/value-objects/ConversationId';
import { PresenceSharing } from '../../../../../contexts/identities/domain/PresenceSharing';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { SealedPresenceSharingRepository } from '../../../../../contexts/identities/infrastructure/storage/SealedPresenceSharingRepository';

// The browser bundle resolves `buffer` to the npm polyfill, whose `equals`
// accepts only its own Buffer. Node's built-in one also takes a Uint8Array.
jest.mock('buffer', () => jest.requireActual<typeof BufferModule>('buffer/'));

const session = (identityId: string, fill = 1): Session =>
  ({
    deviceId: 'device-1',
    deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, fill)),
    identity: { id: identityId },
  }) as unknown as Session;

const sharing = (conversationId: string, contactId: string) =>
  PresenceSharing.create(
    ConversationId.fromString(conversationId),
    IdentityId.fromString(contactId),
  );

describe('SealedPresenceSharingRepository', () => {
  let alice: IdentityId;
  let carol: IdentityId;
  let contexts: IdentityAccessContexts;

  beforeEach(() => {
    alice = IdentityId.fromString(`alice-${randomUUID()}`);
    carol = IdentityId.fromString(`carol-${randomUUID()}`);
    contexts = new IdentityAccessContexts();
    contexts.register(session(alice.toString()));
    contexts.register(session(carol.toString()));
  });

  it('keeps the sharings of each identity apart', async () => {
    const repository = new SealedPresenceSharingRepository(contexts);

    await repository.save(alice, sharing('conversation-ab', 'bob'));

    expect(
      (await repository.search(alice)).map((held) => held.toPrimitives()),
    ).toEqual([
      { contactIdentityId: 'bob', conversationId: 'conversation-ab' },
    ]);
    await expect(repository.search(carol)).resolves.toEqual([]);
  });

  it('holds one sharing per conversation across app sessions', async () => {
    await new SealedPresenceSharingRepository(contexts).save(
      alice,
      sharing('conversation-ab', 'bob'),
    );
    await new SealedPresenceSharingRepository(contexts).save(
      alice,
      sharing('conversation-ab', 'bob'),
    );

    await expect(
      new SealedPresenceSharingRepository(contexts).search(alice),
    ).resolves.toHaveLength(1);
  });

  it('stops sharing with a deleted contact', async () => {
    const repository = new SealedPresenceSharingRepository(contexts);

    await repository.save(alice, sharing('conversation-ab', 'bob'));
    await repository.save(alice, sharing('conversation-ad', 'dave'));
    await repository.delete(alice, sharing('conversation-ab', 'bob'));

    expect(
      (await repository.search(alice)).map(
        (held) => held.toPrimitives().contactIdentityId,
      ),
    ).toEqual(['dave']);
  });

  it('forgets every sharing of a removed identity', async () => {
    const repository = new SealedPresenceSharingRepository(contexts);

    await repository.save(alice, sharing('conversation-ab', 'bob'));
    await repository.save(carol, sharing('conversation-cb', 'bob'));
    await repository.forget(alice.toString());

    await expect(repository.search(alice)).resolves.toEqual([]);
    await expect(repository.search(carol)).resolves.toHaveLength(1);
  });

  it('opens no sharing under another device-sealed root', async () => {
    await new SealedPresenceSharingRepository(contexts).save(
      alice,
      sharing('conversation-ab', 'bob'),
    );
    const other = new IdentityAccessContexts();

    other.register(session(alice.toString(), 2));

    await expect(
      new SealedPresenceSharingRepository(other).search(alice),
    ).resolves.toEqual([]);
  });
});
