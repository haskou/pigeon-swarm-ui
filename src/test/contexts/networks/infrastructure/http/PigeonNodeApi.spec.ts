import type { NodeRelayConfigurationResource } from '../../../../../contexts/networks/infrastructure/http/resources/NodeRelayConfigurationResource';
import type { Peer } from '../../../../../contexts/networks/presentation/view-models/Peer';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonNodeApi } from '../../../../../contexts/networks/infrastructure/http/PigeonNodeApi';

function defaultNodeRelayConfiguration(): NodeRelayConfigurationResource {
  return {
    callsRelay: {},
    manualRelayMultiaddrs: [],
    privateRelay: {
      discoveryEnabled: true,
      enabled: false,
      publicationEnabled: false,
    },
    publicNetwork: {
      enabled: false,
    },
  };
}

describe(PigeonNodeApi.name, () => {
  it('loads node info fresh because ownership changes after claiming', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'node-1',
        owner: undefined,
      })
      .mockResolvedValueOnce({
        id: 'node-1',
        owner: 'identity-1',
      });
    const api = new PigeonNodeApi(
      { request } as unknown as HttpJsonClient,
      {} as RequestSigner,
    );

    await expect(api.getInfo()).resolves.toEqual({
      id: 'node-1',
      owner: null,
    });
    await expect(api.getInfo()).resolves.toEqual({
      id: 'node-1',
      owner: 'identity-1',
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, '/node/');
    expect(request).toHaveBeenNthCalledWith(2, '/node/');
  });

  it('loads peers fresh because peer visibility changes over time', async () => {
    const peer: Peer = {
      capabilities: {
        gossipsub: true,
        privateIpfs: true,
        publicIpfs: false,
        relay: false,
      },
      connectionSummary: {
        isSharedNetworkPeer: true,
        sharedNetworkCount: 1,
      },
      id: '6e491cb3-8c70-4262-b25a-723dd8fa03cd',
      lastSeenAt: 1780944300024,
      networks: [
        {
          id: 'ee33cc83-2cf1-40c0-968c-1aae69e38ae7',
          name: 'Alpha network',
        },
      ],
      nodeType: 'unknown',
      owner: 'MCowBQYDK2VwAyEAbeVjQTYZphL/OY5i6+sXvl6h/DC0GLqa1H1hQD+ctbI=',
    };
    const request = jest
      .fn()
      .mockResolvedValueOnce({ peers: [] })
      .mockResolvedValueOnce({ peers: [peer] });
    const api = new PigeonNodeApi(
      { request } as unknown as HttpJsonClient,
      {} as RequestSigner,
    );

    await expect(api.getPeers()).resolves.toEqual([]);
    await expect(api.getPeers()).resolves.toEqual([peer]);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, '/peers/');
    expect(request).toHaveBeenNthCalledWith(2, '/peers/');
  });

  it('loads relay configuration with an owner-signed request', async () => {
    const configuration = defaultNodeRelayConfiguration();
    const request = jest.fn().mockResolvedValueOnce(configuration);
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const api = new PigeonNodeApi(
      { request } as unknown as HttpJsonClient,
      signer,
    );

    await expect(api.getRelayConfiguration(session)).resolves.toEqual(
      configuration,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/node/relay-configuration/',
      {},
    );
    expect(request).toHaveBeenCalledWith('/node/relay-configuration/', {
      headers: { 'X-Signature': 'signature' },
      method: 'GET',
    });
  });

  it('updates relay configuration with the canonical request path', async () => {
    const configuration = defaultNodeRelayConfiguration();
    configuration.callsRelay.port = 3478;
    configuration.manualRelayMultiaddrs = [
      '/dns4/relay.example.com/tcp/4100/p2p/12D3KooWRelayPeerId',
      '',
      '  /dns4/relay-backup.example.com/tcp/4100/p2p/12D3KooWBackup  ',
    ];
    configuration.privateRelay = {
      discoveryEnabled: true,
      enabled: true,
      portEnd: 4172,
      portStart: 4172,
      publicationEnabled: false,
    };
    configuration.publicHost = '  teamspeak.futoineko.com  ';
    configuration.publicNetwork = {
      enabled: true,
      port: 4011,
    };
    const expectedBody = {
      callsRelay: {
        port: 3478,
      },
      manualRelayMultiaddrs: [
        '/dns4/relay.example.com/tcp/4100/p2p/12D3KooWRelayPeerId',
        '/dns4/relay-backup.example.com/tcp/4100/p2p/12D3KooWBackup',
      ],
      privateRelay: {
        discoveryEnabled: true,
        enabled: true,
        portEnd: 4172,
        portStart: 4172,
        publicationEnabled: true,
      },
      publicHost: 'teamspeak.futoineko.com',
      publicNetwork: {
        enabled: true,
        port: 4011,
      },
    };
    const request = jest.fn().mockResolvedValueOnce(configuration);
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const api = new PigeonNodeApi(
      { request } as unknown as HttpJsonClient,
      signer,
    );

    await expect(
      api.updateRelayConfiguration(configuration, session),
    ).resolves.toEqual(configuration);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/node/relay-configuration/',
      expectedBody,
    );
    expect(request).toHaveBeenCalledWith('/node/relay-configuration/', {
      body: JSON.stringify(expectedBody),
      headers: { 'X-Signature': 'signature' },
      method: 'PUT',
    });
  });

  it('omits public network settings when no public network port is configured', async () => {
    const configuration = {
      callsRelay: {},
      manualRelayMultiaddrs: [],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        publicationEnabled: false,
      },
      publicNetwork: {
        enabled: false,
      },
    };
    const request = jest.fn().mockResolvedValueOnce(configuration);
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const api = new PigeonNodeApi(
      { request } as unknown as HttpJsonClient,
      signer,
    );
    const expectedBody = {
      callsRelay: {},
      manualRelayMultiaddrs: [],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        publicationEnabled: false,
      },
    };

    await api.updateRelayConfiguration(configuration, session);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/node/relay-configuration/',
      expectedBody,
    );
    expect(request).toHaveBeenCalledWith('/node/relay-configuration/', {
      body: JSON.stringify(expectedBody),
      headers: { 'X-Signature': 'signature' },
      method: 'PUT',
    });
  });
});
