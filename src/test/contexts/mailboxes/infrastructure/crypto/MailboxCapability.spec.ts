import { createHash } from 'node:crypto';

import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';

describe(MailboxCapability.name, () => {
  it('hashes a token to the SHA-256 hex the node stores', () => {
    expect(MailboxCapability.hash('read-token-example')).toBe(
      createHash('sha256').update('read-token-example').digest('hex'),
    );
  });

  it('generates distinct 32-byte base64url tokens', () => {
    const first = MailboxCapability.generate();
    const second = MailboxCapability.generate();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });
});
