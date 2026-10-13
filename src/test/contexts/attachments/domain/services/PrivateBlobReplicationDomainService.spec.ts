import { mock, type MockProxy } from 'jest-mock-extended';

import type { PrivateBlobPartStorePort } from '../../../../../contexts/attachments/domain/services/PrivateBlobPartStorePort';

import { PrivateBlobUploadIncompleteError } from '../../../../../contexts/attachments/domain/errors/PrivateBlobUploadIncompleteError';
import { PrivateBlobReplicationDomainService } from '../../../../../contexts/attachments/domain/services/PrivateBlobReplicationDomainService';

describe(PrivateBlobReplicationDomainService.name, () => {
  let port: MockProxy<PrivateBlobPartStorePort<string>>;

  beforeEach(() => {
    port = mock<PrivateBlobPartStorePort<string>>();
    port.abandon.mockResolvedValue();
  });

  it('resolves with every part replicas when each part is stored', async () => {
    port.storePart.mockImplementation((index) =>
      Promise.resolve([`part-${index}-a`, `part-${index}-b`]),
    );

    await expect(
      PrivateBlobReplicationDomainService.storeParts(port, 2),
    ).resolves.toEqual([
      ['part-0-a', 'part-0-b'],
      ['part-1-a', 'part-1-b'],
    ]);
    expect(port.storePart.mock.calls).toEqual([[0], [1]]);
    expect(port.abandon).not.toHaveBeenCalled();
  });

  it('abandons the stored replicas when any part has none', async () => {
    port.storePart.mockImplementation((index) =>
      Promise.resolve(index === 1 ? [] : [`part-${index}`]),
    );

    await expect(
      PrivateBlobReplicationDomainService.storeParts(port, 3),
    ).rejects.toBeInstanceOf(PrivateBlobUploadIncompleteError);
    expect(port.abandon).toHaveBeenCalledWith(['part-0', 'part-2']);
  });

  it('stores parts in parallel', async () => {
    let started = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    port.storePart.mockImplementation(async (index) => {
      started += 1;
      await gate;

      return [`part-${index}`];
    });

    const stored = PrivateBlobReplicationDomainService.storeParts(port, 2);

    expect(started).toBe(2);
    release();
    await expect(stored).resolves.toEqual([['part-0'], ['part-1']]);
  });
});
