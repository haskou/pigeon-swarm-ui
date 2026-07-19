import { Timestamp } from '@haskou/value-objects';

import { NodeRelayPortRangeInvalidError } from '../../../../contexts/networks/domain/errors/NodeRelayPortRangeInvalidError';
import { NodeRelayPortRequiredError } from '../../../../contexts/networks/domain/errors/NodeRelayPortRequiredError';
import { NodeRelayConfigurationUpdated } from '../../../../contexts/networks/domain/events/NodeRelayConfigurationUpdated';
import { NodeRelayConfiguration } from '../../../../contexts/networks/domain/NodeRelayConfiguration';
import { CallsRelayConfiguration } from '../../../../contexts/networks/domain/value-objects/CallsRelayConfiguration';
import { NetworkNodeId } from '../../../../contexts/networks/domain/value-objects/NetworkNodeId';
import { NodePublicHost } from '../../../../contexts/networks/domain/value-objects/NodePublicHost';
import { NodeRelayMultiaddress } from '../../../../contexts/networks/domain/value-objects/NodeRelayMultiaddress';
import { PrivateRelayConfiguration } from '../../../../contexts/networks/domain/value-objects/PrivateRelayConfiguration';
import { PublicNetworkConfiguration } from '../../../../contexts/networks/domain/value-objects/PublicNetworkConfiguration';

describe(NodeRelayConfiguration.name, () => {
  it('creates an initial configuration and records its state transition', () => {
    const configuration = NodeRelayConfiguration.create(
      NetworkNodeId.fromString('node-a'),
      CallsRelayConfiguration.fromPrimitives({ port: undefined }),
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

    expect(configuration.toPrimitives().nodeId).toBe('node-a');
    expect(configuration.pullDomainEvents()[0]).toBeInstanceOf(
      NodeRelayConfigurationUpdated,
    );
  });

  it('hydrates and serializes the complete node relay configuration', () => {
    const primitives = {
      callsRelay: { port: 3478 },
      manualRelayMultiaddrs: ['/dns4/relay.example.com/tcp/4100'],
      nodeId: 'node-a',
      privateRelay: {
        discoveryEnabled: true,
        enabled: true,
        portEnd: 4174,
        portStart: 4172,
        publicationEnabled: true,
      },
      publicHost: 'relay.example.com',
      publicNetwork: { enabled: true, port: 4011 },
    };

    expect(
      NodeRelayConfiguration.fromPrimitives(primitives).toPrimitives(),
    ).toEqual(primitives);
  });

  it('configures the aggregate and records the state transition', () => {
    const configuration = NodeRelayConfiguration.fromPrimitives({
      callsRelay: { port: undefined },
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

    configuration.configure(
      CallsRelayConfiguration.fromPrimitives({ port: 3478 }),
      [NodeRelayMultiaddress.fromString('/dns4/relay.example.com/tcp/4100')],
      PrivateRelayConfiguration.fromPrimitives({
        discoveryEnabled: true,
        enabled: true,
        portEnd: 4173,
        portStart: 4172,
        publicationEnabled: true,
      }),
      NodePublicHost.fromOptional('relay.example.com'),
      PublicNetworkConfiguration.fromPrimitives({ enabled: true, port: 4011 }),
      new Timestamp(100),
    );

    expect(configuration.toPrimitives()).toMatchObject({
      callsRelay: { port: 3478 },
      privateRelay: { enabled: true, portEnd: 4173, portStart: 4172 },
      publicNetwork: { enabled: true, port: 4011 },
    });
    expect(configuration.pullDomainEvents()).toEqual([
      expect.objectContaining({ aggregateId: 'node-a', occurredAt: 100 }),
    ]);
    expect(configuration.pullDomainEvents()).toEqual([]);
  });

  it('rejects a private relay range whose end precedes its start', () => {
    expect(() =>
      PrivateRelayConfiguration.fromPrimitives({
        discoveryEnabled: true,
        enabled: true,
        portEnd: 4172,
        portStart: 4174,
        publicationEnabled: true,
      }),
    ).toThrow(NodeRelayPortRangeInvalidError);
  });

  it('requires a complete port range when the private relay is enabled', () => {
    expect(() =>
      PrivateRelayConfiguration.fromPrimitives({
        discoveryEnabled: true,
        enabled: true,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: true,
      }),
    ).toThrow(NodeRelayPortRequiredError);
  });

  it('records the expected domain event type', () => {
    const configuration = NodeRelayConfiguration.fromPrimitives({
      callsRelay: { port: undefined },
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

    configuration.configure(
      CallsRelayConfiguration.fromPrimitives({ port: undefined }),
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

    expect(configuration.pullDomainEvents()[0]).toBeInstanceOf(
      NodeRelayConfigurationUpdated,
    );
  });
});
