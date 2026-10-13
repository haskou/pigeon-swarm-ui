import { Buffer } from 'buffer';

import type { ConversationKeyEntry } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { SecurityAudit } from './SecurityAudit';
import type { SecurityAuditInput } from './SecurityAuditInput';

import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import {
  identityName,
  identityPrimaryDisplayName,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { KeyFingerprint } from '../../../../contexts/identities/presentation/view-models/KeyFingerprint';
import { shortId } from '../../../../shared/presentation/formatting';

/** Builds the security and audit view from ids and public material only. */
export class SecurityAuditReport {
  private static account(input: SecurityAuditInput): SecurityAudit['account'] {
    const { session } = input;
    const root = session.deviceSealedRootKey;

    return {
      authorizationEpoch: String(session.authorizationEpoch.valueOf()),
      authorizationRevision: Number(session.authorizationRevision.valueOf()),
      deviceCredentialFingerprint: KeyFingerprint.ofPublicKey(
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      ),
      deviceId: String(session.deviceId.valueOf()),
      identityId: session.identity.id,
      identityKeyFingerprint: KeyFingerprint.ofPublicKey(session.identity.id),
      sealedRoot: {
        fingerprint: root ? KeyFingerprint.ofSecret(root.getBuffer()) : null,
        generation: input.sealedRootGeneration,
      },
    };
  }

  private static devices(input: SecurityAuditInput): SecurityAudit['devices'] {
    if (!input.devices) return null;

    const own = IdentityId.normalize(
      input.session.deviceCredentialKeyPair.toPrimitives().publicKey,
    );

    return input.devices
      .map((credential) => ({
        credentialFingerprint: KeyFingerprint.ofPublicKey(credential),
        current: IdentityId.normalize(credential) === own,
      }))
      .sort((first, second) => Number(second.current) - Number(first.current));
  }

  private static conversation(
    input: SecurityAuditInput,
    entry: ConversationKeyEntry,
  ): SecurityAudit['conversations'][number] {
    const keyFingerprint = KeyFingerprint.ofSecret(
      Buffer.from(entry.key, 'base64'),
    );

    if (entry.kind === 'community') {
      const community = input.communities.find(
        (candidate) => candidate.id === entry.conversationId,
      );

      return {
        conversationId: entry.conversationId,
        incomingMailboxId: null,
        keyFingerprint,
        keyVersion: entry.version,
        kind: 'community',
        outgoingMailboxId: null,
        peerIdentityId: null,
        title: community?.name ?? shortId(entry.conversationId),
      };
    }

    const conversation = input.conversations.find(
      (candidate) => candidate.id === entry.conversationId,
    );

    return {
      conversationId: entry.conversationId,
      incomingMailboxId: input.mailboxId(
        entry.conversationId,
        input.session.identity.id,
      ),
      keyFingerprint,
      keyVersion: entry.version,
      kind: 'conversation',
      outgoingMailboxId: input.mailboxId(
        entry.conversationId,
        entry.peerIdentityId,
      ),
      peerIdentityId: entry.peerIdentityId,
      title:
        conversation?.name ??
        SecurityAuditReport.displayName(input, entry.peerIdentityId),
    };
  }

  private static contacts(
    input: SecurityAuditInput,
  ): SecurityAudit['contacts'] {
    const ids = new Set([
      ...Object.values(input.session.keychain.conversations)
        .filter((entry) => entry.kind !== 'community')
        .map((entry) => entry.peerIdentityId),
      ...Object.keys(input.pins),
    ]);

    ids.delete(input.session.identity.id);
    ids.delete('');

    return [...ids]
      .map((identityId) => ({
        identityId,
        keyFingerprint: KeyFingerprint.ofPublicKey(identityId),
        name: SecurityAuditReport.displayName(input, identityId),
        verified: Boolean(input.pins[identityId]?.verifiedAt),
      }))
      .sort(
        (first, second) =>
          Number(second.verified) - Number(first.verified) ||
          first.name.localeCompare(second.name),
      );
  }

  private static groups(input: SecurityAuditInput): SecurityAudit['groups'] {
    const deviceId = String(input.session.deviceId.valueOf());

    return Object.entries(input.groups).map(([communityId, group]) => ({
      communityId,
      epoch: group.epoch.toString(),
      leaves: group.leaves.map(({ owner, signaturePublicKey }) => ({
        deviceId: owner.deviceId,
        identityId: owner.identityId,
        own:
          owner.identityId === input.session.identity.id &&
          owner.deviceId === deviceId,
        signatureKeyFingerprint:
          KeyFingerprint.ofPublicBytes(signaturePublicKey),
      })),
      title:
        input.communities.find((candidate) => candidate.id === communityId)
          ?.name ?? shortId(communityId),
    }));
  }

  private static displayName(
    input: SecurityAuditInput,
    identityId: string,
  ): string {
    const profile = input.identityProfiles[identityId];
    const cached = input.identityNames[identityId]?.trim();
    const handle = input.pins[identityId]?.handle;

    if (profile) return identityName(profile) ?? shortId(identityId);

    if (cached && cached !== identityId) {
      return identityPrimaryDisplayName(cached);
    }

    return handle ? `@${handle}` : shortId(identityId);
  }

  public static from(input: SecurityAuditInput): SecurityAudit {
    return {
      account: SecurityAuditReport.account(input),
      contacts: SecurityAuditReport.contacts(input),
      conversations: Object.values(input.session.keychain.conversations)
        .map((entry) => SecurityAuditReport.conversation(input, entry))
        .sort(
          (first, second) =>
            Number(first.kind === 'community') -
              Number(second.kind === 'community') ||
            first.title.localeCompare(second.title),
        ),
      devices: SecurityAuditReport.devices(input),
      groups: SecurityAuditReport.groups(input),
      outbox: input.outbox.map((item) => ({
        conversationId: item.conversationId,
        createdAt: item.record.createdAt,
        envelopeId: item.id,
        state: item.state,
      })),
    };
  }
}
