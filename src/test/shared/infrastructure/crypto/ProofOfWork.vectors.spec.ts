import {
  InvalidProofOfWorkError,
  ProofOfWork,
} from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/proof-of-work.json';

// The library ships these vectors; pigeon-swarm-node pins the same bytes.
type MintedVector = {
  difficultyBits: number;
  minted?: boolean;
  name: string;
  nonce: string;
};

type IdentityChallenge = {
  identityId: string;
  networkIds: string[];
};

type MailboxChallenge = {
  mailboxId: string;
  postTokenHash: string;
  readTokenHash: string;
};

type IdentityVector = MintedVector & { challenge: IdentityChallenge };
type MailboxVector = MintedVector & { challenge: MailboxChallenge };

const identityAdmission = (challenge: IdentityChallenge): ProofOfWork =>
  ProofOfWork.identityAdmission(challenge.identityId, challenge.networkIds);

const mailboxCreation = (challenge: MailboxChallenge): ProofOfWork =>
  ProofOfWork.mailboxCreation(
    challenge.mailboxId,
    challenge.postTokenHash,
    challenge.readTokenHash,
  );

describe('ProofOfWork identity admission vectors', () => {
  const accepted = vectors.identityAdmission.accepted as IdentityVector[];
  const rejected = vectors.identityAdmission.rejected as IdentityVector[];

  it.each(accepted)('accepts $name', ({ challenge, difficultyBits, nonce }) => {
    expect(identityAdmission(challenge).verify(nonce, difficultyBits)).toBe(
      true,
    );
  });

  it.each(accepted.filter((vector) => vector.minted === true))(
    'mints the reference nonce for $name',
    ({ challenge, difficultyBits, nonce }) => {
      expect(identityAdmission(challenge).mintSync(difficultyBits)).toBe(nonce);
    },
  );

  it.each(rejected)('rejects $name', ({ challenge, difficultyBits, nonce }) => {
    expect(identityAdmission(challenge).verify(nonce, difficultyBits)).toBe(
      false,
    );
  });

  it.each(
    vectors.identityAdmission.invalidChallenges as Array<{
      challenge: Partial<IdentityChallenge>;
      name: string;
    }>,
  )('refuses the challenge $name', ({ challenge }) => {
    expect(() =>
      ProofOfWork.identityAdmission(
        challenge.identityId ?? '',
        challenge.networkIds ?? [],
      ),
    ).toThrow(InvalidProofOfWorkError);
  });
});

describe('ProofOfWork mailbox creation vectors', () => {
  const accepted = vectors.mailboxCreation.accepted as MailboxVector[];
  const rejected = vectors.mailboxCreation.rejected as MailboxVector[];

  it.each(accepted)('accepts $name', ({ challenge, difficultyBits, nonce }) => {
    expect(mailboxCreation(challenge).verify(nonce, difficultyBits)).toBe(true);
  });

  it.each(accepted.filter((vector) => vector.minted === true))(
    'mints the reference nonce for $name',
    ({ challenge, difficultyBits, nonce }) => {
      expect(mailboxCreation(challenge).mintSync(difficultyBits)).toBe(nonce);
    },
  );

  it.each(rejected)('rejects $name', ({ challenge, difficultyBits, nonce }) => {
    expect(mailboxCreation(challenge).verify(nonce, difficultyBits)).toBe(
      false,
    );
  });

  it.each(
    vectors.mailboxCreation.invalidChallenges as Array<{
      challenge: Partial<MailboxChallenge>;
      name: string;
    }>,
  )('refuses the challenge $name', ({ challenge }) => {
    expect(() =>
      ProofOfWork.mailboxCreation(
        challenge.mailboxId ?? '',
        challenge.postTokenHash ?? '',
        challenge.readTokenHash ?? '',
      ),
    ).toThrow(InvalidProofOfWorkError);
  });
});
