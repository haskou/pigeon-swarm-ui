import { mock, type MockProxy } from 'jest-mock-extended';

import {
  eraseRemovedDevice,
  type RemovedDeviceServices,
} from '../../../app/presentation/eraseRemovedDevice';

function services(): {
  directMessages: MockProxy<RemovedDeviceServices['directMessages']>;
  groupMessages: MockProxy<RemovedDeviceServices['groupMessages']>;
  identities: MockProxy<RemovedDeviceServices['identities']>;
  mls: MockProxy<RemovedDeviceServices['mls']>;
} {
  const directMessages = mock<RemovedDeviceServices['directMessages']>();
  const groupMessages = mock<RemovedDeviceServices['groupMessages']>();
  const identities = mock<RemovedDeviceServices['identities']>();
  const mls = mock<RemovedDeviceServices['mls']>();

  directMessages.cancelOutbox.mockResolvedValue(undefined);
  directMessages.forgetHistory.mockResolvedValue(undefined);
  groupMessages.forget.mockResolvedValue(undefined);
  mls.forget.mockResolvedValue(undefined);

  return { directMessages, groupMessages, identities, mls };
}

describe('eraseRemovedDevice', () => {
  it("erases the identity's outbox, direct and group history, community MLS state and pending device-sealed recovery", async () => {
    const removed = services();

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(true);

    expect(removed.directMessages.cancelOutbox).toHaveBeenCalledWith(
      'identity-1',
    );
    expect(removed.directMessages.forgetHistory).toHaveBeenCalledWith(
      'identity-1',
    );
    expect(removed.groupMessages.forget).toHaveBeenCalledWith('identity-1');
    expect(removed.mls.forget).toHaveBeenCalledWith('identity-1');
    expect(removed.identities.discardDeviceSealedRecovery).toHaveBeenCalledWith(
      'identity-1',
    );
  });

  it('still erases the rest and reports it when the outbox cannot be erased', async () => {
    const removed = services();

    removed.directMessages.cancelOutbox.mockRejectedValue(new Error('storage'));

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.directMessages.forgetHistory).toHaveBeenCalledWith(
      'identity-1',
    );
    expect(removed.identities.discardDeviceSealedRecovery).toHaveBeenCalledWith(
      'identity-1',
    );
  });

  it('reports it when the pending device-sealed recovery cannot be erased', async () => {
    const removed = services();

    removed.identities.discardDeviceSealedRecovery.mockImplementation(() => {
      throw new Error('storage');
    });

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.directMessages.cancelOutbox).toHaveBeenCalledWith(
      'identity-1',
    );
    expect(removed.directMessages.forgetHistory).toHaveBeenCalledWith(
      'identity-1',
    );
  });

  it('still erases the rest and reports it when group state cannot be erased', async () => {
    const removed = services();

    removed.groupMessages.forget.mockRejectedValue(new Error('storage'));

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.identities.discardDeviceSealedRecovery).toHaveBeenCalledWith(
      'identity-1',
    );
  });

  it('still erases the rest and reports it when community MLS state cannot be erased', async () => {
    const removed = services();

    removed.mls.forget.mockRejectedValue(new Error('storage'));

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.groupMessages.forget).toHaveBeenCalledWith('identity-1');
    expect(removed.identities.discardDeviceSealedRecovery).toHaveBeenCalledWith(
      'identity-1',
    );
  });
});
