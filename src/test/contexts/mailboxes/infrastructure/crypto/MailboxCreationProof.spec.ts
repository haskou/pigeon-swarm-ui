import { createHash } from 'node:crypto';

import { MailboxCreationProof } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCreationProof';

describe(MailboxCreationProof.name, () => {
  const mailboxId = 'F_vtY7XukvlaT5dzhBXk7iG2Ed2F3YlTDPUJTexhCuo';
  const postTokenHash =
    'e734c7512fa587c8a8ef6435a24adec6e25900055e717d11e5057595cc2328f7';
  const readTokenHash =
    'ccd7349c90b598ca4c5a6ba90a552c8a13d2020cd6f9b926638651dc3d48a18b';

  // Reference value computed independently with node:crypto.
  const pinnedNonce = '47805';

  const leadingZeroBitsAtLeast16 = (preimage: string): boolean => {
    const digest = createHash('sha256').update(preimage).digest();

    return digest[0] === 0 && digest[1] === 0;
  };

  const leadingZeroBits = (preimage: string): number => {
    const digest = createHash('sha256').update(preimage).digest();
    let bits = 0;

    for (const byte of digest) {
      if (byte === 0) {
        bits += 8;
        continue;
      }

      return bits + Math.clz32(byte) - 24;
    }

    return bits;
  };

  it('builds the node preimage layout', () => {
    expect(
      MailboxCreationProof.preimage(
        mailboxId,
        postTokenHash,
        readTokenHash,
        '7',
      ),
    ).toBe(
      `pigeon-mailbox-creation:v1:${mailboxId}:${postTokenHash}:${readTokenHash}:7`,
    );
  });

  it('mines the first nonce that satisfies the difficulty', () => {
    expect(
      MailboxCreationProof.mine(mailboxId, postTokenHash, readTokenHash),
    ).toBe(pinnedNonce);
    expect(
      MailboxCreationProof.isValid(
        mailboxId,
        postTokenHash,
        readTokenHash,
        pinnedNonce,
      ),
    ).toBe(true);
  });

  it('rejects every earlier counter nonce', () => {
    for (let counter = 0; counter < Number(pinnedNonce); counter += 1) {
      expect(
        MailboxCreationProof.isValid(
          mailboxId,
          postTokenHash,
          readTokenHash,
          counter.toString(),
        ),
      ).toBe(false);
    }
  });

  it('does not accept a proof solved for another mailbox', () => {
    expect(
      MailboxCreationProof.isValid(
        'another-mailbox-id-aaaaaaaaaaaaaaaaaaaaa',
        postTokenHash,
        readTokenHash,
        pinnedNonce,
      ),
    ).toBe(false);
  });

  it('does not accept a proof solved for another read token hash', () => {
    expect(
      MailboxCreationProof.isValid(
        mailboxId,
        postTokenHash,
        'a'.repeat(64),
        pinnedNonce,
      ),
    ).toBe(false);
  });

  it('rejects empty nonces', () => {
    expect(
      MailboxCreationProof.isValid(mailboxId, postTokenHash, readTokenHash, ''),
    ).toBe(false);
  });

  it('rejects an otherwise valid nonce longer than 64 characters', () => {
    const prefix = '0'.repeat(MailboxCreationProof.MAX_NONCE_LENGTH - 8 + 1);
    let longNonce: string | undefined;

    for (let counter = 0; longNonce === undefined; counter += 1) {
      const candidate = `${prefix}${counter.toString().padStart(8, '0')}`;

      if (
        leadingZeroBitsAtLeast16(
          MailboxCreationProof.preimage(
            mailboxId,
            postTokenHash,
            readTokenHash,
            candidate,
          ),
        )
      ) {
        longNonce = candidate;
      }
    }

    expect(longNonce.length).toBeGreaterThan(
      MailboxCreationProof.MAX_NONCE_LENGTH,
    );
    expect(
      MailboxCreationProof.isValid(
        mailboxId,
        postTokenHash,
        readTokenHash,
        longNonce,
      ),
    ).toBe(false);
  });

  it('mines a proof for the requested difficulty that also meets every lower one', () => {
    const nonce = MailboxCreationProof.mine(
      mailboxId,
      postTokenHash,
      readTokenHash,
      17,
    );

    expect(
      MailboxCreationProof.isValid(
        mailboxId,
        postTokenHash,
        readTokenHash,
        nonce,
        17,
      ),
    ).toBe(true);
    expect(
      MailboxCreationProof.isValid(mailboxId, postTokenHash, readTokenHash, nonce),
    ).toBe(true);
  });

  it('rejects a proof that meets fewer bits than the requested difficulty', () => {
    const bits = leadingZeroBits(
      MailboxCreationProof.preimage(
        mailboxId,
        postTokenHash,
        readTokenHash,
        pinnedNonce,
      ),
    );

    expect(
      MailboxCreationProof.isValid(
        mailboxId,
        postTokenHash,
        readTokenHash,
        pinnedNonce,
        bits,
      ),
    ).toBe(true);
    expect(
      MailboxCreationProof.isValid(
        mailboxId,
        postTokenHash,
        readTokenHash,
        pinnedNonce,
        bits + 1,
      ),
    ).toBe(false);
  });
});
