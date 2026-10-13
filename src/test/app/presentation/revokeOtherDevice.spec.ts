import { describe, expect, it } from '@jest/globals';
import { type MockProxy, mock } from 'jest-mock-extended';

import type { DeviceCredential } from '../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

import {
  type DeviceRevokeServices,
  revokeOtherDevice,
} from '../../../app/presentation/revokeOtherDevice';

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const rotated = { identity: { id: 'identity-1' } } as unknown as Session;
const target = {} as DeviceCredential;

function services(): {
  directMessages: MockProxy<DeviceRevokeServices['directMessages']>;
  identities: MockProxy<DeviceRevokeServices['identities']>;
} {
  const directMessages = mock<DeviceRevokeServices['directMessages']>();
  const identities = mock<DeviceRevokeServices['identities']>();

  identities.revokeDevice.mockResolvedValue(rotated);
  directMessages.cutOffRevokedReaders.mockResolvedValue(undefined);

  return { directMessages, identities };
}

describe('revokeOtherDevice', () => {
  it('resolves only after the revoked readers are cut off under the rotated session', async () => {
    const revoke = services();
    const steps: string[] = [];
    let cutOff: () => void = () => undefined;

    revoke.directMessages.cutOffRevokedReaders.mockImplementation(() => {
      steps.push('cut-off started');

      return new Promise<void>((resolve) => {
        cutOff = resolve;
      });
    });
    const revoking = revokeOtherDevice(
      {
        onRotated: () => {
          steps.push('rotated');
        },
        session,
        target,
      },
      revoke,
    ).then((revoked) => {
      steps.push(`resolved ${String(revoked.cutOff)}`);
    });

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(steps).toEqual(['rotated', 'cut-off started']);

    cutOff();
    await revoking;

    expect(steps).toEqual(['rotated', 'cut-off started', 'resolved true']);
    expect(revoke.directMessages.cutOffRevokedReaders).toHaveBeenCalledWith(
      rotated,
    );
  });

  it('hands over the rotated session and resolves false when the cut-off fails', async () => {
    const revoke = services();
    const rotations: Session[] = [];

    revoke.directMessages.cutOffRevokedReaders.mockRejectedValue(
      new Error('node down'),
    );

    await expect(
      revokeOtherDevice(
        { onRotated: (next) => rotations.push(next), session, target },
        revoke,
      ),
    ).resolves.toEqual({ cutOff: false, session: rotated });
    expect(rotations).toEqual([rotated]);
  });

  it('rejects without a cut-off when the revoke fails', async () => {
    const revoke = services();
    const rotations: Session[] = [];

    revoke.identities.revokeDevice.mockRejectedValue(new Error('refused'));

    await expect(
      revokeOtherDevice(
        { onRotated: (next) => rotations.push(next), session, target },
        revoke,
      ),
    ).rejects.toThrow('refused');
    expect(rotations).toEqual([]);
    expect(revoke.directMessages.cutOffRevokedReaders).not.toHaveBeenCalled();
  });
});
