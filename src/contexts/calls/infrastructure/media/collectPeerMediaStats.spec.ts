import { collectPeerMediaStats } from './collectPeerMediaStats';

function statsReport(entries: RTCStats[]): RTCStatsReport {
  return new Map(entries.map((entry) => [entry.id, entry])) as RTCStatsReport;
}

function peerWithStats(
  entries: RTCStats[],
  connectionState: RTCPeerConnectionState = 'connected',
  iceConnectionState: RTCIceConnectionState = 'connected',
): RTCPeerConnection {
  return {
    connectionState,
    getStats: jest.fn(() => Promise.resolve(statsReport(entries))),
    iceConnectionState,
  } as unknown as RTCPeerConnection;
}

describe(collectPeerMediaStats.name, () => {
  it('collects audio level, packet loss, latency, and speaking state', async () => {
    const stats = await collectPeerMediaStats(
      peerWithStats([
        {
          audioLevel: 0.08,
          id: 'audio',
          kind: 'audio',
          packetsLost: 3,
          timestamp: 1,
          type: 'inbound-rtp',
        } as RTCStats,
        {
          currentRoundTripTime: 0.123,
          id: 'candidate',
          state: 'succeeded',
          timestamp: 1,
          type: 'candidate-pair',
        } as RTCStats,
      ]),
    );

    expect(stats).toEqual({
      audioLevel: 0.08,
      connectionPath: 'unknown',
      connectionState: 'connected',
      iceState: 'connected',
      latencyMs: 123,
      packetsLost: 3,
      speaking: true,
    });
  });

  it('ignores non-audio and non-succeeded candidate stats', async () => {
    const stats = await collectPeerMediaStats(
      peerWithStats(
        [
          {
            audioLevel: 0.5,
            id: 'video',
            kind: 'video',
            timestamp: 1,
            type: 'inbound-rtp',
          } as RTCStats,
          {
            currentRoundTripTime: 0.25,
            id: 'candidate',
            state: 'in-progress',
            timestamp: 1,
            type: 'candidate-pair',
          } as RTCStats,
        ],
        'failed',
      ),
    );

    expect(stats).toEqual({
      connectionState: 'failed',
      iceState: 'connected',
      speaking: false,
    });
  });
});
