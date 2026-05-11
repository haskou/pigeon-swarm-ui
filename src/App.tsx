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
import { useNodeNetworks } from './presentation/hooks/useNodeNetworks';

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
  const nodeNetworks = useNodeNetworks();

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

  if (nodeNetworks.error) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white">
        <BackgroundGlow />
        <ServerConnectionScreen
          error={nodeNetworks.error}
          onRetry={nodeNetworks.reload}
        />
      </main>
    );
  }

  // If we're still loading, show a loading state
  if (nodeNetworks.loading || restoreState === 'loading') {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white flex items-center justify-center">
        <BackgroundGlow />
        <div className="text-xl">{copy.app.loading}</div>
      </main>
    );
  }

  if (nodeNetworks.networks.length === 0 && !nodeNetworks.error) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white">
        <BackgroundGlow />
        <NetworkCreationScreen onNetworkCreated={handleNetworkCreated} />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white">
      <BackgroundGlow />
      {!session ? (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      ) : (
        <GlassWorkspace
          session={session}
          node={nodeNetworks.node}
          nodeNetworks={nodeNetworks.networks}
          onNodeNetworksReload={nodeNetworks.reload}
          setSession={(nextSession) => {
            if (!nextSession) clearSavedCredentials();
            setSession(nextSession);
          }}
          conversations={conversations}
          setConversations={setConversations}
        />
      )}
    </main>
  );
}

export default App;
