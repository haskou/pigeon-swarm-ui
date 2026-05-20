import type { DomainEvent } from './DomainEvent';

export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];

    this.domainEvents.length = 0;

    return events;
  }

  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
}
