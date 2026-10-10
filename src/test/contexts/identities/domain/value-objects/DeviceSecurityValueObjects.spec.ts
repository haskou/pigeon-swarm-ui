import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceRootKeyEnvelope } from '../../../../../contexts/identities/domain/value-objects/DeviceRootKeyEnvelope';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';

describe('device security value objects', () => {
  it('represents the genesis authorization checkpoint', () => {
    expect(DeviceAuthorizationEpoch.genesis().valueOf()).toBe('genesis');
    expect(DeviceAuthorizationRevision.initial().valueOf()).toBe(0);
    expect(() => DeviceAuthorizationRevision.fromNumber(-1)).toThrow();
  });
  it('canonicalizes device identifiers and compares by value', () => {
    const deviceId = DeviceId.fromString(
      ' 550E8400-E29B-41D4-A716-446655440000 ',
    );

    expect(deviceId.valueOf()).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(
      deviceId.isEqual(
        DeviceId.fromString('550e8400-e29b-41d4-a716-446655440000'),
      ),
    ).toBe(true);
    expect(() => DeviceId.fromString('device-1')).toThrow();
  });

  it('keeps a validated signing credential as a domain value', () => {
    const publicKey =
      '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAPW21iqKutjL6ohU77RAPxYEsgrH6RPDhawLJC+DHmZw=\n-----END PUBLIC KEY-----\n';
    const credential = DeviceCredential.fromString(publicKey);

    expect(credential.isEqual(DeviceCredential.fromString(publicKey))).toBe(
      true,
    );
    expect(credential.getPublicKey().valueOf()).toBe(publicKey);
    expect(() => DeviceCredential.fromString('not-a-public-key')).toThrow();
  });

  it('validates protected-root envelopes and exposes serialization explicitly', () => {
    const serialized = [
      'v1',
      'scrypt',
      'N262144',
      'r8',
      'p1',
      'hkdf-sha256',
      'aes-256-gcm',
      Buffer.alloc(16).toString('base64'),
      Buffer.alloc(12).toString('base64'),
      Buffer.alloc(16).toString('base64'),
      Buffer.alloc(32).toString('base64'),
    ].join('.');
    const envelope = DeviceRootKeyEnvelope.fromString(serialized);

    expect(envelope.serialize()).toBe(serialized);
    expect(envelope.isEqual(DeviceRootKeyEnvelope.fromString(serialized))).toBe(
      true,
    );
    expect(() => DeviceRootKeyEnvelope.fromString('invalid')).toThrow();
    expect(() => JSON.stringify(envelope)).toThrow();
  });

  it('rejects protected-root envelopes whose KDF parameters differ from the pinned header', () => {
    const serialized = [
      'v1',
      'scrypt',
      'N262144',
      'r8',
      'p1',
      'hkdf-sha256',
      'aes-256-gcm',
      Buffer.alloc(16).toString('base64'),
      Buffer.alloc(12).toString('base64'),
      Buffer.alloc(16).toString('base64'),
      Buffer.alloc(32).toString('base64'),
    ].join('.');

    expect(() =>
      DeviceRootKeyEnvelope.fromString(
        serialized.replace('N262144', 'N1048576'),
      ),
    ).toThrow();
    expect(() =>
      DeviceRootKeyEnvelope.fromString(serialized.replace('.r8.', '.r16.')),
    ).toThrow();
    expect(() =>
      DeviceRootKeyEnvelope.fromString(serialized.replace('.p1.', '.p2.')),
    ).toThrow();
  });

  it('uses an opaque canonical handle for the non-exportable key record', () => {
    const handle = DeviceUnlockSecretHandle.fromString(
      ' 550E8400-E29B-41D4-A716-446655440001 ',
    );

    expect(handle.valueOf()).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(
      handle.isEqual(
        DeviceUnlockSecretHandle.fromString(
          '550e8400-e29b-41d4-a716-446655440001',
        ),
      ),
    ).toBe(true);
    expect(() => DeviceUnlockSecretHandle.fromString('secret')).toThrow();
  });
});
