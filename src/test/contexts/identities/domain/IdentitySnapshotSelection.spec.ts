import { IdentitySnapshotSelection } from '../../../../contexts/identities/domain/IdentitySnapshotSelection';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityVersion } from '../../../../contexts/identities/domain/value-objects/IdentityVersion';
import { KeychainVersion } from '../../../../contexts/identities/domain/value-objects/KeychainVersion';

function identityAt(
  version: number,
  id = 'identity-1',
): { id: IdentityId; version: IdentityVersion } {
  return {
    id: IdentityId.fromString(id),
    version: IdentityVersion.fromNumber(version),
  };
}

describe(IdentitySnapshotSelection.name, () => {
  describe('selectIdentity', () => {
    it('takes the incoming identity when it is newer', () => {
      expect(
        IdentitySnapshotSelection.selectIdentity(identityAt(1), identityAt(2)),
      ).toBe('incoming');
    });

    it('takes the incoming identity at the same version', () => {
      expect(
        IdentitySnapshotSelection.selectIdentity(identityAt(2), identityAt(2)),
      ).toBe('incoming');
    });

    it('keeps the held identity when the incoming one is older', () => {
      expect(
        IdentitySnapshotSelection.selectIdentity(identityAt(3), identityAt(2)),
      ).toBe('held');
    });

    it('discards an incoming snapshot of another identity', () => {
      expect(
        IdentitySnapshotSelection.selectIdentity(
          identityAt(1),
          identityAt(5, 'identity-2'),
        ),
      ).toBe('discard');
    });
  });

  describe('selectKeychain', () => {
    it('takes the incoming keychain when it is at least as new', () => {
      expect(
        IdentitySnapshotSelection.selectKeychain(
          KeychainVersion.fromNumber(2),
          KeychainVersion.fromNumber(2),
        ),
      ).toBe('incoming');
    });

    it('keeps the held keychain when the incoming one is older', () => {
      expect(
        IdentitySnapshotSelection.selectKeychain(
          KeychainVersion.fromNumber(3),
          KeychainVersion.fromNumber(2),
        ),
      ).toBe('held');
    });
  });
});

describe(IdentityVersion.name, () => {
  it('rejects a negative version', () => {
    expect(() => IdentityVersion.fromNumber(-1)).toThrow();
  });
});

describe(KeychainVersion.name, () => {
  it('rejects a fractional version', () => {
    expect(() => KeychainVersion.fromNumber(1.5)).toThrow();
  });
});
