import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

export type CallParticipantJoined = DomainEvent & {
  type: 'CallParticipantJoined';
};
