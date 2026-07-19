import { CallPeerStatistics } from '../../../../../contexts/calls/infrastructure/media/CallPeerStatistics';

describe('CallPeerStatistics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calculates bitrate between consecutive samples', () => {
    const statistics = new CallPeerStatistics();

    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_000);

    expect(
      statistics.record('peer-1', {
        bytesReceived: 1_000,
        connectionState: 'connected',
        iceState: 'connected',
        speaking: false,
      }),
    ).not.toHaveProperty('bitrateKbps');
    expect(
      statistics.record('peer-1', {
        bytesReceived: 126_000,
        connectionState: 'connected',
        iceState: 'connected',
        speaking: false,
      }),
    ).toMatchObject({ bitrateKbps: 1_000 });
  });

  it('projects relay metadata into heartbeat media connections', () => {
    const statistics = new CallPeerStatistics();

    statistics.record('peer-1', {
      connectionPath: 'relay',
      connectionState: 'connected',
      iceState: 'connected',
      localCandidateType: 'relay',
      protocol: 'udp',
      speaking: false,
    });

    expect(statistics.connections()).toEqual([
      {
        localCandidateType: 'relay',
        protocol: 'udp',
        remoteIdentityId: 'peer-1',
        state: 'connected',
        usesRelay: true,
      },
    ]);
  });
});
