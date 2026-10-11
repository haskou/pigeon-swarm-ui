import { DevicePairingError } from '../../../../../contexts/identities/domain/DevicePairingError';
import { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { thrownPairingFailure } from '../thrownPairingFailure';

describe(DevicePairingCode.name, () => {
  it('rejects text that is not a pairing code without echoing it', () => {
    const pasted = 'not-a-pairing-code-secret';
    const action = () => DevicePairingCode.fromString(pasted);

    expect(thrownPairingFailure(action)).toBe('invalid');
    expect(action).toThrow(DevicePairingError);
    expect(action).not.toThrow(pasted);
  });

  it('reports a corrupted pairing payload as invalid', () => {
    const action = () => DevicePairingCode.fromString('psdp1.@@@').decode();

    expect(thrownPairingFailure(action)).toBe('invalid');
  });
});
