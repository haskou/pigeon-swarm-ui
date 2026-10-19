import type { NetworkResource } from '../../../../../contexts/networks/infrastructure/http/resources/NetworkResource';

import { nodeBootstrapApi } from '../../../../../app/composition/nodeBootstrapApi';
import { useNodeNetworks } from '../../../../../contexts/networks/presentation/hooks/useNodeNetworks';

const mockCells: { value: unknown }[] = [];
const mockRender = { cellIndex: 0 };

jest.mock('react', () => ({
  useCallback: <T>(callback: T): T => callback,
  useEffect: (): void => undefined,
  useState: (initial: unknown) => {
    const index = mockRender.cellIndex;

    mockRender.cellIndex += 1;

    const cell = mockCells[index] ?? { value: initial };

    mockCells[index] = cell;

    const setValue = (update: unknown) => {
      cell.value =
        typeof update === 'function'
          ? (update as (current: unknown) => unknown)(cell.value)
          : update;
    };

    return [cell.value, setValue];
  },
}));
jest.mock('../../../../../app/composition/loadApplicationContainer', () => ({
  loadApplicationContainer: jest.fn(),
}));
jest.mock('../../../../../app/composition/nodeBootstrapApi', () => ({
  nodeBootstrapApi: { getInfo: jest.fn(), getNetworks: jest.fn() },
}));

const nodeApi = jest.mocked(nodeBootstrapApi);
const privateNetworks: NetworkResource[] = [
  { id: 'network-a', name: 'Team', privateNetwork: true },
];

function render() {
  mockRender.cellIndex = 0;

  return useNodeNetworks();
}

describe(useNodeNetworks.name, () => {
  beforeEach(() => {
    mockCells.length = 0;
    nodeApi.getInfo.mockResolvedValue({ id: 'node-a', owner: null });
    nodeApi.getNetworks.mockResolvedValue(privateNetworks);
  });

  it('clears the networks loaded earlier when the node info cannot be read', async () => {
    await render().reload();

    const loaded = render();

    expect(loaded.networksError).toBe(false);
    expect(loaded.networks.map((network) => network.id)).toEqual(['network-a']);

    nodeApi.getInfo.mockRejectedValue(new Error('node unreachable'));

    await render().reload();

    const failed = render();

    expect(failed.networks).toEqual([]);
    expect(failed.networksError).toBe(true);
  });

  it('reports the network list as failed when the node info cannot be read on first load', async () => {
    nodeApi.getInfo.mockRejectedValue(new Error('node unreachable'));

    await render().reload();

    expect(render()).toMatchObject({ networks: [], networksError: true });
  });
});
