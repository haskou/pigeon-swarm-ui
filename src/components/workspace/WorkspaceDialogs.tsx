import type {
  ChatMessage,
  Community,
  ConversationResource,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../domain/types';
import type {
  CallParticipant,
  CallResource,
} from '../../domain/calls/CallSession';
import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { Peer } from '../../application/peers/ListPeers';

import { copy } from '../../i18n/en';
import type { RealtimeDomainEvent } from '../../infrastructure/realtime/RealtimeGateway';
import { IncomingCallDialog } from '../calls/IncomingCallDialog';
import { CreateCommunityDialog } from '../community/CreateCommunityDialog';
import { CreateConversationDialog } from '../dialog/CreateConversationDialog';
import { Inspector } from './Inspector';
import {
  MessageContextMenu,
  type MessageContextMenuState,
} from './MessageContextMenu';
import { NodeSettingsDialog } from './NodeSettingsDialog';
import { NotificationsPanel } from './NotificationsPanel';
import { RawMessageDialog } from './RawMessageDialog';
import { RealtimeEventsDialog } from './RealtimeEventsDialog';

interface WorkspaceDialogsProps {
  activeConversation?: ConversationResource;
  archiveNotification: (notificationId: string) => void;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  incomingCall: {
    call: CallResource;
    caller?: CallParticipant;
    participants: CallParticipant[];
    title: string;
  } | null;
  inspectorOpen: boolean;
  isCreateCommunityOpen: boolean;
  isCreateOpen: boolean;
  messageContextMenu: MessageContextMenuState | null;
  messages: ChatMessage[];
  node: { id: string; owner: null | string } | null;
  nodeNetworks: NodeNetwork[];
  nodeSettingsOpen: boolean;
  notificationAction: 'accept' | 'archive' | 'decline' | 'refresh' | null;
  notificationError: string | null;
  notificationsOpen: boolean;
  peers: Peer[];
  rawMessage: ChatMessage | null;
  realtimeEventLog: RealtimeDomainEvent[];
  realtimeEventsOpen: boolean;
  session: Session;
  visibleNotifications: NotificationResource[];
  onAcceptIncomingCall: () => void;
  onAcceptNotification: (notification: NotificationResource) => void;
  onCloseCreateCommunity: () => void;
  onCloseCreateConversation: () => void;
  onCloseInspector: () => void;
  onCloseMessageContextMenu: () => void;
  onCloseNodeSettings: () => void;
  onCloseNotifications: () => void;
  onCloseRawMessage: () => void;
  onCloseRealtimeEvents: () => void;
  onCommunityCreated: (input: {
    community: Community;
    session: Session;
  }) => void;
  onConversationCreated: (
    nextSession: Session,
    conversation: ConversationResource,
  ) => void;
  onDeclineIncomingCall: () => void;
  onDeclineNotification: (notificationId: string) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onNetworksUpdated: () => Promise<void>;
  onReplyToMessage: (message: ChatMessage) => void;
  onToggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onViewRawMessage: (message: ChatMessage) => void;
}

export function WorkspaceDialogs(props: WorkspaceDialogsProps) {
  const contextMenuMessage = props.messageContextMenu?.message;

  return (
    <>
      {props.inspectorOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/50 xl:hidden"
            onClick={props.onCloseInspector}
            aria-label={copy.dialog.close}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[360px] p-3 xl:hidden">
            <Inspector
              className="h-full overflow-y-auto"
              session={props.session}
              activeConversation={props.activeConversation}
              messages={props.messages}
              onClose={props.onCloseInspector}
              peers={props.peers}
            />
          </div>
        </>
      )}

      {props.messageContextMenu && (
        <MessageContextMenu
          currentIdentityId={props.session.identity.id}
          menu={props.messageContextMenu}
          onClose={props.onCloseMessageContextMenu}
          onDelete={
            contextMenuMessage?.authorIdentityId === props.session.identity.id
              ? () => props.onDeleteMessage(contextMenuMessage)
              : undefined
          }
          onReply={() => {
            if (contextMenuMessage) props.onReplyToMessage(contextMenuMessage);
          }}
          onReactionToggle={props.onToggleReaction}
          onViewRaw={() => {
            if (contextMenuMessage) props.onViewRawMessage(contextMenuMessage);
          }}
        />
      )}

      {props.rawMessage && (
        <RawMessageDialog
          message={props.rawMessage}
          onClose={props.onCloseRawMessage}
        />
      )}

      {props.isCreateOpen && (
        <CreateConversationDialog
          nodeNetworks={props.nodeNetworks}
          session={props.session}
          onClose={props.onCloseCreateConversation}
          onCreated={props.onConversationCreated}
        />
      )}

      {props.isCreateCommunityOpen && (
        <CreateCommunityDialog
          nodeNetworks={props.nodeNetworks}
          session={props.session}
          onClose={props.onCloseCreateCommunity}
          onCreated={props.onCommunityCreated}
        />
      )}

      {props.notificationsOpen && (
        <NotificationsPanel
          action={props.notificationAction}
          communities={props.communities}
          communityAvatarUrls={props.communityAvatarUrls}
          communityPreviews={props.communityPreviews}
          conversations={props.conversations}
          error={props.notificationError}
          identityNames={props.identityNames}
          identityPictures={props.identityPictures}
          identityProfiles={props.identityProfiles}
          notifications={props.visibleNotifications}
          onAccept={props.onAcceptNotification}
          onArchive={props.archiveNotification}
          onClose={props.onCloseNotifications}
          onDecline={props.onDeclineNotification}
        />
      )}

      {props.nodeSettingsOpen && (
        <NodeSettingsDialog
          networks={props.nodeNetworks}
          node={props.node}
          onClose={props.onCloseNodeSettings}
          onNetworksUpdated={props.onNetworksUpdated}
          session={props.session}
        />
      )}

      {props.realtimeEventsOpen && (
        <RealtimeEventsDialog
          events={props.realtimeEventLog}
          onClose={props.onCloseRealtimeEvents}
        />
      )}

      {props.incomingCall && (
        <IncomingCallDialog
          caller={props.incomingCall.caller}
          onAccept={props.onAcceptIncomingCall}
          onDecline={props.onDeclineIncomingCall}
          title={props.incomingCall.title}
        />
      )}
    </>
  );
}
