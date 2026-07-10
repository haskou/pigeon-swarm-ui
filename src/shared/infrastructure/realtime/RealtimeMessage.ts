import type { NetworkSynchronizationStatus } from '../../../contexts/networks/application/find-network-synchronization/NetworkSynchronizationStatus';
import type { RealtimeDomainEvent } from './RealtimeDomainEvent';
import type { RealtimeTypingMessage } from './RealtimeTypingMessage';

export type RealtimeMessage =
  | {
      identityId: string;
      type: 'connection_ack';
    }
  | {
      identityId: string;
      timestamp: number;
      type: 'heartbeat_ack';
    }
  | {
      event: RealtimeDomainEvent;
      type: 'domain_event';
    }
  | {
      status: NetworkSynchronizationStatus;
      type: 'network_synchronization_status';
    }
  | RealtimeTypingMessage;
