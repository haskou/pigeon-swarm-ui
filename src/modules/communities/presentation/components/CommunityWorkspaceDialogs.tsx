import { lazy, Suspense } from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type {
  ChatMessage,
  Community,
  CommunityPermission,
  IdentityPresence,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';
import type { ProfilePopoverAnchor } from '../../../identities/presentation/view-models/profilePopoverAnchor';

import { MessageEditPolicy } from '../../../messages/domain/MessageEditPolicy';
import { CommunityAccessPolicy } from '../../domain/CommunityAccessPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { memberPrimaryName } from './communityMemberNames';
import type { CommunityMemberListItem } from './communityMembersPanel';

const AddCommunityMemberDialog = lazy(() =>
  import('./AddCommunityMemberDialog').then((module) => ({
    default: module.AddCommunityMemberDialog,
  })),
);
const ConversationDataDialog = lazy(() =>
  import('../../../../app/presentation/workspace/components/ConversationDataDialog').then(
    (module) => ({
      default: module.ConversationDataDialog,
    }),
  ),
);
const ConversationKeyDialog = lazy(() =>
  import('../../../../app/presentation/workspace/components/ConversationKeyDialog').then(
    (module) => ({
      default: module.ConversationKeyDialog,
    }),
  ),
);
const ImageLightbox = lazy(() =>
  import('../../../messages/presentation/components/imageLightbox').then(
    (module) => ({
      default: module.ImageLightbox,
    }),
  ),
);
const ManageCommunityDialog = lazy(() =>
  import('./ManageCommunityDialog').then((module) => ({
    default: module.ManageCommunityDialog,
  })),
);
const MessageContextMenu = lazy(() =>
  import('../../../../app/presentation/workspace/components/messageContextMenu').then(
    (module) => ({
      default: module.MessageContextMenu,
    }),
  ),
);
const RawMessageDialog = lazy(() =>
  import('../../../../app/presentation/workspace/components/RawMessageDialog').then(
    (module) => ({
      default: module.RawMessageDialog,
    }),
  ),
);
const UserProfileDialog = lazy(() =>
  import('../../../identities/presentation/components/UserProfileDialog').then(
    (module) => ({
      default: module.UserProfileDialog,
    }),
  ),
);

export type CommunityProfileView = CommunityMemberListItem & {
  anchor?: ProfilePopoverAnchor;
};

type CommunityWorkspaceDialogsProps = {
  bannerUrl: string | null;
  bannerViewerOpen: boolean;
  community: Community;
  communityData: unknown;
  communityDataOpen: boolean;
  communityKeyDialog: 'add' | 'copy' | null;
  communityKeyEncrypted: string;
  communityKeyError: string | null;
  communityKeyInput: string;
  communityKeySaving: boolean;
  currentIdentityId: string;
  currentPermissions: Set<CommunityPermission>;
  manageOpen: boolean;
  memberOpen: boolean;
  messageContextMenu: MessageContextMenuState | null;
  nodeNetworks: NodeNetwork[];
  owner: boolean;
  presenceByIdentityId: Record<string, IdentityPresence>;
  profileViewer: CommunityProfileView | null;
  rawMessage: ChatMessage | null;
  session: Session;
  onCloseBannerViewer: () => void;
  onCloseCommunityData: () => void;
  onCloseCommunityKey: () => void;
  onCloseManage: () => void;
  onCloseMember: () => void;
  onCloseMessageContextMenu: () => void;
  onCloseProfile: () => void;
  onCloseRawMessage: () => void;
  onCommunityKeyCopy: () => void;
  onCommunityKeyImport: () => void;
  onCommunityKeyInputChange: (value: string) => void;
  onCommunityUpdated: (community: Community) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onEditMessage: (message: ChatMessage) => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onReplyToMessage: (message: ChatMessage) => void;
  onSessionUpdated: (session: Session) => void;
  onToggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onViewRawMessage: (message: ChatMessage) => void;
};

export function CommunityWorkspaceDialogs({
  bannerUrl,
  bannerViewerOpen,
  community,
  communityData,
  communityDataOpen,
  communityKeyDialog,
  communityKeyEncrypted,
  communityKeyError,
  communityKeyInput,
  communityKeySaving,
  currentIdentityId,
  currentPermissions,
  manageOpen,
  memberOpen,
  messageContextMenu,
  nodeNetworks,
  owner,
  presenceByIdentityId,
  profileViewer,
  rawMessage,
  session,
  onCloseBannerViewer,
  onCloseCommunityData,
  onCloseCommunityKey,
  onCloseManage,
  onCloseMember,
  onCloseMessageContextMenu,
  onCloseProfile,
  onCloseRawMessage,
  onCommunityKeyCopy,
  onCommunityKeyImport,
  onCommunityKeyInputChange,
  onCommunityUpdated,
  onDeleteMessage,
  onEditMessage,
  onOpenConversationWithIdentity,
  onReplyToMessage,
  onSessionUpdated,
  onToggleReaction,
  onViewRawMessage,
}: CommunityWorkspaceDialogsProps) {
  return (
    <Suspense fallback={null}>
      {bannerViewerOpen && bannerUrl && (
        <ImageLightbox
          images={[
            {
              alt: community.name,
              filename: community.banner ?? community.name,
              url: bannerUrl,
            },
          ]}
          initialIndex={0}
          onClose={onCloseBannerViewer}
        />
      )}
      {manageOpen && (
        <ManageCommunityDialog
          community={community}
          onClose={onCloseManage}
          onCommunityUpdated={onCommunityUpdated}
          session={session}
        />
      )}
      {memberOpen && (
        <AddCommunityMemberDialog
          communityId={community.id}
          onClose={onCloseMember}
          onSessionUpdated={onSessionUpdated}
          session={session}
        />
      )}
      {profileViewer && (
        <UserProfileDialog
          anchor={profileViewer.anchor}
          communityRoles={communityRoleNamesForIdentity(
            community,
            profileViewer.identityId,
          )}
          identity={profileViewer.identity}
          identityId={profileViewer.identityId}
          name={memberPrimaryName(
            profileViewer.identity,
            profileViewer.identityId,
          )}
          nodeNetworks={nodeNetworks}
          onClose={onCloseProfile}
          onOpenConversation={
            profileViewer.identityId === currentIdentityId ||
            !onOpenConversationWithIdentity
              ? undefined
              : () =>
                  onOpenConversationWithIdentity(
                    profileViewer.identityId,
                    profileViewer.identity,
                  )
          }
          picture={profileViewer.pictureUrl}
          presence={presenceByIdentityId[profileViewer.identityId]}
        />
      )}
      {messageContextMenu && (
        <MessageContextMenu
          currentIdentityId={currentIdentityId}
          menu={messageContextMenu}
          onClose={onCloseMessageContextMenu}
          onDelete={
            messageContextMenu.message.kind !== 'poll' &&
            (messageContextMenu.message.mine ||
              owner ||
              currentPermissions.has('manage_messages'))
              ? () => onDeleteMessage(messageContextMenu.message)
              : undefined
          }
          onEdit={
            MessageEditPolicy.canEdit(messageContextMenu.message, currentIdentityId)
              ? () => onEditMessage(messageContextMenu.message)
              : undefined
          }
          onReply={() => onReplyToMessage(messageContextMenu.message)}
          onReactionToggle={onToggleReaction}
          onViewRaw={() => onViewRawMessage(messageContextMenu.message)}
        />
      )}
      {rawMessage && (
        <RawMessageDialog message={rawMessage} onClose={onCloseRawMessage} />
      )}
      {communityDataOpen && (
        <ConversationDataDialog
          data={communityData}
          onClose={onCloseCommunityData}
          title={copy.communities.communityDataTitle}
        />
      )}
      {communityKeyDialog && (
        <ConversationKeyDialog
          encryptedConversationKey={communityKeyEncrypted}
          error={communityKeyError}
          input={communityKeyInput}
          mode={communityKeyDialog}
          onClose={onCloseCommunityKey}
          onCopy={onCommunityKeyCopy}
          onImport={onCommunityKeyImport}
          onInputChange={onCommunityKeyInputChange}
          saving={communityKeySaving}
        />
      )}
    </Suspense>
  );
}

function communityRoleNamesForIdentity(
  community: Community,
  identityId: string,
): string[] {
  const roleNames = new Set<string>();

  if (community.ownerIdentityId === identityId) {
    roleNames.add(copy.communities.owner);
  }

  for (const role of CommunityAccessPolicy.assignedRolesFor(
    community,
    identityId,
  )) {
    roleNames.add(role.name);
  }

  return [...roleNames];
}
