import { PublicKey } from '@haskou/pigeon-swarm-crypto';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { DeviceAuthorizationCheckpoint } from '../../../../../contexts/identities/domain/DeviceAuthorizationCheckpoint';
import type { OwnDeviceAuthorizationPort } from '../../../../../contexts/identities/domain/services/OwnDeviceAuthorizationPort';

import { DeviceRemovedError } from '../../../../../contexts/identities/domain/DeviceRemovedError';
import { DeviceRemovalDomainService } from '../../../../../contexts/identities/domain/services/DeviceRemovalDomainService';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';

describe(DeviceRemovalDomainService.name, () => {
  const identityId = 'identity-1';
  const rejection = new Error('credential rejected');
  const own = DeviceCredential.fromPublicKey(PublicKey.fromPEM('own-device'));
  const other = DeviceCredential.fromPublicKey(
    PublicKey.fromPEM('other-device'),
  );
  let port: MockProxy<OwnDeviceAuthorizationPort>;

  beforeEach(() => {
    port = mock<OwnDeviceAuthorizationPort>();
    port.ownCredential.mockReturnValue(own);
    port.isCredentialRejection.mockImplementation(
      (error) => error === rejection,
    );
  });

  it('resolves with the checkpoint without reading the catalog', async () => {
    const checkpoint = mock<DeviceAuthorizationCheckpoint>();
    port.findCheckpoint.mockResolvedValue(checkpoint);

    await expect(
      DeviceRemovalDomainService.findCheckpoint(port, identityId),
    ).resolves.toBe(checkpoint);
    expect(port.findCatalog).not.toHaveBeenCalled();
  });

  it('reports removal when the rejected device is missing from the catalog', async () => {
    port.findCheckpoint.mockRejectedValue(rejection);
    port.findCatalog.mockResolvedValue([other]);

    const removal = DeviceRemovalDomainService.findCheckpoint(port, identityId);

    await expect(removal).rejects.toBeInstanceOf(DeviceRemovedError);
    await expect(removal).rejects.toMatchObject({ identityId });
  });

  it('keeps the rejection while the catalog still lists this device', async () => {
    port.findCheckpoint.mockRejectedValue(rejection);
    port.findCatalog.mockResolvedValue([
      other,
      DeviceCredential.fromPublicKey(PublicKey.fromPEM('own-device')),
    ]);

    await expect(
      DeviceRemovalDomainService.findCheckpoint(port, identityId),
    ).rejects.toBe(rejection);
  });

  it('keeps the rejection when the catalog check fails', async () => {
    port.findCheckpoint.mockRejectedValue(rejection);
    port.findCatalog.mockRejectedValue(new Error('catalog unreachable'));

    await expect(
      DeviceRemovalDomainService.findCheckpoint(port, identityId),
    ).rejects.toBe(rejection);
  });

  it('rethrows other failures without reading the catalog', async () => {
    const failure = new Error('node down');
    port.findCheckpoint.mockRejectedValue(failure);

    await expect(
      DeviceRemovalDomainService.findCheckpoint(port, identityId),
    ).rejects.toBe(failure);
    expect(port.findCatalog).not.toHaveBeenCalled();
  });
});
