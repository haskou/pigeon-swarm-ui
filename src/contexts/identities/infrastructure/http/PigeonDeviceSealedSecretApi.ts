import { assert } from '@haskou/value-objects';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { Session } from '../session/Session';
import type {
  DeviceSealedSecretPublicationResource,
  DeviceSealedSecretPublishedResource,
  DeviceSealedSecretResource,
} from './resources/DeviceSealedSecretResource';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import {
  DeviceSealedSecretCipher,
  type OpenedDeviceSealedSecret,
} from '../crypto/DeviceSealedSecretCipher';

export type DeviceSealedSecretPublication = {
  generation: number;
  payload: string;
  recipients: readonly DeviceCredential[];
};

/**
 * Publishes and reads the per-device sealed secrets of one identity. Both
 * routes use device proof only, so a device revoked at the head is refused
 * by the node before it can read a generation.
 */
export class PigeonDeviceSealedSecretApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  /**
   * Seals the payload to every recipient at the session revision and submits
   * the generation. A conflicting publish is not retried here: the caller
   * refetches the head and decides what to publish next.
   */
  public async publish(
    session: Session,
    input: DeviceSealedSecretPublication,
  ): Promise<void> {
    const identityId = IdentityId.fromString(session.identity.id);
    const path = `/identity-devices/${encodeURIComponent(identityId.valueOf())}/sealed-secrets`;
    const authorizationRevision = session.authorizationRevision.valueOf();
    const body: DeviceSealedSecretPublicationResource = {
      authorizationRevision,
      entries: DeviceSealedSecretCipher.seal({
        authorizationRevision,
        generation: input.generation,
        identityId: identityId.valueOf(),
        payload: input.payload,
        publisher: session.deviceCredentialKeyPair,
        recipients: input.recipients,
      }),
      generation: input.generation,
    };
    const published =
      await this.http.request<DeviceSealedSecretPublishedResource>(path, {
        body: JSON.stringify(body),
        headers: await this.signer.headersWithDeviceProof(
          session,
          'PUT',
          path,
          body,
        ),
        method: 'PUT',
      });

    assert(
      published.identityId === identityId.valueOf() &&
        published.generation === input.generation &&
        published.authorizationRevision === authorizationRevision,
      new Error('Unexpected device sealed secret publication.'),
    );
  }

  /**
   * Returns the caller's own entry of the stored generation, opened with the
   * device key, or `null` when no entry exists for this device yet.
   */
  public async fetchOwn(
    session: Session,
  ): Promise<OpenedDeviceSealedSecret | null> {
    const identityId = IdentityId.fromString(session.identity.id);
    const path = `/identity-devices/${encodeURIComponent(identityId.valueOf())}/sealed-secrets`;
    let resource: DeviceSealedSecretResource;

    try {
      resource = await this.http.request<DeviceSealedSecretResource>(path, {
        headers: await this.signer.headersWithDeviceProof(session, 'GET', path),
        method: 'GET',
      });
    } catch (error) {
      if (error instanceof HttpJsonError && error.status === 404) {
        return null;
      }

      throw error;
    }

    return DeviceSealedSecretCipher.open({
      identityId: identityId.valueOf(),
      recipient: session.deviceCredentialKeyPair,
      resource,
    });
  }
}
