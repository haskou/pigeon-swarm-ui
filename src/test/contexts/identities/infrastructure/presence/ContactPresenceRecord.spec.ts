import { Timestamp } from '@haskou/value-objects';

import { ContactPresence } from '../../../../../contexts/identities/domain/ContactPresence';
import { PresenceSharing } from '../../../../../contexts/identities/domain/PresenceSharing';
import { ContactPresenceSequence } from '../../../../../contexts/identities/domain/value-objects/ContactPresenceSequence';
import { ContactPresenceSource } from '../../../../../contexts/identities/domain/value-objects/ContactPresenceSource';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPresenceStatus } from '../../../../../contexts/identities/domain/value-objects/IdentityPresenceStatus';
import { ContactPresenceRecord } from '../../../../../contexts/identities/infrastructure/presence/ContactPresenceRecord';

const SOURCE = 'AAAAAAAAAAAAAAAAAAAAAA';
/** Alice shares with Bob; Bob reads what Alice sent. */
const aliceSharing = PresenceSharing.fromPrimitives({
  contactIdentityId: 'identity-b',
  conversationId: 'conversation-ab',
});
const bobSharing = PresenceSharing.fromPrimitives({
  contactIdentityId: 'identity-a',
  conversationId: 'conversation-ab',
});
const record = {
  authorId: 'identity-a',
  conversationId: 'conversation-ab',
  expiresAt: 91_000,
  kind: 'contact-presence',
  sentAt: 1_000,
  sequence: 3,
  source: SOURCE,
  status: 'away',
  version: 1,
};

const bytes = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));

describe(ContactPresenceRecord.name, () => {
  it('encodes only the status, its times and its stream position', () => {
    const presence = ContactPresence.create(
      IdentityId.fromString('identity-a'),
      ContactPresenceSource.fromString(SOURCE),
      ContactPresenceSequence.fromPrimitives(3),
      IdentityPresenceStatus.AWAY,
      new Timestamp(1_000),
    );
    const encoded = ContactPresenceRecord.encode(aliceSharing, presence);

    expect(JSON.parse(new TextDecoder().decode(encoded))).toEqual(record);
    expect(
      ContactPresenceRecord.decode(encoded, bobSharing)?.toPrimitives(),
    ).toEqual(presence.toPrimitives());
  });

  it.each([
    ['another author', { authorId: 'identity-c' }],
    ['another conversation', { conversationId: 'conversation-ac' }],
    ['another kind', { kind: 'message' }],
    ['another version', { version: 2 }],
    ['an unknown field', { nodeId: 'node-1' }],
    ['an invisible status', { status: 'invisible' }],
    ['an unknown status', { status: 'online' }],
    ['a lifetime above 90 seconds', { expiresAt: 91_001 }],
    ['a string time', { sentAt: '1000' }],
    ['a non-positive sequence', { sequence: 0 }],
    ['a malformed source', { source: 'node-1' }],
  ])('drops a record with %s', (_case, override) => {
    expect(
      ContactPresenceRecord.decode(bytes({ ...record, ...override }), bobSharing),
    ).toBeNull();
  });

  it.each([
    ['malformed JSON', new TextEncoder().encode('{')],
    ['an array', bytes([record])],
    ['null', bytes(null)],
  ])('drops %s', (_case, plaintext) => {
    expect(ContactPresenceRecord.decode(plaintext, bobSharing)).toBeNull();
  });
});
