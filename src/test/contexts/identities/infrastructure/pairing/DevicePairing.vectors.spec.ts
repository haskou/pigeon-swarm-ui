import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/device-pairing.json';
import { Timestamp } from '@haskou/value-objects';

import { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { DevicePairingCodeReader } from '../../../../../contexts/identities/infrastructure/pairing/DevicePairingCodeReader';
import { thrownPairingFailure } from '../../domain/thrownPairingFailure';

const acceptedAt = new Timestamp(vectors.request.payload.authorizedAt);
const transport = KeyPair.fromPrimitives({
  privateKey: vectors.keys.transport.privateKeyPem,
  publicKey: vectors.keys.transport.publicKeyPem,
} as never);

const invitationCode = (payload: object, signature: string) =>
  DevicePairingCode.encode({
    kind: 'pigeon-device-pairing-invitation',
    ...payload,
    signature,
  });
const requestCode = (payload: object, signature: string) =>
  DevicePairingCode.encode({
    kind: 'pigeon-device-pairing-request',
    ...payload,
    signature,
  });
const completionCode = (payload: object, signature: string) =>
  DevicePairingCode.encode({
    kind: 'pigeon-device-pairing-completion',
    ...payload,
    signature,
  });
const request = () =>
  DevicePairingCodeReader.request(
    requestCode(vectors.request.payload, vectors.request.signature),
    acceptedAt,
  );

describe('device pairing vectors from @haskou/pigeon-swarm-crypto', () => {
  it('accepts the signed invitation and re-encodes it byte for byte', () => {
    const invitation = DevicePairingCodeReader.invitation(
      DevicePairingCode.fromString(vectors.invitation.code),
      acceptedAt,
    );

    expect(invitation.toCode().valueOf()).toBe(vectors.invitation.code);
  });

  it('accepts the signed request and derives its verification code', async () => {
    const [verification] = vectors.verificationCodes;

    expect(await request().getVerificationCode()).toBe(verification!.code);
  });

  it('accepts the signed completion and only then opens the material', () => {
    const completion = DevicePairingCodeReader.completion(
      completionCode(vectors.completion.payload, vectors.completion.signature),
    );

    expect(
      thrownPairingFailure(() =>
        completion.decryptMaterial(request(), transport),
      ),
    ).toBeUndefined();
  });

  it.each(vectors.rejected)(
    'rejects $name',
    ({ format, payload, signature }) => {
      const read: Record<string, () => unknown> = {
        completion: () =>
          DevicePairingCodeReader.completion(
            completionCode(payload, signature),
          ).decryptMaterial(request(), transport),
        invitation: () =>
          DevicePairingCodeReader.invitation(
            invitationCode(payload, signature),
            acceptedAt,
          ),
        request: () =>
          DevicePairingCodeReader.request(
            requestCode(payload, signature),
            acceptedAt,
          ),
      };

      expect(thrownPairingFailure(read[format]!)).toBe('invalid');
    },
  );
});
