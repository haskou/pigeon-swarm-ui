import type { NetworkSynchronizationStatus } from '../../../contexts/networks/presentation/view-models/NetworkSynchronizationStatus';
import type {
  RealtimeDomainEvent,
  RealtimeTypingMessage,
} from '../../../shared/infrastructure/realtime/RealtimeGateway';

export type RealtimeHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onDomainEvent: (event: RealtimeDomainEvent) => void;
  onNetworkSynchronizationStatus?: (
    status: NetworkSynchronizationStatus,
  ) => void;
  onReconnecting?: () => void;
  onTyping?: (message: RealtimeTypingMessage) => void;
};
