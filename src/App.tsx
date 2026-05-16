import { AuthScreen } from './components/auth/AuthScreen';
import { NetworkCreationScreen } from './components/network/NetworkCreationScreen';
import { ServerConnectionScreen } from './components/system/ServerConnectionScreen';
import { GlassWorkspace } from './components/workspace/GlassWorkspace';
import { copy } from './i18n/en';
import { AppFrame, AppLoadingScreen } from './presentation/app/AppFrame';
import { useAppBootstrap } from './presentation/app/useAppBootstrap';

function App() {
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

  if (nodeNetworks.error && !session) {
    return (
      <AppFrame compact>
        <ServerConnectionScreen
          error={nodeNetworks.error}
          onRetry={nodeNetworks.reload}
        />
      </AppFrame>
    );
  }

  if ((!session && nodeNetworks.loading) || isRestoringSession) {
    return <AppLoadingScreen label={copy.app.loading} />;
  }

  if (!session && nodeNetworks.networks.length === 0 && !nodeNetworks.error) {
    return (
      <AppFrame>
        <NetworkCreationScreen onNetworkCreated={handleNetworkCreated} />
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      {!session ? (
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
