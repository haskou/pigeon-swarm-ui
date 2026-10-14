import {
  KeyPair,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { DeviceAuthorizationCheckpoint } from '../../domain/DeviceAuthorizationCheckpoint';
import type { DeviceAuthorizationTransition } from '../../domain/DeviceAuthorizationTransition';
import type { DeviceAuthorizationTransitionLogPrimitives } from '../../domain/DeviceAuthorizationTransitionLogPrimitives';
import type { DeviceAuthorizationTransitionPrimitives } from '../../domain/DeviceAuthorizationTransitionPrimitives';
import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';
import type { IdentityPassword } from '../../domain/value-objects/IdentityPassword';
import type { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import type { Session } from '../session/Session';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';
import type { CompletedDevicePairing } from './CompletedDevicePairing';
import type { DevicePairingAuthorization } from './DevicePairingAuthorization';
import type { OwnDeviceRevocation } from './OwnDeviceRevocation';
import type { DeviceAuthorizationCheckpointResource } from './resources/DeviceAuthorizationCheckpointResource';
import type { DeviceCatalogResource } from './resources/DeviceCatalogResource';
import type {
  DeviceSealedSecretHandedOverResource,
  DeviceSealedSecretHandOverResource,
} from './resources/DeviceSealedSecretResource';
import type { IdentityResource } from './resources/IdentityResource';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { DeviceAuthorization } from '../../domain/DeviceAuthorization';
import { DeviceAuthorizationTransition as AuthorizationTransition } from '../../domain/DeviceAuthorizationTransition';
import { DeviceAuthorizationTransitionLog } from '../../domain/DeviceAuthorizationTransitionLog';
import { DevicePairingCompletion } from '../../domain/DevicePairingCompletion';
import { DevicePairingError } from '../../domain/DevicePairingError';
import { DevicePairingInvitation } from '../../domain/DevicePairingInvitation';
import { DevicePairingRequest } from '../../domain/DevicePairingRequest';
import { DeviceRemovedError } from '../../domain/DeviceRemovedError';
import { UnprovenDeviceAuthorizationError } from '../../domain/errors/UnprovenDeviceAuthorizationError';
import { DeviceRemovalDomainService } from '../../domain/services/DeviceRemovalDomainService';
import { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import { DeviceId } from '../../domain/value-objects/DeviceId';
import { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { PairingId } from '../../domain/value-objects/PairingId';
import { RecoveryAuthority } from '../../domain/value-objects/RecoveryAuthority';
import { RecoveryIdentityMaterial } from '../crypto/RecoveryIdentityMaterial';
import { DevicePairingCodeReader } from '../pairing/DevicePairingCodeReader';
import { DeviceAuthorizationCheckpointMapper } from './DeviceAuthorizationCheckpointMapper';
import { IdentityMailboxHomeVerifier } from './IdentityMailboxHomeVerifier';

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

    return DeviceAuthorizationCheckpointMapper.fromResource(
      resource,
      identityId,
    );
  }

  /**
   * Submits a transition, with the sealed root generation a device hands to
   * the remaining devices in its own retirement. The node confirms a stored
   * hand-over in the response; without the confirmation it stored none.
   */
  private async submit(
    session: Session,
    transition: DeviceAuthorizationTransition,
    sealedSecrets?: DeviceSealedSecretHandOverResource,
  ): Promise<{
    checkpoint: DeviceAuthorizationCheckpoint;
    handedOver?: DeviceSealedSecretHandedOverResource;
  }> {
    const body: DeviceAuthorizationTransitionPrimitives & {
      sealedSecrets?: DeviceSealedSecretHandOverResource;
    } = {
      ...transition.toPrimitives(),
      ...(sealedSecrets ? { sealedSecrets } : {}),
    };
    const path = '/identity-devices/transitions';
    const resource = await this.http.request<
      DeviceAuthorizationCheckpointResource & {
        sealedSecrets?: DeviceSealedSecretHandedOverResource;
      }
    >(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
    const checkpoint = DeviceAuthorizationCheckpointMapper.fromResource(
      resource,
      transition.getIdentityId(),
    );

    assert(
      checkpoint.getEpoch().isEqual(transition.getResultEpoch()) &&
        checkpoint.getRevision().isEqual(transition.getResultRevision()),
      new Error('Unexpected device authorization checkpoint.'),
    );

    return { checkpoint, handedOver: resource.sealedSecrets };
  }

  private async applyTransition(
    session: Session,
    transition: DeviceAuthorizationTransition,
    sealedSecrets?: DeviceSealedSecretHandOverResource,
  ): Promise<{
    checkpoint: DeviceAuthorizationCheckpoint;
    handedOver?: DeviceSealedSecretHandedOverResource;
  }> {
    const submission = await this.submit(session, transition, sealedSecrets);

    await this.vault.advanceAuthorization(
      transition.getIdentityId(),
      transition.getPreviousRevision(),
      transition.getResultEpoch(),
    );

    return submission;
  }

  private async revocation(
    session: Session,
    target: DeviceCredential,
    compromisedSince?: DeviceAuthorizationRevision,
  ): Promise<DeviceAuthorizationTransition> {
    const current = await this.find(session);

    assert(
      !compromisedSince ||
        !compromisedSince.isGreaterThan(current.getRevision()),
      new Error('The compromise revision is in the future.'),
    );

    return AuthorizationTransition.revocation({
      author: session.deviceCredentialKeyPair,
      compromisedSince,
      epoch: current.getEpoch(),
      identityId: current.getIdentityId(),
      operationId: DeviceAuthorizationOperationId.generate(),
      previousRevision: current.getRevision(),
      targetCredential: target,
    });
  }

  private async readDevices(
    identityId: IdentityId,
    path: string,
    headers: Record<string, string>,
  ): Promise<DeviceCredential[]> {
    const resource = await this.http.request<DeviceCatalogResource>(path, {
      headers,
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
    const invitation = DevicePairingCodeReader.invitation(
      invitationCode,
      acceptedAt,
    );

    return await DevicePairingRequest.create(invitation, acceptedAt);
  }

  public async verifyPairingRequest(
    requestCode: DevicePairingCode,
  ): Promise<string> {
    return await DevicePairingCodeReader.request(
      requestCode,
      new Timestamp(this.clock()),
    ).getVerificationCode();
  }

  public async authorizePairing(
    session: Session,
    requestCode: DevicePairingCode,
    historyTransferSecret: SymmetricKey,
  ): Promise<DevicePairingAuthorization> {
    const acceptedAt = new Timestamp(this.clock());
    const request = DevicePairingCodeReader.request(requestCode, acceptedAt);
    const invitation = request.getInvitation();
    const identityId = IdentityId.fromString(session.identity.id);
    const credential = request.getProof().getCredential();

    assert(
      invitation.getIdentityId().isEqual(identityId) &&
        invitation.getEpoch().isEqual(session.authorizationEpoch) &&
        invitation.getRevision().isEqual(session.authorizationRevision) &&
        invitation
          .getAuthorCredential()
          .hasValue(session.deviceCredentialKeyPair.toPrimitives().publicKey),
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
      targetCredential: credential,
    });
    const checkpoint = await this.apply(session, transition);
    const completion = DevicePairingCompletion.create({
      author: session.deviceCredentialKeyPair,
      checkpoint,
      historyTransferSecret,
      identityKeyPair: session.keyPair,
      recoveryAuthorityKeyPair: session.recoveryAuthorityKeyPair,
      request,
      rootKey: UserRootKey.fromBase64(session.masterKey.valueOf()),
    });

    return {
      completion,
      credential,
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
  ): Promise<CompletedDevicePairing> {
    draft.reserve();

    try {
      const completion = DevicePairingCodeReader.completion(completionCode);
      const material = DevicePairingCodeReader.material(
        completion.decryptMaterial(
          draft.getRequest(),
          draft.getTransportKeyPair(),
        ),
      );
      const identityId = IdentityId.fromString(
        material.getIdentityKeyPair().toPrimitives().publicKey,
      );

      assert(
        identityId.isEqual(IdentityId.fromString(identity.id)) &&
          RecoveryAuthority.fromString(
            material.getRecoveryAuthorityKeyPair().toPrimitives().publicKey,
          ).isEqual(RecoveryAuthority.fromString(identity.recoveryAuthority)),
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
        historyTransferSecret: material.getHistoryTransferSecret(),
        session: {
          ...pendingSession,
          deviceId: vaultSession.deviceId,
        },
      };
    } catch (error) {
      draft.release();
      throw error;
    }
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

    return this.readDevices(
      identityId,
      path,
      await this.signer.headersWithDeviceProof(session, 'GET', path),
    );
  }

  public async revokeDevice(
    session: Session,
    target: DeviceCredential,
    compromisedSince?: DeviceAuthorizationRevision,
  ): Promise<Session> {
    const checkpoint = await this.apply(
      session,
      await this.revocation(session, target, compromisedSince),
    );

    return {
      ...session,
      authorizationEpoch: checkpoint.getEpoch(),
      authorizationRevision: checkpoint.getRevision(),
    };
  }

  /**
   * Prepares this device's own revocation, the same transition every other
   * removal uses, and the devices that remain after it. Reports
   * 'already-revoked' when the node rejects this device's signature with code
   * 401020, or no longer lists this device. Reports 'last-device' when it is
   * the only credential, which the node never revokes. Any other failure
   * rejects. Nothing is submitted.
   */
  public async prepareOwnRetirement(
    session: Session,
  ): Promise<'already-revoked' | 'last-device' | OwnDeviceRevocation> {
    let devices: DeviceCredential[];

    try {
      devices = await this.findDevices(session);
    } catch (error) {
      if (
        error instanceof HttpJsonError &&
        error.status === 401 &&
        error.code === 401020
      ) {
        return 'already-revoked';
      }

      throw error;
    }

    const own = session.deviceCredentialKeyPair.toPrimitives().publicKey;
    const self = devices.find((device) => device.hasValue(own));

    if (!self) {
      return 'already-revoked';
    }

    if (devices.length === 1) {
      return 'last-device';
    }

    return {
      remaining: devices.filter((device) => device !== self),
      transition: await this.revocation(session, self),
    };
  }

  /**
   * Submits this device's own prepared revocation, with the sealed root
   * generation it hands to the remaining devices. Resolves true only when the
   * node confirms it stored that generation at the revocation revision; false
   * when it applied the revocation without it, as when a concurrent change
   * won the race. Any failure rejects, with nothing revoked.
   */
  public async retireOwnDevice(
    session: Session,
    revocation: OwnDeviceRevocation,
    sealedSecrets?: DeviceSealedSecretHandOverResource,
  ): Promise<boolean> {
    const { handedOver } = await this.applyTransition(
      session,
      revocation.transition,
      sealedSecrets,
    );

    return (
      sealedSecrets !== undefined &&
      handedOver != null &&
      revocation.transition
        .getResultRevision()
        .hasValue(handedOver.authorizationRevision) &&
      handedOver.generation === sealedSecrets.generation
    );
  }

  /**
   * Verifies this device's authorization from the signed transitions the node
   * serves, replayed from the genesis in the identity record the identity key
   * signed. Rejects with DeviceRemovedError only on a verified removal above
   * the local checkpoint. A record or log that proves neither rejects with
   * the unproven-authorization message, never with a removal; so does any
   * node error, as itself.
   */
  public async synchronize(session: Session): Promise<Session> {
    const identityId = IdentityId.fromString(session.identity.id);
    const path = `${this.checkpointPath(identityId)}/transitions`;
    const resource =
      await this.http.request<DeviceAuthorizationTransitionLogPrimitives>(
        path,
        {
          headers: await this.signer.headersWithDeviceProof(
            session,
            'GET',
            path,
          ),
          method: 'GET',
        },
      );
    let head: DeviceAuthorization;

    try {
      const recoveryAuthority = RecoveryAuthority.fromString(
        session.recoveryAuthorityKeyPair.toPrimitives().publicKey,
      );

      assert(
        IdentityMailboxHomeVerifier.isTrusted(
          identityId.valueOf(),
          session.identity,
        ) &&
          recoveryAuthority.isEqual(
            RecoveryAuthority.fromString(session.identity.recoveryAuthority),
          ),
        new UnprovenDeviceAuthorizationError(),
      );
      head = DeviceRemovalDomainService.verify({
        genesis: DeviceAuthorization.genesis(
          identityId,
          DeviceCredential.fromString(session.identity.deviceCredential),
          recoveryAuthority,
        ),
        local: {
          epoch: session.authorizationEpoch,
          revision: session.authorizationRevision,
        },
        log: DeviceAuthorizationTransitionLog.fromPrimitives(resource),
        reader: DeviceCredential.fromString(
          session.deviceCredentialKeyPair.toPrimitives().publicKey,
        ),
      });
    } catch (error) {
      if (error instanceof DeviceRemovedError) throw error;

      throw new Error(copy.auth.deviceAuthorizationUnproven);
    }

    await this.vault.synchronizeAuthorization(
      identityId,
      session.authorizationRevision,
      head.getEpoch(),
      head.getRevision(),
    );

    return {
      ...session,
      authorizationEpoch: head.getEpoch(),
      authorizationRevision: head.getRevision(),
    };
  }

  public async apply(
    session: Session,
    transition: DeviceAuthorizationTransition,
  ): Promise<DeviceAuthorizationCheckpoint> {
    return (await this.applyTransition(session, transition)).checkpoint;
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
        RecoveryAuthority.fromString(
          material.recoveryAuthorityKeyPair.toPrimitives().publicKey,
        ).isEqual(RecoveryAuthority.fromString(identity.recoveryAuthority)),
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
      compromisedCredentials: current.getCompromisedCredentials(),
      epoch: current.getEpoch(),
      identityId,
      operationId: DeviceAuthorizationOperationId.generate(),
      previousRevision: current.getRevision(),
      recoveryAuthority: material.recoveryAuthorityKeyPair,
      target: deviceCredentialKeyPair,
    });
    const { checkpoint } = await this.submit(recoverySession, transition);
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
