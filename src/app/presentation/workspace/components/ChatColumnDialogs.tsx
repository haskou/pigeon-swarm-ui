import type { Dispatch, SetStateAction } from 'react';

import { lazy, Suspense } from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ChatConversationPresentation } from './ChatConversationPresentation';
import type { ChatProfileViewer } from './ChatProfileViewer';
import type { ConversationKeyDialogController } from './useConversationKeyDialog';
import type { GroupInvitationDialogController } from './useGroupInvitationDialog';

import { memberPrimaryName } from '../../../../contexts/communities/presentation/components/communityMemberNames';
import { profileAnchorFromTarget } from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';

const ConversationDataDialog = lazy(() =>
  import('./ConversationDataDialog').then((module) => ({
    default: module.ConversationDataDialog,
  })),
);
const ConversationKeyDialog = lazy(() =>
  import('./ConversationKeyDialog').then((module) => ({
    default: module.ConversationKeyDialog,
  })),
);
const EncryptionDetailsDialog = lazy(() =>
  import('./EncryptionDetailsDialog').then((module) => ({
    default: module.EncryptionDetailsDialog,
  })),
);
const GroupInvitationDialog = lazy(() =>
  import('./GroupInvitationDialog').then((module) => ({
    default: module.GroupInvitationDialog,
  })),
);
const GroupProfileDialog = lazy(() =>
  import('./GroupProfileDialog').then((module) => ({
    default: module.GroupProfileDialog,
  })),
);
const UserProfileDialog = lazy(() =>
  import('../../../../contexts/identities/presentation/components/UserProfileDialog').then(
    (module) => ({
      default: module.UserProfileDialog,
    }),
  ),
);

export interface ChatColumnDialogsProps {
  activeConversation?: ConversationResource;
  autoFocus: boolean;
  conversationData: ChatConversationPresentation['conversationData'];
  conversationDataOpen: boolean;
  conversationKeyDialog: ConversationKeyDialogController;
  encryptionDetails: ChatConversationPresentation['encryptionDetails'];
  encryptionDetailsOpen: boolean;
  groupInvitationDialog: GroupInvitationDialogController;
  groupParticipants: ChatConversationPresentation['groupParticipants'];
  groupProfileOpen: boolean;
  networkId?: string;
  nodeNetworks: NodeNetwork[];
  onConversationDataClose: () => void;
  onEncryptionDetailsClose: () => void;
  onGroupProfileClose: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  presenceByIdentityId: Record<string, IdentityPresence>;
  profileViewer: ChatProfileViewer | null;
  session: Session;
  setProfileViewer: Dispatch<SetStateAction<ChatProfileViewer | null>>;
}

function TechnicalDialogs({
  conversationData,
  conversationDataOpen,
  encryptionDetails,
  encryptionDetailsOpen,
  onConversationDataClose,
  onEncryptionDetailsClose,
}: Pick<
  ChatColumnDialogsProps,
  | 'conversationData'
  | 'conversationDataOpen'
  | 'encryptionDetails'
  | 'encryptionDetailsOpen'
  | 'onConversationDataClose'
  | 'onEncryptionDetailsClose'
>) {
  return (
    <>
      {conversationDataOpen && (
        <Suspense fallback={null}>
          <ConversationDataDialog
            data={conversationData}
            onClose={onConversationDataClose}
          />
        </Suspense>
      )}
      {encryptionDetailsOpen && encryptionDetails && (
        <Suspense fallback={null}>
          <EncryptionDetailsDialog
            details={encryptionDetails}
            onClose={onEncryptionDetailsClose}
          />
        </Suspense>
      )}
    </>
  );
}

function InvitationDialogs({
  activeConversation,
  autoFocus,
  conversationKeyDialog,
  groupInvitationDialog,
}: Pick<
  ChatColumnDialogsProps,
  | 'activeConversation'
  | 'autoFocus'
  | 'conversationKeyDialog'
  | 'groupInvitationDialog'
>) {
  return (
    <>
      {groupInvitationDialog.open && activeConversation && (
        <Suspense fallback={null}>
          <GroupInvitationDialog
            autoFocus={autoFocus}
            error={groupInvitationDialog.error}
            input={groupInvitationDialog.input}
            loading={groupInvitationDialog.loading}
            onClose={groupInvitationDialog.close}
            onInputChange={groupInvitationDialog.setInput}
            onSubmit={(event) => void groupInvitationDialog.submit(event)}
          />
        </Suspense>
      )}
      {conversationKeyDialog.mode && (
        <Suspense fallback={null}>
          <ConversationKeyDialog
            encryptedConversationKey={conversationKeyDialog.encryptedKey}
            error={conversationKeyDialog.error}
            input={conversationKeyDialog.input}
            mode={conversationKeyDialog.mode}
            onClose={conversationKeyDialog.close}
            onCopy={() => void conversationKeyDialog.copy()}
            onImport={() => void conversationKeyDialog.importKey()}
            onInputChange={conversationKeyDialog.setInput}
            saving={conversationKeyDialog.saving}
          />
        </Suspense>
      )}
    </>
  );
}

function ProfileDialogs({
  activeConversation,
  groupParticipants,
  groupProfileOpen,
  networkId,
  nodeNetworks,
  onGroupProfileClose,
  onOpenConversationWithIdentity,
  presenceByIdentityId,
  profileViewer,
  session,
  setProfileViewer,
}: Pick<
  ChatColumnDialogsProps,
  | 'activeConversation'
  | 'groupParticipants'
  | 'groupProfileOpen'
  | 'networkId'
  | 'nodeNetworks'
  | 'onGroupProfileClose'
  | 'onOpenConversationWithIdentity'
  | 'presenceByIdentityId'
  | 'profileViewer'
  | 'session'
  | 'setProfileViewer'
>) {
  return (
    <>
      {profileViewer && (
        <Suspense fallback={null}>
          <UserProfileDialog
            anchor={profileViewer.anchor}
            identity={profileViewer.identity}
            identityId={profileViewer.identityId}
            name={profileViewer.name}
            nodeNetworks={nodeNetworks}
            onClose={() => setProfileViewer(null)}
            presence={presenceByIdentityId[profileViewer.identityId]}
            onOpenConversation={
              profileViewer.identityId === session.identity.id ||
              !onOpenConversationWithIdentity
                ? undefined
                : () =>
                    onOpenConversationWithIdentity(
                      profileViewer.identityId,
                      profileViewer.identity,
                    )
            }
            picture={profileViewer.picture}
          />
        </Suspense>
      )}
      {groupProfileOpen && activeConversation && (
        <Suspense fallback={null}>
          <GroupProfileDialog
            conversation={activeConversation}
            networkId={networkId}
            nodeNetworks={nodeNetworks}
            onClose={onGroupProfileClose}
            onIdentityClick={(participant, event) => {
              onGroupProfileClose();
              setProfileViewer({
                anchor: profileAnchorFromTarget(event.currentTarget),
                identity: participant.identity,
                identityId: participant.identityId,
                name:
                  participant.name ??
                  memberPrimaryName(
                    participant.identity,
                    participant.identityId,
                  ),
                picture: participant.picture,
              });
            }}
            participants={groupParticipants}
            presenceByIdentityId={presenceByIdentityId}
          />
        </Suspense>
      )}
    </>
  );
}

export function ChatColumnDialogs({
  activeConversation,
  autoFocus,
  conversationData,
  conversationDataOpen,
  conversationKeyDialog,
  encryptionDetails,
  encryptionDetailsOpen,
  groupInvitationDialog,
  groupParticipants,
  groupProfileOpen,
  networkId,
  nodeNetworks,
  onConversationDataClose,
  onEncryptionDetailsClose,
  onGroupProfileClose,
  onOpenConversationWithIdentity,
  presenceByIdentityId,
  profileViewer,
  session,
  setProfileViewer,
}: ChatColumnDialogsProps) {
  return (
    <>
      <TechnicalDialogs
        conversationData={conversationData}
        conversationDataOpen={conversationDataOpen}
        encryptionDetails={encryptionDetails}
        encryptionDetailsOpen={encryptionDetailsOpen}
        onConversationDataClose={onConversationDataClose}
        onEncryptionDetailsClose={onEncryptionDetailsClose}
      />
      <InvitationDialogs
        activeConversation={activeConversation}
        autoFocus={autoFocus}
        conversationKeyDialog={conversationKeyDialog}
        groupInvitationDialog={groupInvitationDialog}
      />
      <ProfileDialogs
        activeConversation={activeConversation}
        groupParticipants={groupParticipants}
        groupProfileOpen={groupProfileOpen}
        networkId={networkId}
        nodeNetworks={nodeNetworks}
        onGroupProfileClose={onGroupProfileClose}
        onOpenConversationWithIdentity={onOpenConversationWithIdentity}
        presenceByIdentityId={presenceByIdentityId}
        profileViewer={profileViewer}
        session={session}
        setProfileViewer={setProfileViewer}
      />
    </>
  );
}
