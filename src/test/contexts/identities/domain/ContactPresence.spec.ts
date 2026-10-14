import { Timestamp } from '@haskou/value-objects';

import { ContactPresence } from '../../../../contexts/identities/domain/ContactPresence';
import { InvalidContactPresenceError } from '../../../../contexts/identities/domain/errors/InvalidContactPresenceError';
import { UnshareablePresenceStatusError } from '../../../../contexts/identities/domain/errors/UnshareablePresenceStatusError';
import { ContactPresenceSequence } from '../../../../contexts/identities/domain/value-objects/ContactPresenceSequence';
import { ContactPresenceSource } from '../../../../contexts/identities/domain/value-objects/ContactPresenceSource';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPresenceStatus } from '../../../../contexts/identities/domain/value-objects/IdentityPresenceStatus';

const SOURCE = 'AAAAAAAAAAAAAAAAAAAAAA';
const primitives = {
  authorId: 'identity-b',
  expiresAt: 91_000,
  sentAt: 1_000,
  sequence: 1,
  source: SOURCE,
  status: 'available',
};

describe(ContactPresence.name, () => {
  it('lives 90 seconds from when it was sent', () => {
    const presence = ContactPresence.create(
      IdentityId.fromString('identity-b'),
      ContactPresenceSource.fromString(SOURCE),
      ContactPresenceSequence.first(),
      IdentityPresenceStatus.BUSY,
      new Timestamp(1_000),
    );

    expect(presence.toPrimitives()).toEqual({
      ...primitives,
      status: 'busy',
    });
    expect(presence.isExpiredAt(new Timestamp(90_999))).toBe(false);
    expect(presence.isExpiredAt(new Timestamp(91_000))).toBe(true);
  });

  it.each(['invisible', 'disconnected'])('never carries %s', (status) => {
    expect(() =>
      ContactPresence.fromPrimitives({ ...primitives, status }),
    ).toThrow(UnshareablePresenceStatusError);
  });

  it.each([
    ['a lifetime above 90 seconds', { expiresAt: 91_001 }],
    ['an expiry before it was sent', { expiresAt: 1_000 }],
    ['a fractional time', { sentAt: 1_000.5 }],
    ['a zero sequence', { sequence: 0 }],
    ['a fractional sequence', { sequence: 1.5 }],
    ['a short source', { source: 'AAAA' }],
    ['a source outside base64url', { source: 'AAAAAAAAAAAAAAAAAAAAA=' }],
  ])('rejects %s', (_case, override) => {
    expect(() =>
      ContactPresence.fromPrimitives({ ...primitives, ...override }),
    ).toThrow(InvalidContactPresenceError);
  });

  it('caps its expiry at one lifetime after it arrived', () => {
    const ahead = ContactPresence.fromPrimitives({
      ...primitives,
      expiresAt: 500_000,
      sentAt: 410_000,
    });

    expect(
      ahead.expiresOnReceiptAt(new Timestamp(1_000)).valueOf(),
    ).toBe(91_000);
    expect(ahead.forgottenAfter(new Timestamp(1_000)).valueOf()).toBe(
      500_000,
    );
  });
});
