import { Buffer } from 'buffer';

import { MailboxKeySchedule } from '../../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';

describe(MailboxKeySchedule.name, () => {
  const secret = new Uint8Array(32).fill(1);

  // Vector computed independently with node:crypto hkdfSync over the documented info layout.
  it('derives the pinned mailbox material for a secret, recipient and epoch', () => {
    const keys = MailboxKeySchedule.derive(secret, 'identity-bob', 0);

    expect(keys.mailboxId).toBe('F_vtY7XukvlaT5dzhBXk7iG2Ed2F3YlTDPUJTexhCuo');
    expect(keys.postToken).toBe('cdwu8_ZamvJ7A6iC8w-iOenvzjxR0g37vL-Trle_7xo');
    expect(Buffer.from(keys.envelopeKey).toString('hex')).toBe(
      '323cb47289465eb83b75b30feb9a1c07e2fe45affbe5bcbfd74869ce8f6c5a8c',
    );
  });

  it('separates the inbox of each recipient identity', () => {
    const bob = MailboxKeySchedule.derive(secret, 'identity-bob', 0);
    const alice = MailboxKeySchedule.derive(secret, 'identity-alice', 0);

    expect(alice.mailboxId).not.toBe(bob.mailboxId);
    expect(alice.postToken).not.toBe(bob.postToken);
    expect(Buffer.from(alice.envelopeKey)).not.toEqual(
      Buffer.from(bob.envelopeKey),
    );
  });

  it('changes every key when the epoch changes', () => {
    const epochZero = MailboxKeySchedule.derive(secret, 'identity-bob', 0);
    const epochOne = MailboxKeySchedule.derive(secret, 'identity-bob', 1);

    expect(epochOne.mailboxId).not.toBe(epochZero.mailboxId);
    expect(epochOne.postToken).not.toBe(epochZero.postToken);
    expect(Buffer.from(epochOne.envelopeKey)).not.toEqual(
      Buffer.from(epochZero.envelopeKey),
    );
  });

  it('keeps the mailbox id and post token distinct', () => {
    const keys = MailboxKeySchedule.derive(secret, 'identity-bob', 0);

    expect(keys.mailboxId).not.toBe(keys.postToken);
  });

  it('rejects a shared secret that is not 32 bytes', () => {
    expect(() =>
      MailboxKeySchedule.derive(new Uint8Array(31), 'identity-bob', 0),
    ).toThrow(RangeError);
  });

  it.each([-1, 1.5, 0x1_0000_0000])(
    'rejects epoch %p outside the uint32 range',
    (epoch) => {
      expect(() =>
        MailboxKeySchedule.derive(secret, 'identity-bob', epoch),
      ).toThrow(RangeError);
    },
  );
});
