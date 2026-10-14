import { Timestamp } from '@haskou/value-objects';

import { ContactPresenceBroadcast } from '../../../../contexts/identities/domain/ContactPresenceBroadcast';
import { PresenceSharing } from '../../../../contexts/identities/domain/PresenceSharing';
import { ContactPresenceSource } from '../../../../contexts/identities/domain/value-objects/ContactPresenceSource';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPresenceStatus } from '../../../../contexts/identities/domain/value-objects/IdentityPresenceStatus';

const sharing = (conversationId = 'conversation-b', contact = 'identity-b') =>
  PresenceSharing.fromPrimitives({
    contactIdentityId: contact,
    conversationId,
  });

const broadcast = (): ContactPresenceBroadcast =>
  new ContactPresenceBroadcast(
    IdentityId.fromString('identity-a'),
    ContactPresenceSource.fromString('AAAAAAAAAAAAAAAAAAAAAA'),
  );

const sent = (
  stream: ContactPresenceBroadcast,
  status: IdentityPresenceStatus,
  at: number,
  to = sharing(),
) => stream.next(to, status, new Timestamp(at))?.toPrimitives() ?? null;

describe(ContactPresenceBroadcast.name, () => {
  it('sends the first shareable status at once', () => {
    expect(sent(broadcast(), IdentityPresenceStatus.AVAILABLE, 0)).toEqual({
      authorId: 'identity-a',
      expiresAt: 90_000,
      sentAt: 0,
      sequence: 1,
      source: 'AAAAAAAAAAAAAAAAAAAAAA',
      status: 'available',
    });
  });

  it.each([
    IdentityPresenceStatus.INVISIBLE,
    IdentityPresenceStatus.DISCONNECTED,
  ])('sends nothing while %s', (status) => {
    expect(sent(broadcast(), status, 0)).toBeNull();
  });

  it('refreshes an unchanged status every 45 seconds', () => {
    const stream = broadcast();

    sent(stream, IdentityPresenceStatus.AVAILABLE, 0);

    expect(sent(stream, IdentityPresenceStatus.AVAILABLE, 44_999)).toBeNull();
    expect(sent(stream, IdentityPresenceStatus.AVAILABLE, 45_000)).toEqual(
      expect.objectContaining({ sequence: 2 }),
    );
  });

  it('sends a change at most once every 10 seconds', () => {
    const stream = broadcast();

    sent(stream, IdentityPresenceStatus.AVAILABLE, 0);

    expect(sent(stream, IdentityPresenceStatus.BUSY, 9_999)).toBeNull();
    expect(sent(stream, IdentityPresenceStatus.BUSY, 10_000)).toEqual(
      expect.objectContaining({ sequence: 2, status: 'busy' }),
    );
  });

  it('does not let going invisible and back bypass the rate limit', () => {
    const stream = broadcast();

    sent(stream, IdentityPresenceStatus.AVAILABLE, 0);
    sent(stream, IdentityPresenceStatus.INVISIBLE, 1_000);

    expect(sent(stream, IdentityPresenceStatus.AVAILABLE, 2_000)).toBeNull();
    expect(sent(stream, IdentityPresenceStatus.AVAILABLE, 10_000)).toEqual(
      expect.objectContaining({ sequence: 2, status: 'available' }),
    );
  });

  it('paces each contact on its own with one rising sequence', () => {
    const stream = broadcast();

    sent(stream, IdentityPresenceStatus.AWAY, 0);

    expect(
      sent(
        stream,
        IdentityPresenceStatus.AWAY,
        1_000,
        sharing('conversation-c', 'identity-c'),
      ),
    ).toEqual(expect.objectContaining({ sequence: 2 }));
  });
});
