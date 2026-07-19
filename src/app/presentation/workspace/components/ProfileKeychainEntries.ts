import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type {
  Community,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ProfileKeychainDisplayEntry } from './ProfileKeychainDisplayEntry';

import {
  conversationTitle,
  shortId,
} from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';

export class ProfileKeychainEntries {
  private static conversationEntry(input: {
    communities: Community[];
    conversations: ConversationResource[];
    entry: Session['keychain']['conversations'][string];
    entryId: string;
    identityNames: IdentityNames;
    identityProfiles: Record<string, IdentityResource>;
  }): ProfileKeychainDisplayEntry {
    return input.entry.kind === 'community'
      ? ProfileKeychainEntries.communityEntry(input)
      : ProfileKeychainEntries.directConversationEntry(input);
  }

  private static communityEntry(input: {
    communities: Community[];
    entry: Session['keychain']['conversations'][string];
    entryId: string;
  }): ProfileKeychainDisplayEntry {
    const community = input.communities.find(
      (candidate) =>
        candidate.id === input.entry.conversationId ||
        candidate.id === input.entryId,
    );

    return {
      algorithm: input.entry.algorithm,
      id: input.entryId,
      key: input.entry.key,
      sensitive: true,
      subtitle: community?.description || undefined,
      title: `${copy.profile.communityKey} · ${
        community?.name ?? shortId(input.entry.conversationId || input.entryId)
      }`,
    };
  }

  private static directConversationEntry(input: {
    conversations: ConversationResource[];
    entry: Session['keychain']['conversations'][string];
    entryId: string;
    identityNames: IdentityNames;
    identityProfiles: Record<string, IdentityResource>;
  }): ProfileKeychainDisplayEntry {
    const conversation = input.conversations.find(
      (candidate) => candidate.id === input.entry.conversationId,
    );
    const peerIdentity = input.identityProfiles[input.entry.peerIdentityId];
    const peerName = ProfileKeychainEntries.identityName(
      input.entry.peerIdentityId,
      input.identityProfiles,
      input.identityNames,
    );
    const title =
      conversation?.name ??
      conversation?.title ??
      peerIdentity?.profile.name?.trim() ??
      (conversation
        ? conversationTitle({
            ...conversation,
            participantIdentityIds: conversation.participantIdentityIds?.map(
              (identityId) =>
                ProfileKeychainEntries.identityName(
                  identityId,
                  input.identityProfiles,
                  input.identityNames,
                ),
            ),
            peerIdentityId: conversation.peerIdentityId
              ? ProfileKeychainEntries.identityName(
                  conversation.peerIdentityId,
                  input.identityProfiles,
                  input.identityNames,
                )
              : undefined,
          })
        : shortId(input.entry.conversationId));

    return {
      algorithm: input.entry.algorithm,
      id: input.entryId,
      key: input.entry.key,
      sensitive: true,
      subtitle: peerName,
      title: `${copy.profile.conversationKey} · ${title}`,
    };
  }

  private static identityName(
    identityId: string,
    identityProfiles: Record<string, IdentityResource>,
    identityNames: IdentityNames,
  ): string {
    const identity = identityProfiles[identityId];
    const profileName = identity?.profile.name?.trim();
    const handle = identity?.profile.handle?.trim();
    const cachedName = identityNames[identityId]?.trim();

    if (profileName) return profileName;

    if (handle) return `@${handle}`;

    if (cachedName && cachedName !== identityId) {
      return cachedName.replace(/\s+\(@[^)]+\)$/, '');
    }

    return shortId(identityId);
  }

  public static from(input: {
    communities: Community[];
    conversations: ConversationResource[];
    identityNames: IdentityNames;
    identityProfiles: Record<string, IdentityResource>;
    session: Session;
  }): ProfileKeychainDisplayEntry[] {
    return [
      {
        algorithm: copy.profile.identityKeys,
        id: 'identity-master-key',
        key: input.session.identity.encryptedMasterKey,
        subtitle: ProfileKeychainEntries.identityName(
          input.session.identity.id,
          input.identityProfiles,
          input.identityNames,
        ),
        title: copy.profile.encryptedMasterKey,
      },
      {
        algorithm: copy.profile.identityKeys,
        id: 'identity-private-key',
        key: input.session.identity.encryptedKeyPair.encryptedPrivateKey,
        subtitle: ProfileKeychainEntries.identityName(
          input.session.identity.id,
          input.identityProfiles,
          input.identityNames,
        ),
        title: copy.profile.encryptedPrivateKey,
      },
      ...Object.entries(input.session.keychain.conversations).map(
        ([entryId, entry]) =>
          ProfileKeychainEntries.conversationEntry({
            ...input,
            entry,
            entryId,
          }),
      ),
    ];
  }
}
