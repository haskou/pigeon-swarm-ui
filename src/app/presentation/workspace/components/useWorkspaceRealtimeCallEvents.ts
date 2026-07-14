import { useCallback, useRef } from 'react';

import type {
  CallResource,
  CallSession,
  CallSignalType,
} from '../../../../contexts/calls/domain/callSession.types';
import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { acknowledgeRealtimeCallSignal } from '../../../../app/presentation/realtime/useRealtimeEvents';
import {
  logCallDebug,
  logCallError,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { CallSignalDeliveryTracker } from '../../../../contexts/calls/infrastructure/realtime/CallSignalDeliveryTracker';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  callIdFromRealtimeEvent,
  callResourceRefreshIsRequired,
  callSignalTypeAttribute,
  numberAttribute,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';

type WorkspaceRealtimeCallEventsInput = {
  activeCallRef: { current: CallSession | null };
  receiveSignal: (input: {
    callId: string;
    payload: Record<string, unknown>;
    senderIdentityId: string;
    signalType: CallSignalType;
  }) => Promise<void>;
  reconcileCallResource: (call: CallResource) => void;
  sessionRef: { current: Session };
};

type ReceivedCallSignal = {
  expiresAt: number;
  payload: Record<string, unknown>;
  senderIdentityId: string;
  signalId: string;
  signalType: CallSignalType;
};

function receivedCallSignal(
  event: RealtimeDomainEvent,
  recipientIdentityId: string,
): ReceivedCallSignal | undefined {
  const senderIdentityId = stringAttribute(event, 'senderIdentityId');
  const recipient = stringAttribute(event, 'recipientIdentityId');
  const signalType = callSignalTypeAttribute(event);
  const payload = recordAttribute(event, 'payload');
  const expiresAt = numberAttribute(event, 'expiresAt');
  const signalId = stringAttribute(event, 'signalId');

  if (
    !senderIdentityId ||
    recipient !== recipientIdentityId ||
    !signalType ||
    !payload ||
    expiresAt === undefined ||
    !signalId
  ) {
    return undefined;
  }

  return { expiresAt, payload, senderIdentityId, signalId, signalType };
}

export function useWorkspaceRealtimeCallEvents(
  input: WorkspaceRealtimeCallEventsInput,
): (event: RealtimeDomainEvent) => void {
  const { activeCallRef, receiveSignal, reconcileCallResource, sessionRef } =
    input;
  const callSignalDeliveriesRef = useRef(new CallSignalDeliveryTracker());
  const callResourceLoadsRef = useRef(new Map<string, Promise<void>>());

  const refreshCallResource = useCallback(
    (callId: string, eventType: string): void => {
      if (callResourceLoadsRef.current.has(callId)) return;

      const load = applicationContainer.calls
        .get(sessionRef.current, callId)
        .then((call) => {
          logCallDebug('workspace:realtime-call-event:resource-loaded', {
            activeCallId: activeCallRef.current?.id,
            callId: call.id,
            participantStatuses: call.participants.map((participant) => ({
              connected: participant.connected,
              identityId: participant.identityId,
              status: participant.status,
            })),
            status: call.status,
          });
          reconcileCallResource(call);
        })
        .catch((caught) => {
          logCallError(
            'workspace:realtime-call-event:resource-load-failed',
            caught,
            { callId, eventType },
          );
        })
        .finally(() => {
          callResourceLoadsRef.current.delete(callId);
        });

      callResourceLoadsRef.current.set(callId, load);
    },
    [activeCallRef, reconcileCallResource, sessionRef],
  );

  return useCallback(
    (event: RealtimeDomainEvent): void => {
      const eventCallId = callIdFromRealtimeEvent(event);

      logCallDebug('workspace:realtime-call-event', {
        activeCallId: activeCallRef.current?.id,
        callId: eventCallId,
        eventType: event.type,
      });

      if (event.type === 'calls.v1.signal.sent') {
        const signal = receivedCallSignal(
          event,
          sessionRef.current.identity.id,
        );

        if (eventCallId && signal) {
          void callSignalDeliveriesRef.current
            .receive(
              { expiresAt: signal.expiresAt, signalId: signal.signalId },
              async () =>
                await receiveSignal({
                  callId: eventCallId,
                  payload: signal.payload,
                  senderIdentityId: signal.senderIdentityId,
                  signalType: signal.signalType,
                }),
              () =>
                acknowledgeRealtimeCallSignal(
                  sessionRef.current,
                  signal.signalId,
                ),
            )
            .catch(() => undefined);
        }

        return;
      }

      if (!eventCallId) return;

      if (
        !callResourceRefreshIsRequired(
          event,
          sessionRef.current.identity.id,
        )
      ) {
        return;
      }

      refreshCallResource(eventCallId, event.type);
    },
    [activeCallRef, receiveSignal, refreshCallResource, sessionRef],
  );
}
