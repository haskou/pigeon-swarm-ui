import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from '../http/resources/CallParticipantMediaConnectionResource';

import {
  collectPeerMediaStats,
  type PeerMediaStats,
} from './collectPeerMediaStats';

export class CallPeerStatistics {
  private latest: Record<string, PeerMediaStats> = {};

  private readonly previousSamples = new Map<
    string,
    { bytesReceived: number; sampledAt: number }
  >();

  private bitrateFor(
    identityId: string,
    stats: PeerMediaStats,
  ): number | undefined {
    if (stats.bytesReceived === undefined) return undefined;

    const sampledAt = Date.now();
    const previous = this.previousSamples.get(identityId);

    this.previousSamples.set(identityId, {
      bytesReceived: stats.bytesReceived,
      sampledAt,
    });

    if (!previous) return undefined;

    const elapsedSeconds = (sampledAt - previous.sampledAt) / 1_000;
    const bytesDelta = stats.bytesReceived - previous.bytesReceived;

    if (elapsedSeconds <= 0 || bytesDelta < 0) return undefined;

    return Math.round((bytesDelta * 8) / elapsedSeconds / 1_000);
  }

  public async collect(
    peers: ReadonlyMap<string, RTCPeerConnection>,
  ): Promise<Record<string, PeerMediaStats>> {
    const entries = await Promise.all(
      [...peers.entries()].map(
        async ([identityId, peer]): Promise<[string, PeerMediaStats]> => {
          const stats = await collectPeerMediaStats(peer);

          return [identityId, this.record(identityId, stats)];
        },
      ),
    );

    this.latest = Object.fromEntries(entries);

    return this.latest;
  }

  public connections(): CallParticipantMediaConnection[] {
    return Object.entries(this.latest)
      .slice(0, 32)
      .map(([remoteIdentityId, stats]) => ({
        ...(stats.localCandidateType
          ? { localCandidateType: stats.localCandidateType }
          : {}),
        ...(stats.protocol ? { protocol: stats.protocol } : {}),
        ...(stats.relayProtocol ? { relayProtocol: stats.relayProtocol } : {}),
        ...(stats.relayUrl ? { relayUrl: stats.relayUrl } : {}),
        ...(stats.remoteCandidateType
          ? { remoteCandidateType: stats.remoteCandidateType }
          : {}),
        remoteIdentityId,
        state: stats.connectionState,
        usesRelay:
          stats.connectionPath === 'relay' ||
          stats.localCandidateType === 'relay' ||
          stats.remoteCandidateType === 'relay',
      }));
  }

  public record(identityId: string, stats: PeerMediaStats): PeerMediaStats {
    const bitrateKbps = this.bitrateFor(identityId, stats);
    const recorded =
      bitrateKbps === undefined ? stats : { ...stats, bitrateKbps };

    this.latest = { ...this.latest, [identityId]: recorded };

    return recorded;
  }

  public reset(): void {
    this.latest = {};
    this.previousSamples.clear();
  }
}
