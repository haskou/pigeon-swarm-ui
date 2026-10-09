import type {
  ChatMessage,
  CommunityPermission,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { CommunityThreadState } from './communityThreadState';
import type { useCommunityThreadActions } from './useCommunityThreadActions';

import {
  profileAnchorFromTarget,
  type ProfilePopoverAnchor,
} from '../../../identities/presentation/view-models/profilePopoverAnchor';
import { MessageThreadPanel } from '../../../messages/presentation/components/MessageThreadPanel';
import { memberDisplayName } from './communityMemberNames';

type CommunityThreadPaneProps = {
  channelName: string;
  communityIsPublic: boolean;
  currentPermissions: Set<CommunityPermission>;
  encryptionAvailable: boolean;
  identityNames: Record<string, string>;
  memberIdentities: Record<string, IdentityResource>;
  memberPictures: Record<string, string>;
  messagesLoading: boolean;
  onAuthorProfileOpen: (
    message: ChatMessage,
    anchor?: ProfilePopoverAnchor,
  ) => void;
  onClose: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onRootMessageOpen: (message: ChatMessage) => void;
  pinnedMessageIds: ReadonlySet<string>;
  session: Session;
  threadActions: ReturnType<typeof useCommunityThreadActions>;
  threadPanel: CommunityThreadState;
};

export function CommunityThreadPane({
  channelName,
  communityIsPublic,
  currentPermissions,
  encryptionAvailable,
  identityNames,
  memberIdentities,
  memberPictures,
  messagesLoading,
  onAuthorProfileOpen,
  onClose,
  onMessageMenuOpen,
  onRootMessageOpen,
  pinnedMessageIds,
  session,
  threadActions,
  threadPanel,
}: CommunityThreadPaneProps) {
  return (
    <MessageThreadPanel
      attachmentEncryptionAvailable={!communityIsPublic && encryptionAvailable}
      currentIdentityId={session.identity.id}
      disabled={
        threadPanel.state === 'loading' ||
        messagesLoading ||
        (!communityIsPublic && !encryptionAvailable) ||
        !currentPermissions.has('send_messages')
      }
      draft={threadPanel.draft}
      editingMessage={threadPanel.editingMessage?.message ?? null}
      embedded
      error={threadPanel.error}
      identityNames={identityNames}
      identityPictures={memberPictures}
      messages={threadPanel.messages}
      onCancelEdit={threadActions.cancelEditing}
      onCancelReply={threadActions.cancelReplying}
      onAuthorProfileOpen={(message, target) =>
        onAuthorProfileOpen(message, profileAnchorFromTarget(target))
      }
      onClose={onClose}
      onDraftChange={threadActions.updateDraft}
      onEdit={threadActions.editMessage}
      onMessageMenuOpen={onMessageMenuOpen}
      onRootMessageOpen={onRootMessageOpen}
      onSend={threadActions.sendMessage}
      onStickerSend={
        currentPermissions.has('send_stickers')
          ? threadActions.sendSticker
          : undefined
      }
      pinnedMessageIds={pinnedMessageIds}
      replyTo={threadPanel.replyTarget}
      replyToAuthorName={
        threadPanel.replyTarget
          ? memberDisplayName(
              memberIdentities[threadPanel.replyTarget.authorIdentityId],
              threadPanel.replyTarget.authorIdentityId,
            )
          : undefined
      }
      rootMessage={threadPanel.root}
      session={session}
      title={`# ${channelName}`}
    />
  );
}
