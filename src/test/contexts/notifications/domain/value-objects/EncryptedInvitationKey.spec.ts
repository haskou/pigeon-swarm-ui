import { EncryptedInvitationKeyRequiredError } from '../../../../../contexts/notifications/domain/errors/EncryptedInvitationKeyRequiredError';
import { EncryptedInvitationKey } from '../../../../../contexts/notifications/domain/value-objects/EncryptedInvitationKey';

describe(EncryptedInvitationKey.name, () => {
  it('preserves encrypted invitations larger than the default text limit', () => {
    const payload = 'a'.repeat(541);

    expect(EncryptedInvitationKey.fromString(payload).hasValue(payload)).toBe(
      true,
    );
  });

  it('rejects a blank invitation', () => {
    expect(() => EncryptedInvitationKey.fromString('  ')).toThrow(
      EncryptedInvitationKeyRequiredError,
    );
  });
});
