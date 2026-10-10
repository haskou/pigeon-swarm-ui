import { lazy, Suspense, type ReactElement, type ReactNode } from 'react';

import { copy } from '../shared/presentation/i18n/copy';
import { AppFrame } from './presentation/AppFrame';
import { useAppBootstrap } from './presentation/useAppBootstrap';
import { loadGlassWorkspaceModule } from './presentation/workspace/loadGlassWorkspaceModule';

const AuthScreen = lazy(() =>
  import('../contexts/identities/presentation/auth/AuthScreen').then(
    (module) => ({
      default: module.AuthScreen,
    }),
  ),
);
const GlassWorkspace = lazy(() =>
  loadGlassWorkspaceModule().then((module) => ({
    default: module.GlassWorkspace,
  })),
);
const NetworkCreationScreen = lazy(() =>
  import('../contexts/networks/presentation/components/NetworkCreationScreen').then(
    (module) => ({
      default: module.NetworkCreationScreen,
    }),
  ),
);
const ServerConnectionScreen = lazy(() =>
  import('./presentation/components/ServerConnectionScreen').then((module) => ({
    default: module.ServerConnectionScreen,
  })),
);

type AppScreen =
  | 'auth'
  | 'network-creation'
  | 'server-connection'
  | 'workspace';

function screenFrom(input: {
  hasNetworkError: boolean;
  isLoadingNetworks: boolean;
  networkCount: number;
  sessionPresent: boolean;
}): AppScreen {
  if (isServerConnectionScreen(input)) {
    return 'server-connection';
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

function isNetworkCreationScreen(input: {
  hasNetworkError: boolean;
  isLoadingNetworks: boolean;
  networkCount: number;
  sessionPresent: boolean;
}): boolean {
  return (
    !input.sessionPresent &&
    !input.isLoadingNetworks &&
    input.networkCount === 0 &&
    !input.hasNetworkError
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

  if (screen === 'network-creation') {
    return (
      <AppFrame>
        <AppScreenSuspense>
          <NetworkCreationScreen
            nodeOwnerId={nodeNetworks.node?.owner ?? null}
            onNetworkCreated={handleNetworkCreated}
          />
        </AppScreenSuspense>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppScreenSuspense>
        {screen === 'auth' || !session ? (
          <AuthScreen
            availableNetworks={nodeNetworks.networks}
            ipfsPeerCount={peers.ipfsPeerCount}
            networkSynchronizationStatus={peers.networkSynchronizationStatus}
            nodeOwnerId={nodeNetworks.node?.owner ?? null}
            onAuthenticated={handleAuthenticated}
            peersLoading={peers.loading}
          />
        ) : (
          <GlassWorkspace
            session={session}
            node={nodeNetworks.node}
            nodeNetworks={nodeNetworks.networks}
            onNodeNetworksReload={nodeNetworks.reload}
            onPeersReload={peers.reload}
            peersLoading={peers.loading}
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
            communitiesError={communities.error}
            communitiesLoading={communities.loading}
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
