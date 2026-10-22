import {
  KeyPair,
  Signature,
  X25519EncryptedPayload,
  X25519KeyPair,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { CallSignalSealer } from '../../../../../contexts/calls/infrastructure/signals/CallSignalSealer';
import { CallSignalSigningBytes } from '../../../../../contexts/calls/infrastructure/signals/CallSignalSigningBytes';
import { encodeBase64Url } from '../../../../../shared/infrastructure/encoding/base64url';
import vectors from '../../../../fixtures/device-authorization-transition-log-vectors.json';

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
const device = KeyPair.fromPrimitives({
  privateKey: vectors.keys.author.privateKeyPem,
  publicKey: vectors.keys.author.publicKeyPem,
});
const session = {
  deviceCredentialKeyPair: device,
  identity: { id: 'alice' },
} as unknown as Session;
const phone = X25519KeyPair.generate();
const laptop = X25519KeyPair.generate();
const sealingKey = (pair: X25519KeyPair): string =>
  encodeBase64Url(pair.getPublicKey().toRaw());
const view = (
  devices: {
    deviceCredential: string;
    sealingKeys: { sealingPublicKey: string; utcDay: string }[];
  }[],
) => ({
  sealingView: jest.fn().mockResolvedValue({
    devices,
    identityId: 'bob',
    revision: 3,
  }),
});
const input = {
  callId: 'call-a',
  networkId: 'network-a',
  payload: { sdp: 'offer-sdp' },
  recipientIdentityId: 'bob',
  scopeType: 'conversation' as const,
  signalType: 'offer' as const,
};

describe(CallSignalSealer.name, () => {
  it('seals one entry per recipient device and signs the whole body without a payload', async () => {
    const sealer = new CallSignalSealer(
      view([
        {
          deviceCredential: 'phone',
          sealingKeys: [
            { sealingPublicKey: sealingKey(phone), utcDay: '2026-10-04' },
          ],
        },
        {
          deviceCredential: 'laptop',
          sealingKeys: [
            { sealingPublicKey: sealingKey(laptop), utcDay: '2026-10-04' },
          ],
        },
      ]),
      () => NOW,
      () => 'signal-1',
    );

    const signal = await sealer.seal(session, input);

    expect(signal).not.toHaveProperty('payload');
    expect(signal).toMatchObject({
      callId: 'call-a',
      createdAt: NOW,
      expiresAt: NOW + 20_000,
      recipientIdentityId: 'bob',
      scopeType: 'conversation',
      senderDeviceCredential: vectors.keys.author.publicKeyPem,
      senderIdentityId: 'alice',
      signalId: 'signal-1',
      signalType: 'offer',
    });
    expect(
      signal.sealedEntries.map((e) => e.recipientDeviceCredential),
    ).toEqual(['phone', 'laptop']);
    expect(
      JSON.parse(
        phone
          .decrypt(new X25519EncryptedPayload(signal.sealedEntries[0].envelope))
          .toString('utf8'),
      ),
    ).toEqual({ sdp: 'offer-sdp' });
    const { signature, ...unsigned } = signal;

    expect(
      device.isValidSignature(
        CallSignalSigningBytes.signal(unsigned),
        new Signature(signature),
      ),
    ).toBe(true);
  });

  it('falls back to the previous day key of a device that has not rolled over', async () => {
    const sealer = new CallSignalSealer(
      view([
        {
          deviceCredential: 'phone',
          sealingKeys: [
            { sealingPublicKey: sealingKey(phone), utcDay: '2026-10-03' },
          ],
        },
      ]),
      () => NOW,
      () => 'signal-1',
    );

    expect((await sealer.seal(session, input)).sealedEntries).toHaveLength(1);
  });

  it('ignores keys older than the previous day and refuses with no sealable device', async () => {
    const sealer = new CallSignalSealer(
      view([
        {
          deviceCredential: 'phone',
          sealingKeys: [
            { sealingPublicKey: sealingKey(phone), utcDay: '2026-10-01' },
          ],
        },
      ]),
      () => NOW,
      () => 'signal-1',
    );

    await expect(sealer.seal(session, input)).rejects.toThrow(
      'no device of the recipient published a sealing key',
    );
  });
});
