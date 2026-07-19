import type {
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { SidebarConversationLoadingState } from './SidebarConversationLoadingState';

import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import {
  conversationTitle,
  shortId,
} from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';

export class SidebarConversation {
  public readonly handle: string;

  public readonly loading: SidebarConversationLoadingState;

  public readonly peerIdentityId?: string;

  public readonly pictureUrl?: string;

  public readonly title: string;

  public constructor(
    public readonly resource: ConversationResource,
    currentIdentityId: string,
    keychain: Session['keychain'],
    identityNames: IdentityNames,
    identityPictures: IdentityPictures,
    identityProfiles: Record<string, IdentityResource>,
  ) {
    this.peerIdentityId = ConversationPeer.identityId(
      resource,
      currentIdentityId,
      keychain,
    );
    this.title = this.resolveTitle(identityNames, identityProfiles);
    this.handle = this.resolveHandle(identityProfiles);
    this.pictureUrl = this.isGroup()
      ? undefined
      : this.peerIdentityId
        ? identityPictures[this.peerIdentityId]
        : undefined;
    this.loading = this.resolveLoading(
      identityNames,
      identityPictures,
      identityProfiles,
    );
  }

  private isGroup(): boolean {
    return (
      this.resource.type === 'group' || this.resource.id.startsWith('group:')
    );
  }

  private participantCount(): number {
    return (
      this.resource.participantIdentityIds ??
      this.resource.participantIds ??
      this.resource.participants ??
      []
    ).length;
  }

  private resolveHandle(
    identityProfiles: Record<string, IdentityResource>,
  ): string {
    if (this.isGroup()) {
      return `${this.participantCount()} ${copy.sidebar.members}`;
    }

    const peerHandle = this.peerIdentityId
      ? identityProfiles[this.peerIdentityId]?.profile.handle?.trim()
      : undefined;

    return peerHandle
      ? `@${peerHandle}`
      : this.peerIdentityId
        ? shortId(this.peerIdentityId)
        : conversationTitle(this.resource);
  }

  private resolveLoading(
    identityNames: IdentityNames,
    identityPictures: IdentityPictures,
    identityProfiles: Record<string, IdentityResource>,
  ): SidebarConversationLoadingState {
    const loaded = { avatar: false, subtitle: false, title: false };

    if (this.isGroup() || !this.peerIdentityId) return loaded;

    if (identityProfiles[this.peerIdentityId]) return loaded;

    const identityName = identityNames[this.peerIdentityId];
    const hasKnownName = !!identityName && identityName !== this.peerIdentityId;

    return {
      avatar: !identityPictures[this.peerIdentityId],
      subtitle: true,
      title: !hasKnownName,
    };
  }

  private resolveTitle(
    identityNames: IdentityNames,
    identityProfiles: Record<string, IdentityResource>,
  ): string {
    if (this.isGroup()) {
      return this.resource.name ?? this.resource.title ?? this.resource.id;
    }

    const peerProfile = this.peerIdentityId
      ? identityProfiles[this.peerIdentityId]?.profile
      : undefined;
    const peerName = peerProfile?.name.trim();
    const peerHandle = peerProfile?.handle?.trim();

    return peerName
      ? peerName
      : peerHandle
        ? `@${peerHandle}`
        : this.peerIdentityId
          ? identityDisplayName(this.peerIdentityId, identityNames)
          : conversationTitle(this.resource);
  }

  public matches(query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return true;

    return [
      this.resource.id,
      this.title,
      this.handle,
      this.peerIdentityId ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  }
}
