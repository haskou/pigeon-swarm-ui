import { useEffect, useState } from 'react';

import type { ConversationResource, Session } from './domain/types';

import { pigeonApplication } from './application/applicationContainer';
import { AuthScreen } from './components/auth/AuthScreen';
import { BackgroundGlow } from './components/BackgroundGlow';
import { NetworkCreationScreen } from './components/network/NetworkCreationScreen';
import { ServerConnectionScreen } from './components/system/ServerConnectionScreen';
import { GlassWorkspace } from './components/workspace/GlassWorkspace';
import { copy } from './i18n/en';
import {
  clearSavedCredentials,
  loadSavedCredentials,
} from './presentation/auth/savedCredentials';
import { useCommunities } from './presentation/hooks/useCommunities';
import { useNodeNetworks } from './presentation/hooks/useNodeNetworks';
import { usePeers } from './presentation/hooks/usePeers';

type RestoreState = 'idle' | 'loading' | 'done';

function App() {
  const [hasSavedCredentials] = useState(() => loadSavedCredentials() !== null);
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );
  const [restoreState, setRestoreState] = useState<RestoreState>(
    hasSavedCredentials ? 'loading' : 'done',
  );
  const nodeNetworks = useNodeNetworks(session);
  const peers = usePeers();
  const communities = useCommunities(session);

  const handleAuthenticated = (
    nextSession: Session,
    nextConversations: ConversationResource[],
  ) => {
    setSession(nextSession);
    setConversations(nextConversations);
  };

  useEffect(() => {
    if (nodeNetworks.loading || nodeNetworks.error || session) return;
    if (nodeNetworks.networks.length === 0) return;
    if (restoreState !== 'loading') return;

    const savedCredentials = loadSavedCredentials();

    if (!savedCredentials) {
      setRestoreState('done');
      return;
    }

    void pigeonApplication
      .login(savedCredentials.identityId, savedCredentials.password)
      .then((result) => {
        handleAuthenticated(result.session, result.conversations);
        setRestoreState('done');
      })
      .catch(() => {
        setRestoreState('done');
      });
  }, [nodeNetworks, restoreState, session]);

  const handleNetworkCreated = () => {
    window.location.reload();
  };

  if (nodeNetworks.error && !session) {
    return (
      <main className="app-viewport relative overflow-hidden bg-[#080a25] text-white">
        <BackgroundGlow />
        <ServerConnectionScreen
          error={nodeNetworks.error}
          onRetry={nodeNetworks.reload}
        />
      </main>
    );
  }

  // If we're still loading, show a loading state
  if ((!session && nodeNetworks.loading) || restoreState === 'loading') {
    return (
      <main className="app-viewport relative flex items-center justify-center overflow-hidden bg-[#080a25] text-white">
        <BackgroundGlow />
        <div className="text-xl">{copy.app.loading}</div>
      </main>
    );
  }

  if (!session && nodeNetworks.networks.length === 0 && !nodeNetworks.error) {
    return (
      <main className="app-viewport relative overflow-hidden bg-[#080a25] text-white">
        <BackgroundGlow />
        <NetworkCreationScreen onNetworkCreated={handleNetworkCreated} />
      </main>
    );
  }

  return (
    <main className="app-viewport relative overflow-hidden bg-[#080a25] text-white">
      <BackgroundGlow />
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
            if (!nextSession) clearSavedCredentials();
            setSession(nextSession);
          }}
          conversations={conversations}
          communities={communities.communities}
          onCommunitiesReload={communities.reload}
          setCommunities={communities.setCommunities}
          setConversations={setConversations}
        />
      )}
    </main>
  );
}

export default App;
