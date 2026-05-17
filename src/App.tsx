import type { ReactElement } from 'react';

import { AuthScreen } from './components/auth/AuthScreen';
import { NetworkCreationScreen } from './components/network/NetworkCreationScreen';
import { ServerConnectionScreen } from './components/system/ServerConnectionScreen';
import { GlassWorkspace } from './components/workspace/GlassWorkspace';
import { copy } from './i18n/en';
import { AppFrame, AppLoadingScreen } from './presentation/app/AppFrame';
import { useAppBootstrap } from './presentation/app/useAppBootstrap';

type AppScreen =
  | 'auth'
  | 'loading'
  | 'network-creation'
  | 'server-connection'
  | 'workspace';

function screenFrom(input: {
  hasNetworkError: boolean;
  isLoadingNetworks: boolean;
  isRestoringSession: boolean;
  networkCount: number;
  sessionPresent: boolean;
}): AppScreen {
  if (isServerConnectionScreen(input)) {
    return 'server-connection';
  }

  if (isLoadingScreen(input)) {
    return 'loading';
  }

  if (isNetworkCreationScreen(input)) {
    return 'network-creation';
  }

  return input.sessionPresent ? 'workspace' : 'auth';
}

function isServerConnectionScreen(input: {
  hasNetworkError: boolean;
  sessionPresent: boolean;
}): boolean {
  return input.hasNetworkError && !input.sessionPresent;
}

function isLoadingScreen(input: {
  isLoadingNetworks: boolean;
  isRestoringSession: boolean;
  sessionPresent: boolean;
}): boolean {
  return (
    (!input.sessionPresent && input.isLoadingNetworks) ||
    input.isRestoringSession
  );
}

function isNetworkCreationScreen(input: {
  hasNetworkError: boolean;
  networkCount: number;
  sessionPresent: boolean;
}): boolean {
  return (
    !input.sessionPresent && input.networkCount === 0 && !input.hasNetworkError
  );
}

function App(): ReactElement {
  const bootstrap = useAppBootstrap();
  const {
    clearSession,
    communities,
    conversations,
    handleAuthenticated,
    handleNetworkCreated,
    isRestoringSession,
    nodeNetworks,
    peers,
    pendingCommunityInvite,
    session,
    setCommunities,
    setConversations,
    setPendingCommunityInviteHandled,
    setSession,
  } = bootstrap;

  const screen = screenFrom({
    hasNetworkError: !!nodeNetworks.error,
    isLoadingNetworks: nodeNetworks.loading,
    isRestoringSession,
    networkCount: nodeNetworks.networks.length,
    sessionPresent: !!session,
  });

  if (screen === 'server-connection' && nodeNetworks.error) {
    return (
      <AppFrame compact>
        <ServerConnectionScreen
          error={nodeNetworks.error}
          onRetry={nodeNetworks.reload}
        />
      </AppFrame>
    );
  }

  if (screen === 'loading') {
    return <AppLoadingScreen label={copy.app.loading} />;
  }

  if (screen === 'network-creation') {
    return (
      <AppFrame>
        <NetworkCreationScreen onNetworkCreated={handleNetworkCreated} />
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      {screen === 'auth' || !session ? (
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          peerCount={peers.peers.length}
        />
      ) : (
        <GlassWorkspace
          session={session}
          node={nodeNetworks.node}
          nodeNetworks={nodeNetworks.networks}
          onNodeNetworksReload={nodeNetworks.reload}
          onPeersReload={peers.reload}
          peers={peers.peers}
          setSession={(nextSession) => {
            if (!nextSession) {
              clearSession();

              return;
            }

            setSession(nextSession);
          }}
          conversations={conversations}
          communities={communities.communities}
          onCommunitiesReload={communities.reload}
          setCommunities={setCommunities}
          setConversations={setConversations}
          pendingCommunityInvite={pendingCommunityInvite}
          onPendingCommunityInviteHandled={setPendingCommunityInviteHandled}
        />
      )}
    </AppFrame>
  );
}

export default App;
