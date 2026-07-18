import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { NodeInfo } from './NodeInfo';
import type { NodePeersSnapshot } from './NodePeersSnapshot';
import type { IpfsReplicationStatusResource } from './resources/IpfsReplicationStatusResource';
import type { NetworkPeerResource } from './resources/NetworkPeerResource';
import type { NetworkResource } from './resources/NetworkResource';
import type { NodeRelayConfigurationResource } from './resources/NodeRelayConfigurationResource';

export class PigeonNodeApi {
  private readonly requestCache = new Map<string, Promise<unknown>>();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  private async cachedRequest<T>(
    key: string,
    requestFactory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.requestCache.get(key) as Promise<T> | undefined;

    if (cached) return await cached;

    const request = requestFactory().catch((caught: unknown) => {
      this.requestCache.delete(key);

      throw caught;
    });

    this.requestCache.set(key, request);

    return await request;
  }

  private invalidateNetworksCache(): void {
    for (const key of this.requestCache.keys()) {
      if (key.startsWith('GET /node/networks/')) this.requestCache.delete(key);
    }
  }

  private relayConfigurationPayload(
    configuration: NodeRelayConfigurationResource,
  ) {
    const publicHost = configuration.publicHost?.trim();
    const privateRelayEnabled = configuration.privateRelay.enabled;
    const publicNetworkPort = configuration.publicNetwork.port;

    return {
      callsRelay: {
        port: configuration.callsRelay.port,
      },
      manualRelayMultiaddrs: configuration.manualRelayMultiaddrs
        .map((value) => value.trim())
        .filter(Boolean),
      privateRelay: {
        discoveryEnabled: configuration.privateRelay.discoveryEnabled,
        enabled: privateRelayEnabled,
        portEnd: privateRelayEnabled
          ? configuration.privateRelay.portEnd
          : undefined,
        portStart: privateRelayEnabled
          ? configuration.privateRelay.portStart
          : undefined,
        publicationEnabled: privateRelayEnabled,
      },
      publicHost: publicHost ? publicHost : undefined,
      ...(publicNetworkPort === undefined
        ? {}
        : {
            publicNetwork: {
              enabled: true,
              port: publicNetworkPort,
            },
          }),
    };
  }

  public async getInfo(): Promise<NodeInfo & { owner: string | null }> {
    const info = await this.http.request<NodeInfo>('/node/');

    return { ...info, owner: info.owner ?? null };
  }

  public async claim(session: Session): Promise<void> {
    const path = '/node/owner';
    const body = { identityId: session.identity.id };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }

  public async getNetworks(session?: Session): Promise<NetworkResource[]> {
    const path = '/node/networks/';
    const result = await this.cachedRequest(
      `GET ${path} ${session?.identity.id ?? 'anonymous'}`,
      async () =>
        await this.http.request<{
          networks: NetworkResource[];
        }>(path, {
          headers: session
            ? await this.signer.headers(session, 'GET', path)
            : undefined,
          method: 'GET',
        }),
    );

    return result.networks;
  }

  public async getPeers(): Promise<NetworkPeerResource[]> {
    return (await this.getPeerSnapshot()).peers;
  }

  public async getPeerSnapshot(): Promise<NodePeersSnapshot> {
    const result =
      await this.http.request<Partial<NodePeersSnapshot>>('/peers/');

    return {
      ipfsPeers: result.ipfsPeers ?? [],
      networkSynchronization: result.networkSynchronization ?? null,
      peers: result.peers ?? [],
    };
  }

  public async createNetwork(
    network: NetworkResource,
    session?: Session,
  ): Promise<void> {
    const path = '/node/networks/';
    const body = network;

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: session
        ? await this.signer.headers(session, 'POST', path, body)
        : undefined,
      method: 'POST',
    });
    this.invalidateNetworksCache();
  }

  public async createPublicNetwork(session?: Session): Promise<void> {
    const path = '/node/networks/public/';

    await this.http.request(path, {
      headers: session
        ? await this.signer.headers(session, 'POST', path)
        : undefined,
      method: 'POST',
    });
    this.invalidateNetworksCache();
  }

  public async removeNetwork(
    networkId: string,
    session?: Session,
  ): Promise<NetworkResource[]> {
    const path = `/node/networks/${encodeURIComponent(networkId)}/`;
    const body = {};
    const result = await this.http.request<{ networks: NetworkResource[] }>(
      path,
      {
        headers: session
          ? await this.signer.headers(session, 'DELETE', path, body)
          : undefined,
        method: 'DELETE',
      },
    );

    this.invalidateNetworksCache();

    return result.networks;
  }

  public async getIpfsReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatusResource> {
    const path = '/ipfs/replication/status';
    const body = {};

    return await this.http.request<IpfsReplicationStatusResource>(path, {
      headers: await this.signer.headers(session, 'GET', path, body),
      method: 'GET',
    });
  }

  public async getRelayConfiguration(
    session?: Session,
  ): Promise<NodeRelayConfigurationResource> {
    const path = '/node/relay-configuration/';
    const body = {};

    return await this.http.request<NodeRelayConfigurationResource>(path, {
      headers: session
        ? await this.signer.headers(session, 'GET', path, body)
        : undefined,
      method: 'GET',
    });
  }

  public async updateRelayConfiguration(
    configuration: NodeRelayConfigurationResource,
    session?: Session,
  ): Promise<NodeRelayConfigurationResource> {
    const path = '/node/relay-configuration/';
    const body = this.relayConfigurationPayload(configuration);

    return await this.http.request<NodeRelayConfigurationResource>(path, {
      body: JSON.stringify(body),
      headers: session
        ? await this.signer.headers(session, 'PUT', path, body)
        : undefined,
      method: 'PUT',
    });
  }
}
