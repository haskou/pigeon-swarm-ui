import {
  hasRemoteAccessConfiguration,
  needsPublicHost,
} from '../../../../../contexts/networks/presentation/components/relay/nodeRelayConfigurationState';
import { defaultRelayConfiguration } from '../../../../../contexts/networks/presentation/view-models/defaultRelayConfiguration';

describe('node relay configuration state', () => {
  it('does not enable remote access for the default configuration', () => {
    const configuration = defaultRelayConfiguration();

    expect(hasRemoteAccessConfiguration(configuration)).toBe(false);
    expect(needsPublicHost(configuration)).toBe(false);
  });

  it.each([
    { callsRelay: { port: 3478 } },
    { privateRelay: { enabled: true } },
    { publicNetwork: { enabled: true } },
  ])('requires a public host for enabled remote access', (override) => {
    const defaults = defaultRelayConfiguration();
    const configuration = {
      ...defaults,
      ...override,
      privateRelay: {
        ...defaults.privateRelay,
        ...override.privateRelay,
      },
      publicNetwork: {
        ...defaults.publicNetwork,
        ...override.publicNetwork,
      },
    };

    expect(hasRemoteAccessConfiguration(configuration)).toBe(true);
    expect(needsPublicHost(configuration)).toBe(true);
  });

  it('accepts remote access when a public host is configured', () => {
    const configuration = {
      ...defaultRelayConfiguration(),
      callsRelay: { port: 3478 },
      publicHost: 'relay.example.com',
    };

    expect(hasRemoteAccessConfiguration(configuration)).toBe(true);
    expect(needsPublicHost(configuration)).toBe(false);
  });
});
