import { X25519PublicKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CallSignalType } from '../media/CallSignalType';
import type { SealingViewResource } from './PigeonCallSealingApi';
import type {
  CallSignalScopeType,
  SealedCallSignal,
  UnsignedCallSignal,
} from './SealedCallSignal';

import { decodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { CallSignalSigningBytes } from './CallSignalSigningBytes';

export const CALL_SIGNAL_LIFETIME_MS = 20_000;
const DAY_MS = 86_400_000;

export type CallSignalSealInput = {
  callId: string;
  networkId: string;
  payload: Record<string, unknown>;
  recipientIdentityId: string;
  scopeType: CallSignalScopeType;
  signalType: CallSignalType;
};

type SealingViewReader = {
  sealingView(identityId: string): Promise<SealingViewResource>;
};

/**
 * Builds the wire object of a call signal: the payload sealed once per
 * recipient device under the device's published sealing key, the whole
 * body signed by this device's credential, a fixed 20 second lifetime.
 */
export class CallSignalSealer {
  public constructor(
    private readonly view: SealingViewReader,
    private readonly clock: () => number,
    private readonly newSignalId: () => string,
  ) {}

  private static day(at: number): string {
    return new Date(at).toISOString().slice(0, 10);
  }

  public async seal(
    session: Session,
    input: CallSignalSealInput,
  ): Promise<SealedCallSignal> {
    const createdAt = this.clock();
    const today = CallSignalSealer.day(createdAt);
    const yesterday = CallSignalSealer.day(createdAt - DAY_MS);
    const { devices } = await this.view.sealingView(input.recipientIdentityId);
    const plaintext = JSON.stringify(input.payload);
    const sealedEntries = devices.flatMap((device) => {
      const key =
        device.sealingKeys.find((entry) => entry.utcDay === today) ??
        device.sealingKeys.find((entry) => entry.utcDay === yesterday);

      return key
        ? [
            {
              envelope: X25519PublicKey.fromRaw(
                decodeBase64Url(key.sealingPublicKey),
              )
                .encrypt(plaintext)
                .valueOf(),
              recipientDeviceCredential: device.deviceCredential,
            },
          ]
        : [];
    });

    if (sealedEntries.length === 0) {
      throw new Error('no device of the recipient published a sealing key');
    }

    const { publicKey: senderDeviceCredential } =
      session.deviceCredentialKeyPair.toPrimitives();
    const unsigned: UnsignedCallSignal = {
      callId: input.callId,
      createdAt,
      expiresAt: createdAt + CALL_SIGNAL_LIFETIME_MS,
      networkId: input.networkId,
      recipientIdentityId: input.recipientIdentityId,
      scopeType: input.scopeType,
      sealedEntries,
      senderDeviceCredential,
      senderIdentityId: session.identity.id,
      signalId: this.newSignalId(),
      signalType: input.signalType,
    };

    return {
      ...unsigned,
      signature: session.deviceCredentialKeyPair
        .sign(CallSignalSigningBytes.signal(unsigned))
        .valueOf(),
    };
  }
}
