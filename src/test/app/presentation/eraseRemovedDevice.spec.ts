import { mock, type MockProxy } from 'jest-mock-extended';

import {
  eraseRemovedDevice,
  type RemovedDeviceServices,
} from '../../../app/presentation/eraseRemovedDevice';
import {
  communityUnreadStorageKey,
  draftsStorageKey,
  lastConversationStorageKey,
  workspaceStorageKey,
} from '../../../app/presentation/workspace/components/workspacePersistence';
import {
  clearLastLoginIdentity,
  loadLastLoginIdentity,
} from '../../../contexts/identities/infrastructure/storage/lastLoginIdentity';
import { clearProjectedMessageCaches } from '../../../shared/infrastructure/storage/clearProjectedMessageCaches';

jest.mock('../../../shared/infrastructure/storage/clearProjectedMessageCaches');
jest.mock(
  '../../../contexts/identities/infrastructure/storage/lastLoginIdentity',
);

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
  identities.forgetDeviceUnlock.mockResolvedValue(undefined);
  identities.forgetContacts.mockResolvedValue(undefined);
  identities.forgetContactPresence.mockResolvedValue(undefined);

  return { directMessages, groupMessages, identities, mls };
}

describe('eraseRemovedDevice', () => {
  const storage = mock<Storage>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('erases decrypted projections, drafts and workspace state, then the vault record with the identity keys', async () => {
    const removed = services();

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(true);

    expect(clearProjectedMessageCaches).toHaveBeenCalled();
    for (const key of [
      draftsStorageKey('identity-1'),
      lastConversationStorageKey('identity-1'),
      workspaceStorageKey('identity-1'),
      communityUnreadStorageKey('identity-1'),
    ]) {
      expect(storage.removeItem).toHaveBeenCalledWith(key);
    }
    expect(removed.identities.forgetDeviceUnlock).toHaveBeenCalledWith(
      'identity-1',
    );
  });

  it('keeps the vault record when another step failed, so the next unlock proves the removal again', async () => {
    const removed = services();

    removed.directMessages.forgetHistory.mockRejectedValue(
      new Error('storage'),
    );

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.identities.forgetDeviceUnlock).not.toHaveBeenCalled();
  });

  it('keeps the vault record when the decrypted projections cannot be erased', async () => {
    const removed = services();

    jest
      .mocked(clearProjectedMessageCaches)
      .mockRejectedValueOnce(new Error('indexeddb'));

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.identities.forgetDeviceUnlock).not.toHaveBeenCalled();
  });

  it('reports instead of throwing when the vault record cannot be erased', async () => {
    const removed = services();

    removed.identities.forgetDeviceUnlock.mockRejectedValue(
      new Error('storage'),
    );

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );
  });

  it("erases the identity's outbox, direct and group history, community MLS state, contact directory, contact presence and pending device-sealed recovery", async () => {
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
    expect(removed.identities.forgetContactPresence).toHaveBeenCalledWith(
      'identity-1',
    );
    expect(removed.identities.forgetContacts).toHaveBeenCalledWith(
      'identity-1',
    );
    expect(removed.identities.discardDeviceSealedRecovery).toHaveBeenCalledWith(
      'identity-1',
    );
  });

  it('keeps the vault record when the contact presence cannot be erased', async () => {
    const removed = services();

    removed.identities.forgetContactPresence.mockRejectedValue(
      new Error('storage'),
    );

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(removed.identities.forgetDeviceUnlock).not.toHaveBeenCalled();
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

  it('forgets the removed identity as the one this browser signs in to, once everything else is erased', async () => {
    jest.mocked(loadLastLoginIdentity).mockReturnValue('identity-1');

    await expect(eraseRemovedDevice('identity-1', services())).resolves.toBe(
      true,
    );

    expect(clearLastLoginIdentity).toHaveBeenCalled();
  });

  it('keeps the removed identity remembered when the erase failed, so the next sign-in proves the removal again', async () => {
    const removed = services();

    jest.mocked(loadLastLoginIdentity).mockReturnValue('identity-1');
    removed.identities.forgetDeviceUnlock.mockRejectedValue(
      new Error('storage'),
    );

    await expect(eraseRemovedDevice('identity-1', removed)).resolves.toBe(
      false,
    );

    expect(clearLastLoginIdentity).not.toHaveBeenCalled();
  });

  it('keeps another identity remembered', async () => {
    jest.mocked(loadLastLoginIdentity).mockReturnValue('identity-2');

    await expect(eraseRemovedDevice('identity-1', services())).resolves.toBe(
      true,
    );

    expect(clearLastLoginIdentity).not.toHaveBeenCalled();
  });
});
