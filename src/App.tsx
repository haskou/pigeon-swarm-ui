import { useState } from 'react';

import type { ConversationResource, Session } from './domain/types';

import { AuthScreen } from './components/auth/AuthScreen';
import { BackgroundGlow } from './components/BackgroundGlow';
import { GlassWorkspace } from './components/workspace/GlassWorkspace';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<ConversationResource[]>(
    [],
  );

  const handleAuthenticated = (
    nextSession: Session,
    nextConversations: ConversationResource[],
  ) => {
    setSession(nextSession);
    setConversations(nextConversations);
  };

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
