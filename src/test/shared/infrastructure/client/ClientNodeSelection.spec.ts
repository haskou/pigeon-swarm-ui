import { mock } from 'jest-mock-extended';
import { webcrypto } from 'node:crypto';

import { ClientNodeSelection } from '../../../../shared/infrastructure/client/ClientNodeSelection';

describe(ClientNodeSelection.name, () => {
  const values = new Map<string, string>();
  const storage = mock<Storage>();

  beforeEach(() => {
    values.clear();
    storage.getItem.mockImplementation((key) => values.get(key) ?? null);
    storage.setItem.mockImplementation((key, value) => {
      values.set(key, value);
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  });

  it('derives stable storage partitions from normalized node addresses', async () => {
    const selection = new ClientNodeSelection(storage);
    await selection.save('https://NODE.example:443/api/');
    const first = selection.read();
    expect(first?.url).toBe('https://node.example/api');
    expect(first?.scope).toMatch(/^[a-f0-9]{64}$/);
    await selection.save('https://other.example/api');
    expect(selection.read()?.scope).not.toBe(first?.scope);
    await selection.save('https://node.example/api');
    expect(selection.read()).toEqual(first);
  });

  it.each([
    'invalid json',
    'null',
    '{}',
    '{"url":"https://node.example","scope":"wrong"}',
  ])('ignores unusable saved selections: %s', (value) => {
    values.set('pigeon-swarm-client-node-v1', value);
    expect(new ClientNodeSelection(storage).read()).toBeUndefined();
  });

  it('keeps the selected endpoint and partition together for the document lifetime', async () => {
    jest.resetModules();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage },
    });
    const selection = new ClientNodeSelection(storage);
    await selection.save('https://first.example');
    const { clientNodeForDocument } =
      await import('../../../../shared/infrastructure/client/clientNodeForDocument');
    const first = clientNodeForDocument();
    await selection.save('https://second.example');
    expect(clientNodeForDocument()).toEqual(first);
    expect(selection.read()?.url).toBe('https://second.example');
    Reflect.deleteProperty(globalThis, 'window');
  });
});
