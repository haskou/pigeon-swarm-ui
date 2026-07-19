import { SharedNetworkSelectorDomainService } from '../../../../../contexts/networks/domain/services/SharedNetworkSelectorDomainService';
import { NetworkId } from '../../../../../contexts/networks/domain/value-objects/NetworkId';

describe(SharedNetworkSelectorDomainService.name, () => {
  const selector = new SharedNetworkSelectorDomainService();
  const network = (id: string): NetworkId => NetworkId.fromString(id);

  it('keeps a preferred network shared by both participants', () => {
    const preferred = network('network-b');

    expect(
      selector.select(
        [network('network-a'), preferred],
        [preferred],
        preferred,
      ),
    ).toBe(preferred);
  });

  it('selects the first shared peer network when the preference is unusable', () => {
    const shared = network('network-b');

    expect(
      selector.select(
        [network('network-a'), shared],
        [network('network-c'), shared],
        network('network-d'),
      ),
    ).toBe(shared);
  });

  it('accepts a preferred own network when peer networks are unknown', () => {
    const preferred = network('network-a');

    expect(selector.select([preferred], [], preferred)).toBe(preferred);
  });

  it('reports absence when participants share no network', () => {
    expect(
      selector
        .select(
          [network('network-a')],
          [network('network-b')],
          NetworkId.fromOptional(),
        )
        .isAvailable(),
    ).toBe(false);
  });
});
