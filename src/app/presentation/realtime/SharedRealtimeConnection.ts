import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
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
