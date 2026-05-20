export interface DomainEvent {
  readonly aggregateId: string;
  readonly occurredAt: number;
  readonly type: string;
}
