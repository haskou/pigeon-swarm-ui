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
});
