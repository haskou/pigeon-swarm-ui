import type { NetworkSynchronizationResource } from '../../../contexts/networks/infrastructure/http/resources/NetworkSynchronizationResource';
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
      cursor: number;
      mailboxId: string;
      type: 'mailbox_envelope';
    }
  | {
      status: NetworkSynchronizationResource;
      type: 'network_synchronization_status';
    }
  | RealtimeTypingMessage;
