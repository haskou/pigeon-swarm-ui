import { Timestamp } from '@haskou/value-objects';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { PigeonNodeApi } from '../../../../../../contexts/networks/infrastructure/http/PigeonNodeApi';
import type { Session } from '../../../../../../shared/domain/pigeonResources.types';

import { IdentityAccessContexts } from '../../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { NodeRelayConfiguration } from '../../../../../../contexts/networks/domain/NodeRelayConfiguration';
import { CallsRelayConfiguration } from '../../../../../../contexts/networks/domain/value-objects/CallsRelayConfiguration';
import { NetworkActorId } from '../../../../../../contexts/networks/domain/value-objects/NetworkActorId';
import { NodePublicHost } from '../../../../../../contexts/networks/domain/value-objects/NodePublicHost';
import { PrivateRelayConfiguration } from '../../../../../../contexts/networks/domain/value-objects/PrivateRelayConfiguration';
import { PublicNetworkConfiguration } from '../../../../../../contexts/networks/domain/value-objects/PublicNetworkConfiguration';
import { NodeRelayConfigurationMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NodeRelayConfigurationMapper';
import { PigeonNodeRelayConfigurationRepository } from '../../../../../../contexts/networks/infrastructure/http/repositories/PigeonNodeRelayConfigurationRepository';

describe(PigeonNodeRelayConfigurationRepository.name, () => {
  let node: MockProxy<PigeonNodeApi>;
  let identities: IdentityAccessContexts;
  let repository: PigeonNodeRelayConfigurationRepository;

  beforeEach(() => {
    node = mock<PigeonNodeApi>();
    identities = new IdentityAccessContexts();
    repository = new PigeonNodeRelayConfigurationRepository(
      node,
      identities,
      new NodeRelayConfigurationMapper(),
    );
  });

  it('loads and maps the configuration of the local node', async () => {
    node.getInfo.mockResolvedValue({ id: 'node-a', owner: null });
    node.getRelayConfiguration.mockResolvedValue({
      callsRelay: {},
      manualRelayMultiaddrs: [],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        publicationEnabled: false,
      },
      publicNetwork: { enabled: false },
    });

    const configuration = await repository.find(NetworkActorId.anonymous());

    expect(configuration.toPrimitives().nodeId).toBe('node-a');
    expect(node.getRelayConfiguration).toHaveBeenCalledWith(undefined);
  });

  it('uses the actor session, persists the aggregate, and consumes its events', async () => {
    const session = { identity: { id: 'identity-a' } } as unknown as Session;
    identities.register(session);
    const configuration = NodeRelayConfiguration.fromPrimitives({
      callsRelay: { port: 3478 },
      manualRelayMultiaddrs: [],
      nodeId: 'node-a',
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
      },
      publicHost: undefined,
      publicNetwork: { enabled: false, port: undefined },
    });
    node.updateRelayConfiguration.mockImplementation((resource) =>
      Promise.resolve(resource),
    );
    configuration.configure(
      CallsRelayConfiguration.fromPrimitives({ port: 3478 }),
      [],
      PrivateRelayConfiguration.fromPrimitives({
        discoveryEnabled: true,
        enabled: false,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
      }),
      NodePublicHost.fromOptional(),
      PublicNetworkConfiguration.fromPrimitives({
        enabled: false,
        port: undefined,
      }),
      new Timestamp(100),
    );

    expect(configuration.pullDomainEvents()).toHaveLength(1);
    configuration.configure(
      CallsRelayConfiguration.fromPrimitives({ port: 3478 }),
      [],
      PrivateRelayConfiguration.fromPrimitives({
        discoveryEnabled: true,
        enabled: false,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
      }),
      NodePublicHost.fromOptional(),
      PublicNetworkConfiguration.fromPrimitives({
        enabled: false,
        port: undefined,
      }),
      new Timestamp(200),
    );

    const saved = await repository.save(
      configuration,
      NetworkActorId.fromOptional('identity-a'),
    );

    expect(node.updateRelayConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ callsRelay: { port: 3478 } }),
      session,
    );
    expect(saved.toPrimitives().nodeId).toBe('node-a');
    expect(configuration.pullDomainEvents()).toEqual([]);
  });
});
