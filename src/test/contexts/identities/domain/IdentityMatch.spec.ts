import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';

const BARE = 'MCowBQYDK2VwAyEAidentity';
const PEM = `-----BEGIN PUBLIC KEY-----\n${BARE}\n-----END PUBLIC KEY-----\n`;

describe(IdentityMatch.name, () => {
  it('matches the same identity id', () => {
    expect(IdentityMatch.isSame(BARE, BARE)).toBe(true);
  });

  it('matches the same identity served in PEM and bare form', () => {
    expect(IdentityMatch.isSame(PEM, BARE)).toBe(true);
  });

  it('does not match another identity', () => {
    expect(IdentityMatch.isSame('MCowBQYDK2VwAyEAother', BARE)).toBe(false);
  });

  it('does not match a missing identity id', () => {
    expect(IdentityMatch.isSame(undefined, BARE)).toBe(false);
  });

  it('does not match an identity id the value object rejects', () => {
    expect(IdentityMatch.isSame('x'.repeat(5000), BARE)).toBe(false);
  });
});
