import { CommunityNotificationPolicy } from '../../../../../app/presentation/workspace/components/CommunityNotificationPolicy';

const OWN_ID = 'MCowBQYDK2VwAyEAown';

describe(CommunityNotificationPolicy.name, () => {
  it('suppresses an own message authored with the own id in PEM form', () => {
    expect(
      CommunityNotificationPolicy.isSuppressed(
        false,
        true,
        `-----BEGIN PUBLIC KEY-----\n${OWN_ID}\n-----END PUBLIC KEY-----\n`,
        OWN_ID,
      ),
    ).toBe(true);
  });

  it('notifies an allowed message from another author in an inactive channel', () => {
    expect(
      CommunityNotificationPolicy.isSuppressed(
        false,
        true,
        'MCowBQYDK2VwAyEApeer',
        OWN_ID,
      ),
    ).toBe(false);
  });

  it('suppresses messages in the active channel or when not allowed', () => {
    expect(
      CommunityNotificationPolicy.isSuppressed(true, true, undefined, OWN_ID),
    ).toBe(true);
    expect(
      CommunityNotificationPolicy.isSuppressed(false, false, undefined, OWN_ID),
    ).toBe(true);
  });
});
