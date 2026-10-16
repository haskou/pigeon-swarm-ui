import { useEffect, useRef } from 'react';

import type { CallMediaKey } from '../../../../contexts/calls/infrastructure/media/CallMediaKey';
import type { CallMediaRekeyCall } from './CallMediaRekeyCall';
import type { CallMediaRekeyTarget } from './CallMediaRekeyTarget';

import { callMediaRekeyTargetOf } from './callMediaRekeyTargetOf';
import { startCallMediaRekeyLoop } from './startCallMediaRekeyLoop';

type CallMediaRekeyInput = {
  activeCall: CallMediaRekeyCall | null;
  /** The call's media key in the latest epoch this device can reach. */
  currentMediaKey: (target: CallMediaRekeyTarget) => Promise<CallMediaKey>;
  rekeyMediaEncryption: (callId: string, key: CallMediaKey) => void;
};

/**
 * Keeps an encrypted community call on its group's newest media key while
 * it runs; stops when the call ends, changes or the workspace unmounts.
 */
export function useCallMediaRekey({
  activeCall,
  currentMediaKey,
  rekeyMediaEncryption,
}: CallMediaRekeyInput): void {
  const currentMediaKeyRef = useRef(currentMediaKey);
  const rekeyMediaEncryptionRef = useRef(rekeyMediaEncryption);
  const target = callMediaRekeyTargetOf(activeCall);
  const callId = target?.callId;
  const channelId = target?.channelId;
  const communityId = target?.communityId;

  useEffect(() => {
    currentMediaKeyRef.current = currentMediaKey;
    rekeyMediaEncryptionRef.current = rekeyMediaEncryption;
  }, [currentMediaKey, rekeyMediaEncryption]);

  useEffect(() => {
    if (!callId || !channelId || !communityId) return undefined;

    return startCallMediaRekeyLoop({
      callId,
      currentKey: async () =>
        await currentMediaKeyRef.current({ callId, channelId, communityId }),
      rekey: (key) => rekeyMediaEncryptionRef.current(callId, key),
    });
  }, [callId, channelId, communityId]);
}
