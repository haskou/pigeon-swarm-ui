import { CanonicalJson } from '@haskou/pigeon-swarm-crypto';

import type {
  DeviceSealingRecordClaim,
  UnsignedCallSignal,
} from './SealedCallSignal';

const CALL_SIGNAL_PREFIX = 'pigeon:call-signal:v1\n';
const SEALING_RECORD_PREFIX = 'pigeon:device-sealing-record:v1\n';

/**
 * The exact text a device credential signs: a domain prefix, then the RFC
 * 8785 canonical JSON of the claim, so a signature cannot be replayed as
 * another kind of statement.
 */
export class CallSignalSigningBytes {
  public static sealingRecord(record: DeviceSealingRecordClaim): string {
    return `${SEALING_RECORD_PREFIX}${CanonicalJson.serialize({
      deviceCredential: record.deviceCredential,
      identityId: record.identityId,
      sealingPublicKey: record.sealingPublicKey,
      utcDay: record.utcDay,
    })}`;
  }

  public static signal(signal: UnsignedCallSignal): string {
    return `${CALL_SIGNAL_PREFIX}${CanonicalJson.serialize({
      callId: signal.callId,
      createdAt: signal.createdAt,
      expiresAt: signal.expiresAt,
      networkId: signal.networkId,
      recipientIdentityId: signal.recipientIdentityId,
      scopeType: signal.scopeType,
      sealedEntries: signal.sealedEntries.map((entry) => ({
        envelope: entry.envelope,
        recipientDeviceCredential: entry.recipientDeviceCredential,
      })),
      senderDeviceCredential: signal.senderDeviceCredential,
      senderIdentityId: signal.senderIdentityId,
      signalId: signal.signalId,
      signalType: signal.signalType,
    })}`;
  }
}
