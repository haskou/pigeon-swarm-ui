import { type MockProxy, mock } from 'jest-mock-extended';

import type { DeviceMailboxRepository } from '../../../../../contexts/identities/domain/repositories/DeviceMailboxRepository';
import type { IdentityUnlockRepository } from '../../../../../contexts/identities/domain/repositories/IdentityUnlockRepository';
import type { OwnDeviceRepository } from '../../../../../contexts/identities/domain/repositories/OwnDeviceRepository';

import { CurrentDeviceForgetter } from '../../../../../contexts/identities/application/forget-current-device/CurrentDeviceForgetter';
import { ForgetCurrentDeviceMessage } from '../../../../../contexts/identities/application/forget-current-device/messages/ForgetCurrentDeviceMessage';
import { DeviceRetirement } from '../../../../../contexts/identities/domain/value-objects/DeviceRetirement';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

const identityId = IdentityId.fromString('identity-1');

function forgetter({
  retirement,
  unlockFails = false,
}: {
  retirement: () => Promise<DeviceRetirement>;
  unlockFails?: boolean;
}): {
  calls: string[];
  mailbox: MockProxy<DeviceMailboxRepository>;
  useCase: CurrentDeviceForgetter;
} {
  const calls: string[] = [];
  const ownDevices = mock<OwnDeviceRepository>();
  const mailbox = mock<DeviceMailboxRepository>();
  const unlocks = mock<IdentityUnlockRepository>();

  ownDevices.retire.mockImplementation(() => {
    calls.push('retire');

    return retirement();
  });
  mailbox.releaseReaders.mockImplementation(() => {
    calls.push('release');

    return Promise.resolve();
  });
  mailbox.forgetHistory.mockImplementation(() => {
    calls.push('history');

    return Promise.resolve();
  });
  mailbox.forgetGroups.mockImplementation(() => {
    calls.push('groups');

    return Promise.resolve();
  });
  mailbox.cancelOutbox.mockImplementation(() => {
    calls.push('outbox');

    return Promise.resolve();
  });
  unlocks.forget.mockImplementation((id) => {
    calls.push(`unlock:${id.toString()}`);

    return unlockFails
      ? Promise.reject(new Error('storage'))
      : Promise.resolve();
  });

  return {
    calls,
    mailbox,
    useCase: new CurrentDeviceForgetter(ownDevices, mailbox, unlocks),
  };
}

function message(allowOnlyDevice: boolean): ForgetCurrentDeviceMessage {
  return new ForgetCurrentDeviceMessage('identity-1', allowOnlyDevice);
}

describe(CurrentDeviceForgetter.name, () => {
  it('revokes this device, releases its readers, wipes local direct and group state, then forgets the local unlock', async () => {
    const { calls, mailbox, useCase } = forgetter({
      retirement: () => Promise.resolve(DeviceRetirement.REVOKED),
    });

    await expect(useCase.forget(message(false))).resolves.toBe('forgotten');
    expect(calls).toEqual([
      'retire',
      'release',
      'history',
      'groups',
      'outbox',
      'unlock:identity-1',
    ]);
    expect(mailbox.releaseReaders).toHaveBeenCalledWith(identityId);
    expect(mailbox.forgetHistory).toHaveBeenCalledWith(identityId);
    expect(mailbox.forgetGroups).toHaveBeenCalledWith(identityId);
    expect(mailbox.cancelOutbox).toHaveBeenCalledWith(identityId);
  });

  it('treats a device that is already revoked as forgotten', async () => {
    const { calls, useCase } = forgetter({
      retirement: () => Promise.resolve(DeviceRetirement.ALREADY_REVOKED),
    });

    await expect(useCase.forget(message(false))).resolves.toBe('forgotten');
    expect(calls).toEqual([
      'retire',
      'release',
      'history',
      'groups',
      'outbox',
      'unlock:identity-1',
    ]);
  });

  it('keeps the device signed in, its direct state and the local unlock when revocation fails', async () => {
    const { calls, useCase } = forgetter({
      retirement: () => Promise.reject(new Error('503')),
    });

    await expect(useCase.forget(message(false))).resolves.toBe('revoke-failed');
    expect(calls).toEqual(['retire']);
  });

  it('changes nothing for the only device until the user confirms', async () => {
    const { calls, useCase } = forgetter({
      retirement: () => Promise.resolve(DeviceRetirement.LAST_DEVICE),
    });

    await expect(useCase.forget(message(false))).resolves.toBe('only-device');
    expect(calls).toEqual(['retire']);
  });

  it('keeps the readers of the only device and wipes its local state once confirmed', async () => {
    const { calls, useCase } = forgetter({
      retirement: () => Promise.resolve(DeviceRetirement.LAST_DEVICE),
    });

    await expect(useCase.forget(message(true))).resolves.toBe('forgotten');
    expect(calls).toEqual([
      'retire',
      'history',
      'groups',
      'outbox',
      'unlock:identity-1',
    ]);
  });

  it('wipes local direct state and reports a failed local unlock removal after the device is revoked', async () => {
    const { calls, useCase } = forgetter({
      retirement: () => Promise.resolve(DeviceRetirement.REVOKED),
      unlockFails: true,
    });

    await expect(useCase.forget(message(false))).resolves.toBe('unlock-failed');
    expect(calls).toEqual([
      'retire',
      'release',
      'history',
      'groups',
      'outbox',
      'unlock:identity-1',
    ]);
  });
});
