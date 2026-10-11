import {
  KeyPair,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type {
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { DeviceAuthorizationCheckpointResource } from '../../domain/DeviceAuthorizationCheckpointResource';
import type { DeviceAuthorizationTransition } from '../../domain/DeviceAuthorizationTransition';
import type { DeviceCatalogResource } from '../../domain/DeviceCatalogResource';
import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';
import type { IdentityPassword } from '../../domain/value-objects/IdentityPassword';
import type { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';

import { DeviceAuthorizationCheckpoint } from '../../domain/DeviceAuthorizationCheckpoint';
import { DeviceAuthorizationTransition as AuthorizationTransition } from '../../domain/DeviceAuthorizationTransition';
import { DevicePairingCompletion } from '../../domain/DevicePairingCompletion';
import { DevicePairingError } from '../../domain/DevicePairingError';
import { DevicePairingInvitation } from '../../domain/DevicePairingInvitation';
import { DevicePairingRequest } from '../../domain/DevicePairingRequest';
import { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import { DeviceId } from '../../domain/value-objects/DeviceId';
import { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { PairingId } from '../../domain/value-objects/PairingId';
import { RecoveryIdentityMaterial } from '../crypto/RecoveryIdentityMaterial';

const emptyKeychain = { conversations: {}, version: 0 };
const PAIRING_TTL_MS = 2 * 60 * 1000;

export class PigeonDeviceAuthorizationApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly vault: DeviceIdentityVault,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  private checkpointPath(identityId: IdentityId): string {
    return `/identity-devices/${encodeURIComponent(identityId.valueOf())}`;
  }

  private async findRecoveryCheckpoint(
    session: Session,
  ): Promise<DeviceAuthorizationCheckpoint> {
    const identityId = IdentityId.fromString(session.identity.id);
    const path = this.checkpointPath(identityId);

    return await this.requestCheckpoint(
      identityId,
      path,
      await this.signer.headersWithRecoveryProof(session, 'GET', path),
    );
  }

  private async requestCheckpoint(
    identityId: IdentityId,
    path: string,
    headers: Record<string, string>,
  ): Promise<DeviceAuthorizationCheckpoint> {
    const resource =
      await this.http.request<DeviceAuthorizationCheckpointResource>(path, {
        headers,
        method: 'GET',
      });

    return DeviceAuthorizationCheckpoint.fromResource(resource, identityId);
  }

  private async submit(
    session: Session,
    transition: DeviceAuthorizationTransition,
  ): Promise<DeviceAuthorizationCheckpoint> {
    const body = transition.toPrimitives();
    const path = '/identity-devices/transitions';
    const resource =
      await this.http.request<DeviceAuthorizationCheckpointResource>(path, {
        body: JSON.stringify(body),
        headers: await this.signer.headers(session, 'POST', path, body),
        method: 'POST',
      });
    const checkpoint = DeviceAuthorizationCheckpoint.fromResource(
      resource,
      transition.getIdentityId(),
    );

    assert(
      checkpoint.getEpoch().isEqual(transition.getResultEpoch()) &&
        checkpoint.getRevision().isEqual(transition.getResultRevision()),
      new Error('Unexpected device authorization checkpoint.'),
    );

    return checkpoint;
  }

  public invite(session: Session): DevicePairingInvitation {
    const now = this.clock();

    return DevicePairingInvitation.create({
      author: session.deviceCredentialKeyPair,
      epoch: session.authorizationEpoch,
      expiresAt: new Timestamp(now + PAIRING_TTL_MS),
      identityId: IdentityId.fromString(session.identity.id),
      pairingId: PairingId.generate(),
      revision: session.authorizationRevision,
    });
  }

  public async requestPairing(
    invitationCode: DevicePairingCode,
  ): Promise<DevicePairingRequestDraft> {
    const acceptedAt = new Timestamp(this.clock());
    const invitation = DevicePairingInvitation.fromCode(
      invitationCode,
      acceptedAt,
    );

    return await DevicePairingRequest.create(invitation, acceptedAt);
  }

  public async verifyPairingRequest(
    requestCode: DevicePairingCode,
  ): Promise<string> {
    return await DevicePairingRequest.fromCode(
      requestCode,
      new Timestamp(this.clock()),
    ).getVerificationCode();
  }

  public async authorizePairing(
    session: Session,
    requestCode: DevicePairingCode,
  ): Promise<{ completion: DevicePairingCompletion; session: Session }> {
    const acceptedAt = new Timestamp(this.clock());
    const request = DevicePairingRequest.fromCode(requestCode, acceptedAt);
    const invitation = request.getInvitation();
    const identityId = IdentityId.fromString(session.identity.id);

    assert(
      invitation.getIdentityId().isEqual(identityId) &&
        invitation.getEpoch().isEqual(session.authorizationEpoch) &&
        invitation.getRevision().isEqual(session.authorizationRevision) &&
        invitation.getAuthorCredential().valueOf() ===
          session.deviceCredentialKeyPair.toPrimitives().publicKey,
      new DevicePairingError(
        'mismatch',
        'Device pairing request does not match this session.',
      ),
    );

    const transition = AuthorizationTransition.enrollmentWithProof({
      author: session.deviceCredentialKeyPair,
      authorizedAt: request.getAuthorizedAt(),
      epoch: invitation.getEpoch(),
      identityId,
      operationId: request.getOperationId(),
      pairingExpiration: invitation.getExpiration(),
      pairingId: invitation.getPairingId(),
      previousRevision: invitation.getRevision(),
      proofOfPossession: request.getProof().getSignature(),
      targetCredential: request.getProof().getCredential(),
    });
    const checkpoint = await this.apply(session, transition);
    const completion = DevicePairingCompletion.create({
      author: session.deviceCredentialKeyPair,
      checkpoint,
      identityKeyPair: session.keyPair,
      recoveryAuthorityKeyPair: session.recoveryAuthorityKeyPair,
      request,
      rootKey: UserRootKey.fromBase64(session.masterKey.valueOf()),
    });

    return {
      completion,
      session: {
        ...session,
        authorizationEpoch: checkpoint.getEpoch(),
        authorizationRevision: checkpoint.getRevision(),
      },
    };
  }

  public async completePairing(
    identity: IdentityResource,
    password: IdentityPassword,
    draft: DevicePairingRequestDraft,
    completionCode: DevicePairingCode,
  ): Promise<Session> {
    draft.assertAvailable();
    const completion = DevicePairingCompletion.fromCode(completionCode);
    const material = completion.open(
      draft.getRequest(),
      draft.getTransportKeyPair(),
    );
    const identityId = IdentityId.fromString(
      material.getIdentityKeyPair().toPrimitives().publicKey,
    );

    assert(
      identityId.isEqual(IdentityId.fromString(identity.id)) &&
        material.getRecoveryAuthorityKeyPair().toPrimitives().publicKey ===
          identity.recoveryAuthority,
      new DevicePairingError(
        'mismatch',
        'Paired identity material does not match the identity.',
      ),
    );

    const pendingSession = {
      authorizationEpoch: completion.getEpoch(),
      authorizationRevision: completion.getRevision(),
      deviceCredentialKeyPair: draft.getTargetKeyPair(),
      deviceId: DeviceId.generate(),
      identity,
      keychain: emptyKeychain,
      keyPair: material.getIdentityKeyPair(),
      masterKey: SymmetricKey.fromBuffer(material.getRootKey().getBuffer()),
      recoveryAuthorityKeyPair: material.getRecoveryAuthorityKeyPair(),
    } satisfies Session;
    const checkpoint = await this.find(pendingSession);

    assert(
      checkpoint.getEpoch().isEqual(completion.getEpoch()) &&
        checkpoint.getRevision().isEqual(completion.getRevision()),
      new DevicePairingError(
        'mismatch',
        'Pairing completion is not the current authorization checkpoint.',
      ),
    );

    const vaultSession = await this.vault.register({
      authorizationEpoch: checkpoint.getEpoch(),
      authorizationRevision: checkpoint.getRevision(),
      identityId,
      material: {
        deviceCredentialKeyPair: draft.getTargetKeyPair(),
        identityKeyPair: material.getIdentityKeyPair(),
        recoveryAuthorityKeyPair: material.getRecoveryAuthorityKeyPair(),
        rootKey: material.getRootKey(),
      },
      password: password.valueOf(),
    });
    draft.consume();

    return {
      ...pendingSession,
      deviceId: vaultSession.deviceId,
    };
  }

  public async find(session: Session): Promise<DeviceAuthorizationCheckpoint> {
    const identityId = IdentityId.fromString(session.identity.id);
    const path = this.checkpointPath(identityId);

    return await this.requestCheckpoint(
      identityId,
      path,
      await this.signer.headersWithDeviceProof(session, 'GET', path),
    );
  }

  public async findDevices(session: Session): Promise<DeviceCredential[]> {
    const identityId = IdentityId.fromString(session.identity.id);
    const path = `${this.checkpointPath(identityId)}/devices`;
    const resource = await this.http.request<DeviceCatalogResource>(path, {
      headers: await this.signer.headersWithDeviceProof(session, 'GET', path),
      method: 'GET',
    });

    assert(
      IdentityId.fromString(resource.identityId).isEqual(identityId),
      new Error('Device catalog identity does not match.'),
    );

    return resource.credentials.map((credential) =>
      DeviceCredential.fromPublicKey(
        IdentityId.fromString(credential).getPublicKey(),
      ),
    );
  }

  public async revokeDevice(
    session: Session,
    target: DeviceCredential,
    compromisedSince?: DeviceAuthorizationRevision,
  ): Promise<Session> {
    assert(
      target.valueOf() !==
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      new Error('A device cannot revoke itself.'),
    );
    const current = await this.find(session);

    assert(
      !compromisedSince ||
        !compromisedSince.isGreaterThan(current.getRevision()),
      new Error('The compromise revision is in the future.'),
    );
    const checkpoint = await this.apply(
      session,
      AuthorizationTransition.revocation({
        author: session.deviceCredentialKeyPair,
        compromisedSince,
        epoch: current.getEpoch(),
        identityId: current.getIdentityId(),
        operationId: DeviceAuthorizationOperationId.generate(),
        previousRevision: current.getRevision(),
        targetCredential: target,
      }),
    );

    return {
      ...session,
      authorizationEpoch: checkpoint.getEpoch(),
      authorizationRevision: checkpoint.getRevision(),
    };
  }

  public async synchronize(session: Session): Promise<Session> {
    const checkpoint = await this.find(session);

    await this.vault.synchronizeAuthorization(
      checkpoint.getIdentityId(),
      session.authorizationRevision,
      checkpoint.getEpoch(),
      checkpoint.getRevision(),
    );

    return {
      ...session,
      authorizationEpoch: checkpoint.getEpoch(),
      authorizationRevision: checkpoint.getRevision(),
    };
  }

  public async apply(
    session: Session,
    transition: DeviceAuthorizationTransition,
  ): Promise<DeviceAuthorizationCheckpoint> {
    const checkpoint = await this.submit(session, transition);

    await this.vault.advanceAuthorization(
      transition.getIdentityId(),
      transition.getPreviousRevision(),
      transition.getResultEpoch(),
    );

    return checkpoint;
  }

  public async recover(
    identity: IdentityResource,
    recoveryKey: RecoveryKey,
    password: IdentityPassword,
  ): Promise<Session> {
    const material = await RecoveryIdentityMaterial.derive(recoveryKey);
    const identityId = IdentityId.fromString(
      material.identityKeyPair.toPrimitives().publicKey,
    );

    assert(
      identityId.isEqual(IdentityId.fromString(identity.id)) &&
        material.recoveryAuthorityKeyPair.toPrimitives().publicKey ===
          identity.recoveryAuthority,
      new Error('Recovery kit does not belong to this identity.'),
    );

    const deviceCredentialKeyPair = await KeyPair.generate();
    const recoverySession = {
      authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
      authorizationRevision: DeviceAuthorizationRevision.initial(),
      deviceCredentialKeyPair,
      deviceId: DeviceId.generate(),
      identity,
      keychain: emptyKeychain,
      keyPair: material.identityKeyPair,
      masterKey: SymmetricKey.fromBuffer(material.rootKey.getBuffer()),
      recoveryAuthorityKeyPair: material.recoveryAuthorityKeyPair,
    } satisfies Session;
    const current = await this.findRecoveryCheckpoint(recoverySession);
    const transition = AuthorizationTransition.recovery({
      epoch: current.getEpoch(),
      identityId,
      operationId: DeviceAuthorizationOperationId.generate(),
      previousRevision: current.getRevision(),
      recoveryAuthority: material.recoveryAuthorityKeyPair,
      target: deviceCredentialKeyPair,
    });
    const checkpoint = await this.submit(recoverySession, transition);
    const vaultSession = await this.vault.register({
      authorizationEpoch: checkpoint.getEpoch(),
      authorizationRevision: checkpoint.getRevision(),
      identityId,
      material: {
        deviceCredentialKeyPair,
        identityKeyPair: material.identityKeyPair,
        recoveryAuthorityKeyPair: material.recoveryAuthorityKeyPair,
        rootKey: material.rootKey,
      },
      password: password.valueOf(),
    });

    return {
      ...recoverySession,
      authorizationEpoch: vaultSession.authorizationEpoch,
      authorizationRevision: vaultSession.authorizationRevision,
      deviceId: vaultSession.deviceId,
    };
  }
}
