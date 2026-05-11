import { useState } from 'react';

import type { ConversationResource, Session } from './domain/types';

import { AuthScreen } from './components/auth/AuthScreen';
import { BackgroundGlow } from './components/BackgroundGlow';
import { NetworkCreationScreen } from './components/network/NetworkCreationScreen';
import { ServerConnectionScreen } from './components/system/ServerConnectionScreen';
import { GlassWorkspace } from './components/workspace/GlassWorkspace';
import { copy } from './i18n/en';
import { useNodeNetworks } from './presentation/hooks/useNodeNetworks';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );
  const nodeNetworks = useNodeNetworks();

  const handleAuthenticated = (
    nextSession: Session,
    nextConversations: ConversationResource[],
  ) => {
    setSession(nextSession);
    setConversations(nextConversations);
  };

  // If we're still loading, show a loading state
  if (nodeNetworks.loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white flex items-center justify-center">
        <BackgroundGlow />
        <div className="text-xl">{copy.app.loading}</div>
      </main>
    );
  }

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
          nodeNetworks={nodeNetworks.networks}
          setSession={setSession}
          conversations={conversations}
          setConversations={setConversations}
        />
      )}
    </main>
  );
}

export default App;
