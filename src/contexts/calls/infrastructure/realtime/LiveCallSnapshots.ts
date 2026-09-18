import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { CallResource } from '../http/resources/CallResource';

import { Call } from '../../domain/Call';

export class LiveCallSnapshots {
  private generation = 0;
  private readonly revisions = new Map<string, number>();

  private readonly resources = new Map<string, CallResource>();

  public version(callId: string): number | undefined {
    return this.revisions.get(callId);
  }

  public isStale(event: RealtimeDomainEvent): boolean {
    const callId = event.attributes.callId;
    const revision = event.attributes.liveCallRevision;

    return (
      typeof callId === 'string' &&
      typeof revision === 'number' &&
      Number.isSafeInteger(revision) &&
      revision <= (this.revisions.get(callId) ?? -1)
    );
  }

  public reset(): void {
    this.generation += 1;
    this.revisions.clear();
    this.resources.clear();
  }

  public async load(
    load: () => Promise<CallResource[]>,
  ): Promise<CallResource[] | undefined> {
    const generation = this.generation;
    const initialResources = new Map(this.resources);
    const calls = await load();

    if (generation !== this.generation) return undefined;

    const changedResources = [...this.resources.values()].filter(
      (call) => initialResources.get(call.id) !== call,
    );
    const changedIds = new Set(changedResources.map((call) => call.id));

    return [
      ...calls.filter((call) => !changedIds.has(call.id)),
      ...changedResources,
    ];
  }

  public remember(call: CallResource): void {
    this.resources.set(call.id, call);
  }

  public recover(resources: CallResource[]): CallResource[] {
    return [
      ...resources.filter((call) => !this.resources.has(call.id)),
      ...this.resources.values(),
    ];
  }

  public receive(event: RealtimeDomainEvent): CallResource | undefined {
    const resource = event.attributes.liveCall as CallResource | undefined;
    const revision = event.attributes.liveCallRevision;

    if (
      !resource ||
      typeof revision !== 'number' ||
      !Number.isSafeInteger(revision)
    )
      return undefined;

    if (resource.id !== event.attributes.callId) return undefined;

    if (revision <= (this.revisions.get(resource.id) ?? -1)) return undefined;
    try {
      const call = Call.fromPrimitives(resource).toPrimitives();
      this.revisions.set(call.id, revision);
      this.resources.set(call.id, call);

      return call;
    } catch {
      return undefined;
    }
  }
}
