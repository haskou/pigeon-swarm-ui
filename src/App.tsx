import { useEffect, useState } from 'react';

import type { ConversationResource, Session } from './domain/types';

import { AuthScreen } from './components/auth/AuthScreen';
import { BackgroundGlow } from './components/BackgroundGlow';
import { NetworkCreationScreen } from './components/network/NetworkCreationScreen';
import { GlassWorkspace } from './components/workspace/GlassWorkspace';
import { PigeonApiClient } from './domain/api/PigeonApiClient';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );
  const [nodeHasOwner, setNodeHasNetworks] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkNodeNetworks = async () => {
      try {
        const client = new PigeonApiClient();
        const nodeInfo = await client.getNodeNetworks();
        setNodeHasNetworks(!!nodeInfo.length);
      } catch (error) {
        alert('Error checking node networks:', error);
      } finally {
        setLoading(false);
      }
    };

    checkNodeNetworks();
  }, []);

  const handleAuthenticated = (
    nextSession: Session,
    nextConversations: ConversationResource[],
  ) => {
    setSession(nextSession);
    setConversations(nextConversations);
  };

  // If we're still loading, show a loading state
  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#080a25] text-white flex items-center justify-center">
        <BackgroundGlow />
        <div className="text-xl">Loading...</div>
      </main>
    );
  }

  const handleNetworkCreated = () => {
    // After creating network, check if node now has an owner
    window.location.reload();
  };

  // If node has no owner, redirect to create network
  if (nodeHasOwner === false) {
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
          setSession={setSession}
          conversations={conversations}
          setConversations={setConversations}
        />
      )}
    </main>
  );
}

export default App;
