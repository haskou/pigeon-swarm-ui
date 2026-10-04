import type { CallResource } from '../../infrastructure/http/resources/CallResource';
import type { CallPeerConnections } from '../../infrastructure/media/CallPeerConnections';
import type { CallSignalType } from '../../infrastructure/media/CallSignalType';
import type { CallSession } from '../view-models/CallSession';

import {
  logCallDebug,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';
import {
  shouldCreateInitialOffer,
  signalingRemotePeerIdentityIds,
} from './callPeerConnectionPlan';

export type CallSignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

export type ReceivedCallSignal = {
  callId: string;
  payload: Record<string, unknown>;
  senderIdentityId: string;
  signalType: CallSignalType;
};

export class CallSignalDispatcher {
  private currentIdentityIdValue: null | string = null;

  private readonly pendingSignals = new Map<string, ReceivedCallSignal[]>();

  private sendSignalValue: CallSignalSender | null = null;

  private startingCallId: null | string = null;

  public constructor(
    private readonly peerManager: CallPeerConnections,
    private readonly activeCallId: () => string | undefined,
  ) {}

  public get currentIdentityId(): null | string {
    return this.currentIdentityIdValue;
  }

  public get sendSignal(): CallSignalSender | null {
    return this.sendSignalValue;
  }

  public begin(
    currentIdentityId: string,
    sendSignal: CallSignalSender,
    callId: string,
  ): void {
    this.currentIdentityIdValue = currentIdentityId;
    this.sendSignalValue = sendSignal;
    this.startingCallId = callId;
  }

  public async connectSignalReadyPeers(
    call: CallSession,
    currentIdentityId: string,
    sendSignal: CallSignalSender,
  ): Promise<void> {
    const callResource: CallResource | undefined = call.call;

    if (!callResource) return;

    const peerIdentityIds = signalingRemotePeerIdentityIds(
      callResource,
      currentIdentityId,
    );

    logCallDebug('session:connect-signal-ready-peers', {
      callId: call.id,
      currentIdentityId,
      participantCount: call.participants.length,
      signalingParticipantCount: peerIdentityIds.length,
    });
    await Promise.all(
      peerIdentityIds.map((peerIdentityId) =>
        this.peerManager.ensurePeer(
          peerIdentityId,
          shouldCreateInitialOffer(
            callResource,
            currentIdentityId,
            peerIdentityId,
          ),
          sendSignal,
        ),
      ),
    );
  }

  public discardPending(callId: string): void {
    this.pendingSignals.delete(callId);

    if (this.startingCallId === callId) this.startingCallId = null;
  }

  public async flushPending(
    callId: string,
    sendSignal: CallSignalSender,
  ): Promise<void> {
    const signals = this.pendingSignals.get(callId);

    if (!signals?.length) return;

    this.pendingSignals.delete(callId);
    logCallDebug('session:flush-pending-signals', {
      callId,
      signalCount: signals.length,
    });

    for (const signal of signals) {
      await this.peerManager.handleSignal(
        signal.senderIdentityId,
        signal.signalType,
        signal.payload,
        sendSignal,
        this.currentIdentityIdValue ?? undefined,
      );
    }
  }

  public markStarted(): void {
    this.startingCallId = null;
  }

  public async receive(input: ReceivedCallSignal): Promise<void> {
    logCallDebug('session:receive-signal', {
      activeCallId: this.activeCallId(),
      callId: input.callId,
      senderIdentityId: input.senderIdentityId,
      signalType: input.signalType,
      startingCallId: this.startingCallId,
    });
    const sendSignal = this.sendSignalValue;
    const activeCallId = this.activeCallId();

    if (activeCallId && activeCallId !== input.callId) {
      logCallWarning('session:receive-signal:ignored-other-call', {
        activeCallId,
        callId: input.callId,
      });

      return;
    }

    if (!sendSignal || this.startingCallId === input.callId) {
      logCallDebug('session:receive-signal:queued', {
        callId: input.callId,
        hasSignalSender: Boolean(sendSignal),
        signalType: input.signalType,
      });
      this.queue(input);

      return;
    }

    await this.peerManager.handleSignal(
      input.senderIdentityId,
      input.signalType,
      input.payload,
      sendSignal,
      this.currentIdentityIdValue ?? undefined,
    );
  }

  public reset(): void {
    this.currentIdentityIdValue = null;
    this.pendingSignals.clear();
    this.sendSignalValue = null;
    this.startingCallId = null;
  }

  private queue(signal: ReceivedCallSignal): void {
    const signals = this.pendingSignals.get(signal.callId) ?? [];

    signals.push(signal);
    this.pendingSignals.set(signal.callId, signals.slice(-100));
    logCallDebug('session:queue-pending-signal', {
      callId: signal.callId,
      queuedCount: signals.length,
      signalType: signal.signalType,
    });
  }
}
