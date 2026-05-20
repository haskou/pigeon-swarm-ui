import type { Session } from '../../domain/pigeonResources.types';

export type RealtimeHeartbeatActivityMode = 'auto' | 'inactive';

const heartbeatIntervalMs = 10000;
const heartbeatTimeoutMs = heartbeatIntervalMs * 3;
const heartbeatTimeoutCloseCode = 4000;
const recentActivityWindowMs = 5 * 60 * 1000;
const activeActivityRefreshMs = 1000;

type ActivityTracker = {
  isActive: () => boolean;
  stop: () => void;
};

export class RealtimeHeartbeat {
  private readonly acknowledgements = new WeakMap<WebSocket, number>();

  private readonly activityModes = new Map<
    string,
    RealtimeHeartbeatActivityMode
  >();

  public setActivityMode(
    session: Session,
    mode: RealtimeHeartbeatActivityMode,
  ): void {
    this.activityModes.set(session.identity.id, mode);
  }

  public acknowledge(socket: WebSocket): void {
    this.acknowledgements.set(socket, Date.now());
  }

  public start(
    socket: WebSocket,
    session: Session,
    send: (active: boolean) => void,
    logTimeout: (data: unknown) => void,
  ): () => void {
    this.acknowledge(socket);
    const activity = this.trackActivity(() => {
      send(this.isIdentityActive(session.identity.id, activity));
    });

    const timer = globalThis.setInterval(() => {
      if (
        Date.now() - this.lastAcknowledgementAt(socket) >=
        heartbeatTimeoutMs
      ) {
        logTimeout({
          intervalMs: heartbeatIntervalMs,
          timeoutMs: heartbeatTimeoutMs,
        });
        socket.close(heartbeatTimeoutCloseCode, 'Realtime heartbeat timed out');

        return;
      }

      send(this.isIdentityActive(session.identity.id, activity));
    }, heartbeatIntervalMs);

    return () => {
      activity.stop();
      globalThis.clearInterval(timer);
    };
  }

  private isIdentityActive(
    identityId: string,
    activity: ActivityTracker,
  ): boolean {
    return (
      (this.activityModes.get(identityId) ?? 'auto') === 'auto' &&
      activity.isActive()
    );
  }

  private trackActivity(onActiveAgain: () => void): ActivityTracker {
    let lastActivityAt = Date.now();
    const markActive = () => {
      const now = Date.now();
      const wasInactive =
        now - lastActivityAt > recentActivityWindowMs ||
        globalThis.document?.visibilityState === 'hidden';

      if (!wasInactive && now - lastActivityAt < activeActivityRefreshMs) {
        return;
      }

      lastActivityAt = now;

      if (wasInactive) onActiveAgain();
    };
    const movementEvent =
      'PointerEvent' in globalThis ? 'pointermove' : 'mousemove';
    const activityEvents = [
      'focus',
      'keydown',
      'mousedown',
      'pointerdown',
      'scroll',
      'touchstart',
      movementEvent,
    ];

    for (const eventName of activityEvents) {
      globalThis.addEventListener?.(eventName, markActive, {
        passive: true,
      });
    }

    return {
      isActive: () =>
        globalThis.document?.visibilityState !== 'hidden' &&
        Date.now() - lastActivityAt <= recentActivityWindowMs,
      stop: () => {
        for (const eventName of activityEvents) {
          globalThis.removeEventListener?.(eventName, markActive);
        }
      },
    };
  }

  private lastAcknowledgementAt(socket: WebSocket): number {
    return this.acknowledgements.get(socket) ?? 0;
  }
}
