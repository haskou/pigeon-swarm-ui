import { useCallback, useEffect, useRef } from 'react';

import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSignalType } from '../../../../contexts/calls/infrastructure/media/CallSignalType';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { acknowledgeRealtimeCallSignal } from '../../../../app/presentation/realtime/useRealtimeEvents';
import {
  logCallDebug,
  logCallError,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { CallSignalDeliveryTracker } from '../../../../contexts/calls/infrastructure/realtime/CallSignalDeliveryTracker';
import { CallSnapshotRecovery } from '../../../../contexts/calls/infrastructure/realtime/CallSnapshotRecovery';
import { LiveCallSnapshots } from '../../../../contexts/calls/infrastructure/realtime/LiveCallSnapshots';
import { applicationContainer } from '../../../composition/applicationContainer';
import { CallResourceRefreshScheduler } from './CallResourceRefreshScheduler';
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
  onRecoveredCalls: (
    calls: CallResource[],
    previousActiveCallId?: string,
  ) => void;
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
): {
  handleRealtimeCallEvent: (event: RealtimeDomainEvent) => void;
  recoverRealtimeCalls: () => void;
  loadCallSnapshots: (
    load: () => Promise<CallResource[]>,
  ) => Promise<CallResource[] | undefined>;
} {
  const {
    activeCallRef,
    onRecoveredCalls,
    receiveSignal,
    reconcileCallResource,
    sessionRef,
  } = input;
  const snapshotsRef = useRef(new LiveCallSnapshots());
  const recoveryRef = useRef(new CallSnapshotRecovery());
  useEffect(() => () => recoveryRef.current.reset(), []);
  const callSignalDeliveriesRef = useRef(new CallSignalDeliveryTracker());

  const loadCallResource = useCallback(
    async (callId: string, eventType: string): Promise<void> => {
      const revision = snapshotsRef.current.version(callId);
      await recoveryRef.current.request(
        callId,
        () => applicationContainer.calls.get(sessionRef.current, callId),
        (call) => {
          if (revision === snapshotsRef.current.version(callId)) {
            snapshotsRef.current.remember(call);
            reconcileCallResource(call);
          }
        },
        (caught) =>
          logCallError(
            'workspace:realtime-call-event:resource-load-failed',
            caught,
            { callId, eventType },
          ),
      );
    },
    [activeCallRef, reconcileCallResource, sessionRef],
  );
  const loadCallResourceRef = useRef(loadCallResource);
  loadCallResourceRef.current = loadCallResource;
  const callResourceRefreshSchedulerRef = useRef<
    CallResourceRefreshScheduler | undefined
  >(undefined);

  if (!callResourceRefreshSchedulerRef.current) {
    callResourceRefreshSchedulerRef.current = new CallResourceRefreshScheduler(
      async (callId, eventType) =>
        await loadCallResourceRef.current(callId, eventType),
    );
  }

  const refreshCallResource = useCallback(
    (callId: string, eventType: string): void => {
      callResourceRefreshSchedulerRef.current?.request(callId, eventType);
    },
    [],
  );

  const recoverMalformedSnapshot = (
    callId: string,
    event: RealtimeDomainEvent,
  ): void => {
    if (!snapshotsRef.current.isStale(event))
      void loadCallResourceRef.current(callId, event.type);
  };

  const handleRealtimeCallEvent = useCallback(
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
            .catch((caught: unknown) => {
              logCallError(
                'workspace:realtime-call-event:signal-processing-failed',
                caught,
                {
                  callId: eventCallId,
                  senderIdentityId: signal.senderIdentityId,
                  signalType: signal.signalType,
                },
              );
            });
        }

        return;
      }

      if (!eventCallId) return;

      const snapshot = snapshotsRef.current.receive(event);

      if (snapshot) {
        reconcileCallResource(snapshot);

        return;
      }

      if (event.attributes.liveCall !== undefined) {
        recoverMalformedSnapshot(eventCallId, event);

        return;
      }

      if (!callResourceRefreshIsRequired(event)) {
        return;
      }

      refreshCallResource(eventCallId, event.type);
    },
    [
      activeCallRef,
      receiveSignal,
      reconcileCallResource,
      refreshCallResource,
      sessionRef,
    ],
  );

  const recoverRealtimeCalls = useCallback((): void => {
    snapshotsRef.current.reset();
    recoveryRef.current.reset();
    const previousActiveCallId = activeCallRef.current?.id;
    void recoveryRef.current.request(
      'active-calls',
      () => applicationContainer.calls.list(sessionRef.current),
      (calls) => {
        const recovered = snapshotsRef.current.recover(calls);
        recovered.forEach(reconcileCallResource);
        onRecoveredCalls(recovered, previousActiveCallId);
      },
      (caught) => logCallError('workspace:call-recovery-failed', caught),
    );
  }, [activeCallRef, onRecoveredCalls, reconcileCallResource, sessionRef]);

  const loadCallSnapshots = useCallback(
    (load: () => Promise<CallResource[]>) => snapshotsRef.current.load(load),
    [],
  );

  return { handleRealtimeCallEvent, loadCallSnapshots, recoverRealtimeCalls };
}
