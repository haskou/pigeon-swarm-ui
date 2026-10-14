import type { DeviceAuthorizationRevision } from '../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from '../../contexts/identities/domain/value-objects/DeviceCredential';
import type { Session } from '../../contexts/identities/infrastructure/session/Session';

export type DeviceRevokeServices = {
  directMessages: {
    cutOffRevokedReaders(session: Session): Promise<void>;
  };
  groupMessages: {
    cutOffRevokedReaders(session: Session): Promise<void>;
  };
  identities: {
    revokeDevice(
      session: Session,
      target: DeviceCredential,
      compromisedSince?: DeviceAuthorizationRevision,
    ): Promise<Session>;
  };
};

/**
 * Revokes another device of the identity, then cuts its readers off every
 * direct inbox and every own group inbox, so the revoke is reported done only
 * once that device opens no record written afterwards. The revoke rotated the
 * sealed root, so the rotated session reaches `onRotated` before the cut-off
 * runs and is never lost to a failed cut-off. Resolves with the rotated
 * session and whether both cut-offs succeeded; on failure the next sync of
 * each inbox retries it. Rejects when the revoke failed.
 */
export async function revokeOtherDevice(
  request: {
    compromisedSince?: DeviceAuthorizationRevision;
    onRotated: (session: Session) => void;
    session: Session;
    target: DeviceCredential;
  },
  services: DeviceRevokeServices,
): Promise<{ cutOff: boolean; session: Session }> {
  const rotated = await services.identities.revokeDevice(
    request.session,
    request.target,
    request.compromisedSince,
  );

  request.onRotated(rotated);

  const [direct, group] = await Promise.all(
    [services.directMessages, services.groupMessages].map((messages) =>
      messages
        .cutOffRevokedReaders(rotated)
        .then(() => true)
        .catch(() => false),
    ),
  );
  const cutOff = direct && group;

  return { cutOff, session: rotated };
}
