import type { Session } from '../../../shared/domain/pigeonResources.types';
import type { RealtimeSubscription } from './RealtimeSubscription';

export type SharedRealtimeConnection = {
  attempt: number;
  closeTimer?: number;
  connect: () => Promise<void>;
  connectPromise: Promise<void> | null;
  reconnectTimer?: number;
  session: Session;
  socket: WebSocket | null;
  subscribers: Set<RealtimeSubscription>;
};
