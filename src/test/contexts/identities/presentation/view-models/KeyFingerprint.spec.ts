import { describe, expect, it } from '@jest/globals';
import { Buffer } from 'buffer';
import { createHash } from 'crypto';

import { KeyFingerprint } from '../../../../../contexts/identities/presentation/view-models/KeyFingerprint';

const grouped = (hex: string): string =>
  hex.slice(0, 32).toUpperCase().match(/.{4}/g)!.join(' ');

describe(KeyFingerprint.name, () => {
  it('fingerprints the decoded public key, from a bare id or a PEM block', () => {
    const publicKey = Buffer.from('subject-public-key-info');
    const encoded = publicKey.toString('base64');
    const expected = grouped(
      createHash('sha256').update(publicKey).digest('hex'),
    );

    expect(KeyFingerprint.ofPublicKey(encoded)).toBe(expected);
    expect(
      KeyFingerprint.ofPublicKey(
        `-----BEGIN PUBLIC KEY-----\n${encoded}\n-----END PUBLIC KEY-----\n`,
      ),
    ).toBe(expected);
    expect(KeyFingerprint.ofPublicBytes(publicKey)).toBe(expected);
  });

  it('domain-separates secret fingerprints from a plain hash of the secret', () => {
    const secret = Buffer.alloc(32, 7);
    const fingerprint = KeyFingerprint.ofSecret(secret);

    expect(fingerprint).toMatch(/^(?:[0-9A-F]{4} ){7}[0-9A-F]{4}$/);
    expect(fingerprint).not.toBe(
      grouped(createHash('sha256').update(secret).digest('hex')),
    );
    expect(fingerprint).not.toBe(KeyFingerprint.ofPublicBytes(secret));
    expect(KeyFingerprint.ofSecret(Buffer.alloc(32, 7))).toBe(fingerprint);
    expect(KeyFingerprint.ofSecret(Buffer.alloc(32, 8))).not.toBe(fingerprint);
  });
});
