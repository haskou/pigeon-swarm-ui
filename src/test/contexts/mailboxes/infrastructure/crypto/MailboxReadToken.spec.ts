import { MailboxReadToken } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxReadToken';

describe(MailboxReadToken.name, () => {
  const rootKey = new Uint8Array(32).fill(9);
  const mailboxId = 'mailbox-fixture-id';

  it('derives the pinned token for a root key and mailbox', () => {
    expect(MailboxReadToken.derive(rootKey, mailboxId)).toBe(
      'MCkFZKBU05ZYpDeepqRuly-xXmS0bx7Hgq_m0ydOqPI',
    );
  });

  it('is stable for the same root key and mailbox', () => {
    expect(MailboxReadToken.derive(rootKey, mailboxId)).toBe(
      MailboxReadToken.derive(new Uint8Array(32).fill(9), mailboxId),
    );
  });

  it('differs per mailbox, so one token cannot read two inboxes', () => {
    expect(MailboxReadToken.derive(rootKey, 'mailbox-other-id')).toBe(
      'AeZSqQOucnejW-DaUmGUjUa-Qr35YQDERN_OHXP2fMM',
    );
  });

  it('differs per root key', () => {
    expect(
      MailboxReadToken.derive(new Uint8Array(32).fill(8), mailboxId),
    ).not.toBe(MailboxReadToken.derive(rootKey, mailboxId));
  });

  it('encodes 32 bytes as unpadded base64url', () => {
    expect(MailboxReadToken.derive(rootKey, mailboxId)).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  it('rejects a root key that is not 32 bytes', () => {
    expect(() =>
      MailboxReadToken.derive(new Uint8Array(31), mailboxId),
    ).toThrow(RangeError);
  });

  it('rejects an empty mailbox id', () => {
    expect(() => MailboxReadToken.derive(rootKey, '')).toThrow(RangeError);
  });

  describe('deriveDevice', () => {
    const credentialA =
      '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----';
    const credentialB =
      '-----BEGIN PUBLIC KEY-----\nBBBB\n-----END PUBLIC KEY-----';

    it('differs from the root reader token for the same mailbox', () => {
      expect(
        MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialA),
      ).not.toBe(MailboxReadToken.derive(rootKey, mailboxId));
    });

    it('is stable for the same root key, mailbox and device credential', () => {
      expect(
        MailboxReadToken.deriveDevice(
          new Uint8Array(32).fill(9),
          mailboxId,
          credentialA,
        ),
      ).toBe(MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialA));
    });

    it('differs per device credential, so each device has its own reader', () => {
      expect(
        MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialB),
      ).not.toBe(
        MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialA),
      );
    });

    it('differs per mailbox', () => {
      expect(
        MailboxReadToken.deriveDevice(rootKey, 'mailbox-other-id', credentialA),
      ).not.toBe(
        MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialA),
      );
    });

    it('length-prefixes the mailbox id so the two fields cannot shift into each other', () => {
      expect(MailboxReadToken.deriveDevice(rootKey, 'ab', 'c')).not.toBe(
        MailboxReadToken.deriveDevice(rootKey, 'a', 'bc'),
      );
    });

    it('encodes 32 bytes as unpadded base64url', () => {
      expect(
        MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialA),
      ).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('rejects a root key that is not 32 bytes', () => {
      expect(() =>
        MailboxReadToken.deriveDevice(
          new Uint8Array(31),
          mailboxId,
          credentialA,
        ),
      ).toThrow(RangeError);
    });

    it('rejects an empty mailbox id or device credential', () => {
      expect(() =>
        MailboxReadToken.deriveDevice(rootKey, '', credentialA),
      ).toThrow(RangeError);
      expect(() =>
        MailboxReadToken.deriveDevice(rootKey, mailboxId, ''),
      ).toThrow(RangeError);
    });

    it('derives the pinned device token, matching Node crypto.hkdfSync', () => {
      expect(
        MailboxReadToken.deriveDevice(rootKey, mailboxId, credentialA),
      ).toBe('js4BVkg1uGoEfwYGrPmaTvGh7s8MuZnZhSg1zaYJzDA');
    });
  });
});
