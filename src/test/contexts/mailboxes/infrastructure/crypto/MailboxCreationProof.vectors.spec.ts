import { createHash } from 'node:crypto';

import { MailboxCreationProof } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCreationProof';
import vectors from '../../../../fixtures/mailbox-creation-proof-vectors.json';

// Same bytes as pigeon-swarm-node
// tests/fixtures/mailbox-creation-proof-vectors.json.
describe('MailboxCreationProof vectors', () => {
  const all = [...vectors.accepted, ...vectors.rejected];

  it.each(all)(
    'pins the preimage and digest of $name',
    ({ derived, input }) => {
      const preimage = MailboxCreationProof.preimage(
        input.mailboxId,
        input.postTokenHash,
        input.readTokenHash,
        input.nonce,
      );

      expect(preimage).toBe(derived.preimage);
      expect(createHash('sha256').update(preimage).digest('hex')).toBe(
        derived.digestHex,
      );
    },
  );

  it.each(vectors.accepted)('accepts and mines $name', ({ input }) => {
    expect(
      MailboxCreationProof.isValid(
        input.mailboxId,
        input.postTokenHash,
        input.readTokenHash,
        input.nonce,
        input.difficultyBits,
      ),
    ).toBe(true);
    expect(
      MailboxCreationProof.mine(
        input.mailboxId,
        input.postTokenHash,
        input.readTokenHash,
        input.difficultyBits,
      ),
    ).toBe(input.nonce);
  });

  it.each(vectors.rejected)('rejects $name', ({ input }) => {
    expect(
      MailboxCreationProof.isValid(
        input.mailboxId,
        input.postTokenHash,
        input.readTokenHash,
        input.nonce,
        input.difficultyBits,
      ),
    ).toBe(false);
  });
});
