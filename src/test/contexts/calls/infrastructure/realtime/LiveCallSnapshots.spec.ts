import type { RealtimeDomainEvent } from '../../../../../shared/infrastructure/realtime/RealtimeGateway';

import { LiveCallSnapshots } from '../../../../../contexts/calls/infrastructure/realtime/LiveCallSnapshots';

function event(
  revision: number,
  members = ['alice', 'bob'],
): RealtimeDomainEvent {
  return {
    aggregate_id: 'call-a',
    attributes: {
      callId: 'call-a',
      liveCall: {
        id: 'call-a',
        networkId: 'network-a',
        participantIds: members,
        participants: members.map((identityId) => ({
          connected: true,
          identityId,
          mediaConnections: [],
          status: 'joined',
        })),
        scope: {
          channelId: 'channel-a',
          communityId: 'community-a',
          type: 'community_channel',
        },
        status: 'active',
      },
      liveCallRevision: revision,
    },
    causation_id: '',
    correlation_id: '',
    event_id: String(revision),
    occurred_on: 1,
    type: 'calls.v1.participant.joined',
  };
}

describe('LiveCallSnapshots', () => {
  it('replaces membership from a minimal snapshot without inventing historical metadata', () => {
    const snapshots = new LiveCallSnapshots();
    snapshots.receive(event(1));
    const call = snapshots.receive(event(2, ['alice']));
    expect(call?.participantIds).toEqual(['alice']);
    expect(call).not.toHaveProperty('createdAt');
    expect(call).not.toHaveProperty('creatorIdentityId');
    expect(call?.participants[0]).not.toHaveProperty('joinedAt');
  });

  it('ignores duplicate and out-of-order deliveries while accepting a fresh connection counter', () => {
    const snapshots = new LiveCallSnapshots();
    snapshots.receive(event(4));
    expect(snapshots.isStale(event(4))).toBe(true);
    expect(snapshots.isStale(event(3))).toBe(true);
    expect(snapshots.isStale(event(5))).toBe(false);
    expect(snapshots.receive(event(4))).toBeUndefined();
    expect(snapshots.receive(event(3))).toBeUndefined();
    snapshots.reset();
    expect(snapshots.receive(event(1))).toBeDefined();
  });

  it('keeps a newer snapshot when a reconnect list request finishes late', () => {
    const snapshots = new LiveCallSnapshots();
    const stale = snapshots.receive(event(1));
    snapshots.receive(event(2, ['alice']));
    expect(snapshots.recover([stale!])[0].participantIds).toEqual(['alice']);
    expect(snapshots.recover([])[0].participantIds).toEqual(['alice']);
  });

  it('merges a newer WebSocket roster before applying a delayed initial list', async () => {
    const snapshots = new LiveCallSnapshots();
    const oldCall = snapshots.receive(event(1));
    snapshots.reset();
    let resolveList: (calls: NonNullable<typeof oldCall>[]) => void = () =>
      undefined;
    const pending = snapshots.load(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    snapshots.receive(event(2, ['alice']));
    resolveList([oldCall!]);
    const calls = await pending;
    expect(calls?.[0].participantIds).toEqual(['alice']);
  });

  it('lets a fresh HTTP result correct snapshots cached before the request', async () => {
    const snapshots = new LiveCallSnapshots();
    snapshots.receive(event(1, ['alice', 'bob']));
    const fresh = new LiveCallSnapshots().receive(event(2, ['alice']));
    const calls = await snapshots.load(() => Promise.resolve([fresh!]));
    expect(calls?.[0].participantIds).toEqual(['alice']);
    expect(await snapshots.load(() => Promise.resolve([]))).toEqual([]);
  });

  it('discards an initial list started before the current connection generation', async () => {
    const snapshots = new LiveCallSnapshots();
    let resolveList: (calls: never[]) => void = () => undefined;
    const pending = snapshots.load(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    snapshots.reset();
    snapshots.receive(event(1, ['alice']));
    resolveList([]);
    expect(await pending).toBeUndefined();
  });

  it('does not advance the revision for a malformed or mismatched resource', () => {
    const snapshots = new LiveCallSnapshots();
    const malformed = event(4);
    malformed.attributes.liveCall = { id: 'call-a' };
    expect(snapshots.receive(malformed)).toBeUndefined();
    const mismatched = event(4);
    mismatched.attributes.callId = 'call-b';
    expect(snapshots.receive(mismatched)).toBeUndefined();
    expect(snapshots.receive(event(3))).toBeDefined();
  });
});
