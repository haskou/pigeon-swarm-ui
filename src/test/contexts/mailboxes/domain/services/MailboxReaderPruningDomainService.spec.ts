import { mock, type MockProxy } from 'jest-mock-extended';

import type { MailboxReaderSetPort } from '../../../../../contexts/mailboxes/domain/services/MailboxReaderSetPort';

import { MailboxReaderPruningDomainService } from '../../../../../contexts/mailboxes/domain/services/MailboxReaderPruningDomainService';

describe(MailboxReaderPruningDomainService.name, () => {
  let port: MockProxy<MailboxReaderSetPort>;

  beforeEach(() => {
    port = mock<MailboxReaderSetPort>();
    port.deviceReaders.mockResolvedValue(['device-a']);
    port.listedReaders.mockResolvedValue([
      'root',
      'device-a',
      'removed-1',
      'this-device',
      'removed-2',
    ]);
    port.retainedReaders.mockReturnValue(['root', 'this-device']);
    port.removeReader.mockResolvedValue();
  });

  it('removes, in order, every listed reader that is neither a device nor retained', async () => {
    await MailboxReaderPruningDomainService.prune(port);

    expect(port.removeReader.mock.calls).toEqual([
      ['removed-1'],
      ['removed-2'],
    ]);
  });

  it('reads the device readers before listing the mailbox', async () => {
    const order: string[] = [];
    port.deviceReaders.mockImplementation(() => {
      order.push('devices');

      return Promise.resolve(['device-a']);
    });
    port.listedReaders.mockImplementation(() => {
      order.push('listed');

      return Promise.resolve([]);
    });

    await MailboxReaderPruningDomainService.prune(port);

    expect(order).toEqual(['devices', 'listed']);
  });

  it('stops at the first failed removal', async () => {
    const failure = new Error('remove failed');
    port.removeReader.mockRejectedValueOnce(failure);

    await expect(MailboxReaderPruningDomainService.prune(port)).rejects.toBe(
      failure,
    );
    expect(port.removeReader).toHaveBeenCalledTimes(1);
  });

  it('removes nothing when the device list fails', async () => {
    port.deviceReaders.mockRejectedValue(new Error('credentials unreachable'));

    await expect(MailboxReaderPruningDomainService.prune(port)).rejects.toThrow(
      'credentials unreachable',
    );
    expect(port.listedReaders).not.toHaveBeenCalled();
    expect(port.removeReader).not.toHaveBeenCalled();
  });
});
