import { lazy, Suspense, type ReactElement, type ReactNode } from 'react';

import { copy } from './i18n/en';
import { AppFrame, AppLoadingScreen } from './presentation/app/AppFrame';
import { useAppBootstrap } from './presentation/app/useAppBootstrap';

const AuthScreen = lazy(() =>
  import('./contexts/identities/presentation/auth/AuthScreen').then(
    (module) => ({
      default: module.AuthScreen,
    }),
  ),
);
const GlassWorkspace = lazy(() =>
  import('./components/workspace/GlassWorkspace').then((module) => ({
    default: module.GlassWorkspace,
  })),
);
const NetworkCreationScreen = lazy(() =>
  import('./components/network/NetworkCreationScreen').then((module) => ({
    default: module.NetworkCreationScreen,
  })),
);
const ServerConnectionScreen = lazy(() =>
  import('./components/system/ServerConnectionScreen').then((module) => ({
    default: module.ServerConnectionScreen,
  })),
);

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

function AppScreenSuspense({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <div className="text-xl">{copy.app.loading}</div>
        </div>
      }
    >
      {children}
    </Suspense>
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
        <AppScreenSuspense>
          <ServerConnectionScreen
            error={nodeNetworks.error}
            onRetry={nodeNetworks.reload}
          />
        </AppScreenSuspense>
      </AppFrame>
    );
  }

  if (screen === 'loading') {
    return <AppLoadingScreen label={copy.app.loading} />;
  }

  if (screen === 'network-creation') {
    return (
      <AppFrame>
        <AppScreenSuspense>
          <NetworkCreationScreen onNetworkCreated={handleNetworkCreated} />
        </AppScreenSuspense>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppScreenSuspense>
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
      </AppScreenSuspense>
    </AppFrame>
  );
}

export default App;
