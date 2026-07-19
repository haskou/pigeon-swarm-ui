import { NetworkNodeIdRequiredError } from '../../../../../contexts/networks/domain/errors/NetworkNodeIdRequiredError';
import { NodeRelayMultiaddressRequiredError } from '../../../../../contexts/networks/domain/errors/NodeRelayMultiaddressRequiredError';
import { CallsRelayConfiguration } from '../../../../../contexts/networks/domain/value-objects/CallsRelayConfiguration';
import { NetworkNodeId } from '../../../../../contexts/networks/domain/value-objects/NetworkNodeId';
import { NodeCapabilityStatus } from '../../../../../contexts/networks/domain/value-objects/NodeCapabilityStatus';
import { NodePublicHost } from '../../../../../contexts/networks/domain/value-objects/NodePublicHost';
import { NodeRelayMultiaddress } from '../../../../../contexts/networks/domain/value-objects/NodeRelayMultiaddress';
import { PublicNetworkConfiguration } from '../../../../../contexts/networks/domain/value-objects/PublicNetworkConfiguration';

describe('node relay configuration value objects', () => {
  it('normalizes node identifiers and rejects empty ones', () => {
    expect(NetworkNodeId.fromString(' node-a ').toString()).toBe('node-a');
    expect(() => NetworkNodeId.fromString(' ')).toThrow(
      NetworkNodeIdRequiredError,
    );
  });

  it('normalizes relay multiaddresses and rejects empty ones', () => {
    expect(
      NodeRelayMultiaddress.fromString(
        ' /dns4/relay.example.com/tcp/4100 ',
      ).toString(),
    ).toBe('/dns4/relay.example.com/tcp/4100');
    expect(() => NodeRelayMultiaddress.fromString(' ')).toThrow(
      NodeRelayMultiaddressRequiredError,
    );
  });

  it('models configured and absent public hosts', () => {
    expect(
      NodePublicHost.fromOptional(' relay.example.com ').isConfigured(),
    ).toBe(true);
    expect(NodePublicHost.fromOptional().isConfigured()).toBe(false);
  });

  it('models capability state through behavior', () => {
    expect(NodeCapabilityStatus.fromBoolean(true).isEnabled()).toBe(true);
    expect(NodeCapabilityStatus.fromBoolean(false).isEnabled()).toBe(false);
  });

  it('serializes optional call and public-network ports at boundaries', () => {
    expect(
      CallsRelayConfiguration.fromPrimitives({
        port: undefined,
      }).toPrimitives(),
    ).toEqual({ port: undefined });
    expect(
      PublicNetworkConfiguration.fromPrimitives({
        enabled: true,
        port: 4011,
      }).toPrimitives(),
    ).toEqual({ enabled: true, port: 4011 });
  });
});
