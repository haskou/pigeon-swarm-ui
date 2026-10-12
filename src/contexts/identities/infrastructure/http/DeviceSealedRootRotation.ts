import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from './PigeonDeviceSealedSecretApi';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

/**
 * Publishes and opens the device-sealed root of one identity. A generation
 * carries a fresh random root, sealed to every device at the head. A device
 * opens its own entry while the entry matches its authorization revision and
 * republishes once the revision moves on.
 */
export class DeviceSealedRootRotation {
  public constructor(
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
    private readonly sealedSecrets: PigeonDeviceSealedSecretApi,
    private readonly clock: () => number = Date.now,
  ) {}

  /**
   * Publishes a new generation and returns the session holding its root. A
   * conflicting publish refetches the head once and publishes again.
   */
  public async rotate(session: Session): Promise<Session> {
    try {
      return await this.publish(session);
    } catch (error: unknown) {
      if (!(error instanceof HttpJsonError) || error.status !== 409) {
        throw error;
      }

      return await this.publish(
        await this.deviceAuthorization.synchronize(session),
      );
    }
  }

  /**
   * Returns the session holding the root of the current generation. Publishes
   * a new generation when this device has no entry for the head revision.
   */
  public async current(session: Session): Promise<Session> {
    const own = await this.sealedSecrets.fetchOwn(session);

    if (own?.authorizationRevision === session.authorizationRevision.valueOf()) {
      return {
        ...session,
        deviceSealedRootKey: SymmetricKey.fromBuffer(decodeBase64Url(own.payload)),
      };
    }

    return await this.rotate(session);
  }

  private async publish(session: Session): Promise<Session> {
    const own = await this.sealedSecrets.fetchOwn(session);
    const root = SymmetricKey.generate();
    const recipients = await this.deviceAuthorization.findDevices(session);

    await this.sealedSecrets.publish(session, {
      generation: Math.max(own?.generation ?? 0, this.clock()) + 1,
      payload: encodeBase64Url(root.getBuffer()),
      recipients,
    });

    return { ...session, deviceSealedRootKey: root };
  }
}
