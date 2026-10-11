import { DevicePairingError } from '../../../../../contexts/identities/domain/DevicePairingError';
import { toDevicePairingErrorMessage } from '../../../../../contexts/identities/presentation/view-models/toDevicePairingErrorMessage';
import { copy } from '../../../../../shared/presentation/i18n/copy';

describe('toDevicePairingErrorMessage', () => {
  it('explains each rejected pairing code in plain language', () => {
    expect(
      toDevicePairingErrorMessage(new DevicePairingError('expired', 'x')),
    ).toBe(copy.profile.devicePairingExpired);
    expect(
      toDevicePairingErrorMessage(new DevicePairingError('used', 'x')),
    ).toBe(copy.profile.devicePairingUsed);
    expect(
      toDevicePairingErrorMessage(new DevicePairingError('mismatch', 'x')),
    ).toBe(copy.profile.devicePairingMismatch);
    expect(
      toDevicePairingErrorMessage(new DevicePairingError('invalid', 'x')),
    ).toBe(copy.profile.devicePairingInvalid);
  });

  it('never shows raw domain text or placeholders', () => {
    const raw = new Error('[redacted pairing code]');

    expect(toDevicePairingErrorMessage(raw)).toBe(
      copy.profile.devicePairingError,
    );
    expect(toDevicePairingErrorMessage(raw)).not.toContain('redacted');
  });

  it('reports a dropped connection as a network problem', () => {
    expect(toDevicePairingErrorMessage(new TypeError('fetch failed'))).toBe(
      copy.errors.network,
    );
  });
});
