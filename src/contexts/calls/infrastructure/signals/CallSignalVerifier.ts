import {
  CommitmentId,
  PublicKey,
  Signature,
  X25519EncryptedPayload,
  type X25519KeyPair,
} from '@haskou/pigeon-swarm-crypto';

import type { DeviceAuthorization } from '../../../identities/domain/DeviceAuthorization';
import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../identities/domain/DeviceAuthorizationTransitionLogPrimitives';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { SealingViewResource } from './PigeonCallSealingApi';
import type { SealedCallSignal } from './SealedCallSignal';

import { DeviceCredential } from '../../../identities/domain/value-objects/DeviceCredential';
import { CallSignalRefusedError } from './CallSignalRefusedError';
import { CALL_SIGNAL_LIFETIME_MS } from './CallSignalSealer';
import { CallSignalSigningBytes } from './CallSignalSigningBytes';
import { SenderAuthorizationChain } from './SenderAuthorizationChain';

export const CALL_SIGNAL_MAX_CLOCK_SKEW_MS = 5_000;

export type CallSignalVerifierPorts = {
  clock: () => number;
  floors: {
    get(session: Session, identityId: string): Promise<number>;
    raise(
      session: Session,
      identityId: string,
      revision: number,
    ): Promise<void>;
  };
  /** The genesis authorization of an identity, from its trusted record. */
  genesis: (identityId: string) => Promise<DeviceAuthorization>;
  keys: { keyPair(session: Session): Promise<X25519KeyPair> };
  /** One transition log per distinct, independently verified replica. */
  logs: (
    session: Session,
    identityId: string,
  ) => Promise<DeviceAuthorizationTransitionLogPrimitives[]>;
  parties: {
    conversationId(
      session: Session,
      callId: string,
    ): Promise<string | undefined>;
  };
  view: { sealingView(identityId: string): Promise<SealingViewResource> };
};

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const isShapeValid = (signal: SealedCallSignal): boolean =>
  [
    signal.callId,
    signal.networkId,
    signal.recipientIdentityId,
    signal.senderDeviceCredential,
    signal.senderIdentityId,
    signal.signalId,
    signal.signature,
  ].every(isText) &&
  Number.isSafeInteger(signal.createdAt) &&
  Number.isSafeInteger(signal.expiresAt) &&
  signal.expiresAt - signal.createdAt === CALL_SIGNAL_LIFETIME_MS &&
  ['answer', 'ice_candidate', 'offer'].includes(signal.signalType) &&
  Array.isArray(signal.sealedEntries) &&
  signal.sealedEntries.length > 0 &&
  signal.sealedEntries.every(
    (entry) =>
      isText(entry.envelope) && isText(entry.recipientDeviceCredential),
  );

/**
 * The receive verdict of a sealed call signal. It either returns the opened
 * payload or throws CallSignalRefusedError; a refused signal is never
 * applied. Nothing in a refusal or a log carries payload content.
 */
export class CallSignalVerifier {
  private readonly seen = new Map<string, number>();

  public constructor(private readonly ports: CallSignalVerifierPorts) {}

  private static isAuthorized(
    head: DeviceAuthorization,
    credential: string,
  ): boolean {
    try {
      return head.isAuthorized(DeviceCredential.fromString(credential));
    } catch {
      return false;
    }
  }

  private assertFresh(signal: SealedCallSignal): void {
    const now = this.ports.clock();

    if (
      signal.expiresAt <= now ||
      signal.createdAt > now + CALL_SIGNAL_MAX_CLOCK_SKEW_MS
    ) {
      throw new CallSignalRefusedError('expired');
    }
  }

  private async assertParties(
    session: Session,
    signal: SealedCallSignal,
  ): Promise<void> {
    const conversationId = await this.ports.parties.conversationId(
      session,
      signal.callId,
    );

    if (
      conversationId !==
      CommitmentId.oneToOneConversation(
        signal.senderIdentityId,
        signal.recipientIdentityId,
        signal.networkId,
      )
    ) {
      throw new CallSignalRefusedError('party-mismatch');
    }
  }

  private assertSignature(signal: SealedCallSignal): void {
    const { signature, ...unsigned } = signal;

    try {
      if (
        PublicKey.fromPEM(signal.senderDeviceCredential).isValidSignature(
          CallSignalSigningBytes.signal(unsigned),
          new Signature(signature),
        )
      ) {
        return;
      }
    } catch {
      // A credential or signature that does not parse is a bad signature.
    }

    throw new CallSignalRefusedError('bad-signature');
  }

  private async provenHead(
    session: Session,
    signal: SealedCallSignal,
  ): Promise<DeviceAuthorization> {
    let head: DeviceAuthorization;
    let viewRevision: number;

    try {
      head = SenderAuthorizationChain.verify(
        await this.ports.genesis(signal.senderIdentityId),
        await this.ports.logs(session, signal.senderIdentityId),
      );
      viewRevision = (
        await this.ports.view.sealingView(signal.senderIdentityId)
      ).revision;
    } catch (error) {
      if (error instanceof CallSignalRefusedError) throw error;

      throw new CallSignalRefusedError('chain-unverified');
    }

    const revision = head.getRevision().valueOf();

    if (
      revision <
        (await this.ports.floors.get(session, signal.senderIdentityId)) ||
      viewRevision > revision
    ) {
      throw new CallSignalRefusedError('stale-head');
    }

    return head;
  }

  private async open(
    session: Session,
    signal: SealedCallSignal,
  ): Promise<Record<string, unknown>> {
    const { publicKey } = session.deviceCredentialKeyPair.toPrimitives();
    const entry = signal.sealedEntries.find(
      (candidate) => candidate.recipientDeviceCredential === publicKey,
    );

    if (!entry) throw new CallSignalRefusedError('not-for-this-device');

    try {
      const opened: unknown = JSON.parse(
        (await this.ports.keys.keyPair(session))
          .decrypt(new X25519EncryptedPayload(entry.envelope))
          .toString('utf8'),
      );

      if (
        typeof opened === 'object' &&
        opened !== null &&
        !Array.isArray(opened)
      ) {
        return opened as Record<string, unknown>;
      }
    } catch {
      // Falls through to the refusal: the envelope did not open.
    }

    throw new CallSignalRefusedError('undecryptable');
  }

  private markSeen(signal: SealedCallSignal): void {
    const now = this.ports.clock();

    for (const [id, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(id);
    }

    if (this.seen.has(signal.signalId)) {
      throw new CallSignalRefusedError('replayed');
    }

    this.seen.set(signal.signalId, signal.expiresAt);
  }

  public async receive(
    session: Session,
    signal: SealedCallSignal,
  ): Promise<{ payload: Record<string, unknown> }> {
    if (!isShapeValid(signal)) throw new CallSignalRefusedError('malformed');

    if (signal.recipientIdentityId !== session.identity.id) {
      throw new CallSignalRefusedError('not-for-this-device');
    }

    this.assertFresh(signal);

    if (signal.scopeType !== 'conversation') {
      throw new CallSignalRefusedError('scope-unsupported');
    }

    if (signal.senderIdentityId === signal.recipientIdentityId) {
      throw new CallSignalRefusedError('party-mismatch');
    }

    const { publicKey } = session.deviceCredentialKeyPair.toPrimitives();

    if (
      !signal.sealedEntries.some(
        (entry) => entry.recipientDeviceCredential === publicKey,
      )
    ) {
      throw new CallSignalRefusedError('not-for-this-device');
    }

    const head = await this.provenHead(session, signal);

    this.assertFresh(signal);

    if (!CallSignalVerifier.isAuthorized(head, signal.senderDeviceCredential)) {
      throw new CallSignalRefusedError('sender-unauthorised');
    }

    await this.assertParties(session, signal);
    this.assertSignature(signal);
    this.markSeen(signal);
    const payload = await this.open(session, signal);

    await this.ports.floors.raise(
      session,
      signal.senderIdentityId,
      head.getRevision().valueOf(),
    );

    return { payload };
  }
}
