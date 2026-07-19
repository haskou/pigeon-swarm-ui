import { Suspense, type ReactElement } from 'react';

import type { MessagesWorkspaceContentProps } from './MessagesWorkspaceContentProps';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { ConversationWorkspaceContent } from './ConversationWorkspaceContent';
import { Rail } from './Rail';
import {
  Inspector,
  InspectorStartupFallback,
  Sidebar,
  SidebarStartupFallback,
} from './workspaceLazyComponents';

export function MessagesWorkspaceContent(
  props: MessagesWorkspaceContentProps,
): ReactElement {
  const {
    activeConversation,
    activeConversationPeerIdentityId,
    callControls,
    communities,
    conversationNotificationSettingFor,
    conversationsWithUnread,
    identityNames,
    identityPictures,
    identityProfiles,
    nodeNetworks,
    onConversationNotificationMuteToggle,
    onConversationNotificationSettingsOpen,
    onConversationSelected,
    onCreateConversation,
    onGroupInviteOpen,
    onInspectorOpen,
    onLogout,
    onOpenConversationWithIdentity,
    onPresenceChange,
    onPresenceStatusSelected,
    onSessionUpdated,
    onSidebarClose,
    presenceByIdentityId,
    railProps,
    session,
    sidebarOpen,
  } = props;

  return (
    <>
      <div
        className={cx(
          'app-safe-area-drawer-until-lg app-safe-area-drawer-flush fixed inset-y-0 left-0 z-40 block w-[92vw] max-w-[430px] p-0 transition-transform duration-200 ease-out sm:w-[calc(86vw+82px)] sm:max-w-[442px] lg:static lg:block lg:w-auto lg:max-w-none lg:translate-x-0',
          sidebarOpen
            ? 'translate-x-0'
            : 'pointer-events-none -translate-x-full lg:pointer-events-auto',
        )}
      >
        <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-0 lg:block">
          <Rail
            {...railProps}
            className="lg:hidden"
            onInspectorClick={onInspectorOpen}
          />
          <Suspense fallback={<SidebarStartupFallback />}>
            <Sidebar
              activeCall={callControls.activeCall}
              activeConversationId={activeConversation?.id ?? null}
              animationScopeKey={sidebarOpen ? 'open' : 'closed'}
              communities={communities}
              conversationNotificationSetting={
                conversationNotificationSettingFor
              }
              conversations={conversationsWithUnread}
              identityNames={identityNames}
              identityPictures={identityPictures}
              identityProfiles={identityProfiles}
              nodeNetworks={nodeNetworks}
              onCallEnd={callControls.leaveActiveCall}
              onCallParticipantScreenShareVolumeChange={
                callControls.setParticipantScreenShareVolume
              }
              onCallParticipantVolumeChange={callControls.setParticipantVolume}
              onCallRetryMicrophone={callControls.retryMicrophone}
              onCallScreenShareQualityChange={
                callControls.setScreenShareQuality
              }
              onCallToggleCamera={callControls.toggleCamera}
              onCallToggleDeafen={callControls.toggleDeafen}
              onCallToggleMediaEncryption={
                callControls.toggleCallMediaEncryption
              }
              onCallToggleMute={callControls.toggleMute}
              onCallToggleNoiseCancellation={
                callControls.toggleCallNoiseCancellation
              }
              onCallToggleScreenShare={callControls.toggleScreenShare}
              onConversationNotificationMuteToggle={
                onConversationNotificationMuteToggle
              }
              onConversationNotificationSettingsOpen={
                onConversationNotificationSettingsOpen
              }
              onCreate={onCreateConversation}
              onLogout={onLogout}
              onPresenceChange={onPresenceChange}
              onPresenceStatusSelected={onPresenceStatusSelected}
              onSelect={(conversationId) => {
                onConversationSelected(conversationId);
                onSidebarClose();
              }}
              onSessionUpdated={onSessionUpdated}
              presenceByIdentityId={presenceByIdentityId}
              session={session}
            />
          </Suspense>
        </div>
      </div>

      <button
        aria-label={copy.workspace.closeSidebar}
        className={cx(
          'fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 lg:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onSidebarClose}
      />

      <ConversationWorkspaceContent {...props} />

      <Suspense fallback={<InspectorStartupFallback />}>
        <Inspector
          activeConversation={activeConversation}
          activeConversationPeerIdentityId={activeConversationPeerIdentityId}
          className="hidden xl:block"
          identityNames={identityNames}
          identityPictures={identityPictures}
          identityProfiles={identityProfiles}
          nodeNetworks={nodeNetworks}
          onGroupInviteOpen={onGroupInviteOpen}
          onOpenConversationWithIdentity={onOpenConversationWithIdentity}
          presenceByIdentityId={presenceByIdentityId}
          session={session}
        />
      </Suspense>
    </>
  );
}
