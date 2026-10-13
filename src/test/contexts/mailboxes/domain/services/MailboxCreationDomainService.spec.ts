import { mock, type MockProxy } from 'jest-mock-extended';

import type { MailboxCreationPort } from '../../../../../contexts/mailboxes/domain/services/MailboxCreationPort';

import { MailboxCreationDifficultyError } from '../../../../../contexts/mailboxes/domain/errors/MailboxCreationDifficultyError';
import { MailboxCreationDomainService } from '../../../../../contexts/mailboxes/domain/services/MailboxCreationDomainService';

describe(MailboxCreationDomainService.name, () => {
  const defaultBits = 16;
  let port: MockProxy<MailboxCreationPort>;

  beforeEach(() => {
    port = mock<MailboxCreationPort>();
  });

  it('creates once at the default difficulty', async () => {
    port.createWithDifficulty.mockResolvedValue();

    await MailboxCreationDomainService.create(port, defaultBits);

    expect(port.createWithDifficulty.mock.calls).toEqual([[defaultBits]]);
  });

  it('creates once more at a raised difficulty the policy allows', async () => {
    port.createWithDifficulty
      .mockRejectedValueOnce(new MailboxCreationDifficultyError(20))
      .mockResolvedValueOnce();

    await MailboxCreationDomainService.create(port, defaultBits);

    expect(port.createWithDifficulty.mock.calls).toEqual([[defaultBits], [20]]);
  });

  it('rethrows a required difficulty above the ceiling', async () => {
    const refusal = new MailboxCreationDifficultyError(25);
    port.createWithDifficulty.mockRejectedValue(refusal);

    await expect(
      MailboxCreationDomainService.create(port, defaultBits),
    ).rejects.toBe(refusal);
    expect(port.createWithDifficulty).toHaveBeenCalledTimes(1);
  });

  it('rethrows a failed retry without a third attempt', async () => {
    const refusal = new MailboxCreationDifficultyError(22);
    port.createWithDifficulty
      .mockRejectedValueOnce(new MailboxCreationDifficultyError(20))
      .mockRejectedValueOnce(refusal);

    await expect(
      MailboxCreationDomainService.create(port, defaultBits),
    ).rejects.toBe(refusal);
    expect(port.createWithDifficulty).toHaveBeenCalledTimes(2);
  });

  it('rethrows other failures', async () => {
    const failure = new Error('node down');
    port.createWithDifficulty.mockRejectedValue(failure);

    await expect(
      MailboxCreationDomainService.create(port, defaultBits),
    ).rejects.toBe(failure);
    expect(port.createWithDifficulty).toHaveBeenCalledTimes(1);
  });
});
