import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

export type CallEnded = DomainEvent & { type: 'CallEnded' };
